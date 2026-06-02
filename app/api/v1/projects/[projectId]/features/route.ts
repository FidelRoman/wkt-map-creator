import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PLAN_LIMITS } from '@/lib/plans';
import { stringify } from 'wellknown';

// Subcollection feature id generator (Firestore-compatible 20-char ID)
const FSID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function newId() { let s = ''; for (let i = 0; i < 20; i++) s += FSID_CHARS[Math.floor(Math.random() * 62)]; return s; }

export const runtime = 'nodejs';

const CORS = { 'Access-Control-Allow-Origin': '*' } as const;
// In-memory API key cache — avoids a Firestore read on every request
// TTL: 5 minutes. Acceptable tradeoff: revoked keys work for up to 5 min.
const apiKeyCache = new Map<string, { result: { uid: string; plan: string } | null; expiresAt: number }>();
const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

async function checkRateLimit(uid: string, plan: string): Promise<{ error: NextResponse } | { remaining: number }> {
    const monthlyLimit = PLAN_LIMITS[plan as 'free' | 'pro']?.apiRateLimitPerMonth ?? PLAN_LIMITS['free'].apiRateLimitPerMonth ?? 10;
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(uid).get();
    const apiCallsThisMonth = userDoc.data()?.usageCounters?.apiCallsThisMonth ?? 0;

    if (apiCallsThisMonth >= monthlyLimit) {
        return {
            error: NextResponse.json(
                { error: `Monthly API limit reached (${monthlyLimit} calls/month). Resets on your next billing date.` },
                { status: 429, headers: CORS }
            )
        };
    }

    await db.collection('users').doc(uid).update({
        'usageCounters.apiCallsThisMonth': apiCallsThisMonth + 1,
    });

    return { remaining: monthlyLimit - apiCallsThisMonth - 1 };
}

async function verifyApiKey(apiKey: string): Promise<{ uid: string; plan: string } | null> {
    // Check in-memory cache first
    const cached = apiKeyCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const db = getAdminDb();

    // ── Fast path: O(1) index lookup ─────────────────────────────────────────
    const indexDoc = await db.collection('apiKeyIndex').doc(apiKey).get();
    if (indexDoc.exists) {
        const { uid } = indexDoc.data() as { uid: string };
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const result = { uid, plan: userDoc.data()?.plan ?? 'free' };
            apiKeyCache.set(apiKey, { result, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
            return result;
        }
    }

    // ── Legacy fallback: scan Pro users (old keys without index entry) ────────
    const proSnapshot = await db.collection('users').where('plan', '==', 'pro').get();
    for (const userDoc of proSnapshot.docs) {
        const userData = userDoc.data();
        const apiKeys: any[] = userData.apiKeys ?? [];
        const found = apiKeys.find((k: any) => k.key === apiKey);
        if (found) {
            await db.collection('apiKeyIndex').doc(apiKey).set({ uid: userDoc.id, createdAt: found.createdAt ?? new Date() });
            const result = { uid: userDoc.id, plan: userData.plan ?? 'pro' };
            apiKeyCache.set(apiKey, { result, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
            return result;
        }
    }

    apiKeyCache.set(apiKey, { result: null, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
    return null;
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;

    // Auth: Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'API key required. Use Authorization: Bearer <your-api-key>' }, { status: 401 });
    }
    const apiKey = authHeader.split('Bearer ')[1].trim();

    const user = await verifyApiKey(apiKey);
    if (!user) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
    }

    const db = getAdminDb();

    // Verify project access
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projectData = projectDoc.data()!;
    if (projectData.ownerId !== user.uid && !projectData.collaborators?.includes(user.uid)) {
        return NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.uid, user.plan);
    if ('error' in rateLimit) return rateLimit.error;

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const layerFilter = searchParams.get('layer');
    const nameFilter = searchParams.get('name')?.toLowerCase();
    const bboxStr = searchParams.get('bbox');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 1000);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    let bbox: [number, number, number, number] | null = null;
    if (bboxStr) {
        const parts = bboxStr.split(',').map(Number);
        if (parts.length === 4 && parts.every(n => !isNaN(n))) {
            bbox = parts as [number, number, number, number];
        }
    }

    // Build GeoJSON response — read features from the subcollection
    const layers: any[] = projectData.layers ?? [];
    const allFeatures: any[] = [];

    let q: any = db.collection('projects').doc(projectId).collection('features').orderBy('order', 'asc');
    if (layerFilter) q = q.where('layerId', '==', layerFilter);
    const featSnap = await q.get();
    for (const d of featSnap.docs) {
        const raw = d.data();
        let geometry: any = null; let properties: any = {};
        try { geometry = typeof raw.geometry === 'string' ? JSON.parse(raw.geometry) : raw.geometry; } catch { /* skip */ }
        try { properties = typeof raw.properties === 'string' ? JSON.parse(raw.properties) : (raw.properties ?? {}); } catch { /* skip */ }
        const layer = layers.find((l: any) => l.id === raw.layerId);
        if (nameFilter && !properties?.name?.toLowerCase().includes(nameFilter)) continue;
        if (bbox && geometry?.coordinates) {
            const coords = geometry.coordinates.flat(Infinity);
            const lngs = coords.filter((_: any, i: number) => i % 2 === 0);
            const lats = coords.filter((_: any, i: number) => i % 2 === 1);
            if (Math.max(...lngs) < bbox[0] || Math.min(...lngs) > bbox[2] ||
                Math.max(...lats) < bbox[1] || Math.min(...lats) > bbox[3]) continue;
        }
        allFeatures.push({ type: 'Feature', id: d.id, geometry, properties: {
            ...properties,
            _layerId: raw.layerId,
            _layerName: layer?.name ?? '',
            _wkt: (() => { try { return stringify(geometry); } catch { return null; } })(),
        }});
    }

    const paginated = allFeatures.slice(offset, offset + limit);

    return NextResponse.json({
        type: 'FeatureCollection',
        features: paginated,
        meta: {
            total: allFeatures.length,
            limit,
            offset,
            hasMore: offset + limit < allFeatures.length,
            projectId,
            projectName: projectData.name,
        }
    }, {
        headers: {
            'Content-Type': 'application/geo+json',
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'X-Total-Count': String(allFeatures.length),
            'X-Rate-Limit-Remaining': String(rateLimit.remaining),
            'Access-Control-Allow-Origin': '*',
        }
    });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'API key required' }, { status: 401, headers: CORS });
    }
    const apiKey = authHeader.split('Bearer ')[1].trim();
    const user = await verifyApiKey(apiKey);
    if (!user) return NextResponse.json({ error: 'Invalid API key' }, { status: 403, headers: CORS });

    // Rate limiting
    const rateLimit = await checkRateLimit(user.uid, user.plan);
    if ('error' in rateLimit) return rateLimit.error;

    const db = getAdminDb();
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: CORS });
    const projectData = projectDoc.data()!;
    if (projectData.ownerId !== user.uid && !projectData.collaborators?.includes(user.uid)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: CORS });
    }

    let body: any;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }

    const { layerId, features } = body;
    if (!layerId || !Array.isArray(features)) {
        return NextResponse.json({ error: 'Body must include layerId (string) and features (array)' }, { status: 400, headers: CORS });
    }

    const layers: any[] = projectData.layers ?? [];
    const layerIdx = layers.findIndex((l: any) => l.id === layerId);
    if (layerIdx === -1) return NextResponse.json({ error: 'Layer not found' }, { status: 404, headers: CORS });

    // Write each feature as an independent document in the subcollection
    const existingCount = (projectData.layerFeatureCounts?.[layerId] ?? 0) as number;
    const limits = PLAN_LIMITS[user.plan as 'free' | 'pro'] ?? PLAN_LIMITS['free'];
    const maxFeatures = limits.maxFeaturesPerLayer ?? 500;
    if (existingCount + features.length > maxFeatures) {
        return NextResponse.json({ error: `Exceeds maxFeaturesPerLayer limit (${maxFeatures})` }, { status: 422, headers: CORS });
    }
    const batch = db.batch();
    let baseOrder = existingCount * 1024;
    const addedIds: string[] = [];
    for (const f of features) {
        const fid = f.id || newId();
        addedIds.push(fid);
        // Serialize geometry/properties as JSON strings (Firestore rejects nested arrays)
        batch.set(db.collection('projects').doc(projectId).collection('features').doc(fid), {
            layerId,
            geometry: JSON.stringify(f.geometry ?? null),
            properties: JSON.stringify(f.properties ?? {}),
            order: (baseOrder += 1024),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: 'api',
        });
    }
    // Bump project metadata
    batch.update(db.collection('projects').doc(projectId), {
        [`layerFeatureCounts.${layerId}`]: FieldValue.increment(features.length),
        featureCount: FieldValue.increment(features.length),
        updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return NextResponse.json({ added: features.length, total: existingCount + features.length, featureIds: addedIds }, {
        status: 201, headers: CORS
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'API key required' }, { status: 401, headers: CORS });
    }
    const apiKey = authHeader.split('Bearer ')[1].trim();
    const user = await verifyApiKey(apiKey);
    if (!user) return NextResponse.json({ error: 'Invalid API key' }, { status: 403, headers: CORS });

    // Rate limiting
    const rateLimit = await checkRateLimit(user.uid, user.plan);
    if ('error' in rateLimit) return rateLimit.error;

    const db = getAdminDb();
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: CORS });
    const projectData = projectDoc.data()!;
    if (projectData.ownerId !== user.uid) {
        return NextResponse.json({ error: 'Only the project owner can delete features' }, { status: 403, headers: CORS });
    }

    let body: any;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: CORS });
    }

    const { layerId, featureId, featureIndex } = body;
    if (!layerId || (typeof featureId !== 'string' && typeof featureIndex !== 'number')) {
        return NextResponse.json({ error: 'Body must include layerId and either featureId (string) or featureIndex (number, deprecated)' }, { status: 400, headers: CORS });
    }

    const layers: any[] = projectData.layers ?? [];
    const layerIdx = layers.findIndex((l: any) => l.id === layerId);
    if (layerIdx === -1) return NextResponse.json({ error: 'Layer not found' }, { status: 404, headers: CORS });

    let resolvedId = featureId;
    if (!resolvedId && typeof featureIndex === 'number') {
        // Compat: resolve featureIndex → featureId by order
        const snap = await db.collection('projects').doc(projectId).collection('features')
            .where('layerId', '==', layerId).orderBy('order', 'asc').get();
        const featDocs = snap.docs;
        if (featureIndex < 0 || featureIndex >= featDocs.length) {
            return NextResponse.json({ error: `featureIndex ${featureIndex} out of range` }, { status: 422, headers: CORS });
        }
        resolvedId = featDocs[featureIndex].id;
    }
    const featRef = db.collection('projects').doc(projectId).collection('features').doc(resolvedId);
    const featSnap = await featRef.get();
    if (!featSnap.exists) return NextResponse.json({ error: 'Feature not found' }, { status: 404, headers: CORS });
    const batch = db.batch();
    batch.delete(featRef);
    batch.update(db.collection('projects').doc(projectId), {
        [`layerFeatureCounts.${layerId}`]: FieldValue.increment(-1),
        featureCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();
    const deprecationHeaders = !featureId ? { ...CORS, 'Deprecation': 'featureIndex is deprecated; use featureId' } : CORS;
    return NextResponse.json({ deleted: true, featureId: resolvedId }, { headers: deprecationHeaders });
}
