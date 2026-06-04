import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PLAN_LIMITS } from '@/lib/plans';

export const runtime = 'nodejs';

const CORS = {
    'Access-Control-Allow-Origin': '*',
} as const;

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

    // Fast path: O(1) index lookup
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

    apiKeyCache.set(apiKey, { result: null, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
    return null;
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'API key required. Use Authorization: Bearer <your-api-key>' }, { status: 401, headers: CORS });
    }
    const apiKey = authHeader.split('Bearer ')[1].trim();

    const user = await verifyApiKey(apiKey);
    if (!user) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 403, headers: CORS });
    }

    const db = getAdminDb();
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: CORS });
    }
    const projectData = projectDoc.data()!;
    if (projectData.ownerId !== user.uid && !projectData.collaborators?.includes(user.uid)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: CORS });
    }

    // Rate limiting
    const rateLimit = await checkRateLimit(user.uid, user.plan);
    if ('error' in rateLimit) return rateLimit.error;

    const layers: any[] = projectData.layers ?? [];
    // Sanitize layers to return metadata only (exclude features)
    const sanitizedLayers = layers.map((l: any) => {
        const { features, ...rest } = l;
        return rest;
    });

    return NextResponse.json(
        { layers: sanitizedLayers },
        {
            headers: {
                ...CORS,
                'X-Rate-Limit-Remaining': String(rateLimit.remaining),
            }
        }
    );
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

    const { name, features = [] } = body;
    if (!name || typeof name !== 'string') {
        return NextResponse.json({ error: 'Body must include name (string)' }, { status: 400, headers: CORS });
    }
    if (!Array.isArray(features)) {
        return NextResponse.json({ error: 'features must be an array' }, { status: 400, headers: CORS });
    }

    const layers: any[] = projectData.layers ?? [];
    const limits = PLAN_LIMITS[user.plan as 'free' | 'pro'] ?? PLAN_LIMITS['pro'];
    const maxLayers = limits.maxLayersPerProject ?? 20;
    if (layers.length >= maxLayers) {
        return NextResponse.json({ error: `Layer limit reached (${maxLayers} layers per project)` }, { status: 422, headers: CORS });
    }

    const maxFeatures = limits.maxFeaturesPerLayer ?? 5000;
    if (features.length > maxFeatures) {
        return NextResponse.json({ error: `Exceeds maxFeaturesPerLayer limit (${maxFeatures})` }, { status: 422, headers: CORS });
    }

    const layerId = `layer_${Date.now()}`;
    const newLayer = {
        id: layerId,
        name: name.trim(),
        visible: true,
        style: null,
    };

    // Write features to the subcollection
    const batch = db.batch();
    const FSID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const newId = () => { let s = ''; for (let i = 0; i < 20; i++) s += FSID_CHARS[Math.floor(Math.random() * 62)]; return s; };

    let baseOrder = 0;
    for (const f of features) {
        const fid = f.id || newId();
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

    // Compute new bbox & counts
    const existingCount = (projectData.featureCount ?? 0) as number;
    const existingLayerCounts = (projectData.layerFeatureCounts ?? {}) as Record<string, number>;
    const newLayerCounts = { ...existingLayerCounts, [layerId]: features.length };

    let currentBbox: [number, number, number, number] | null = projectData.bbox ?? null;
    const visitCoords = (c: any, limitsArr: number[]): void => {
        if (!Array.isArray(c)) return;
        if (typeof c[0] === 'number') {
            const [lng, lat] = c;
            if (lng < limitsArr[0]) limitsArr[0] = lng; if (lng > limitsArr[2]) limitsArr[2] = lng;
            if (lat < limitsArr[1]) limitsArr[1] = lat; if (lat > limitsArr[3]) limitsArr[3] = lat;
        } else c.forEach(item => visitCoords(item, limitsArr));
    };

    if (features.length > 0) {
        let minLng = currentBbox ? currentBbox[0] : Infinity;
        let minLat = currentBbox ? currentBbox[1] : Infinity;
        let maxLng = currentBbox ? currentBbox[2] : -Infinity;
        let maxLat = currentBbox ? currentBbox[3] : -Infinity;
        const limitsArr = [minLng, minLat, maxLng, maxLat];

        for (const f of features) {
            visitCoords(f.geometry?.coordinates ?? [], limitsArr);
        }

        if (isFinite(limitsArr[0])) {
            currentBbox = limitsArr as [number, number, number, number];
        }
    }

    batch.update(db.collection('projects').doc(projectId), {
        layers: [...layers, newLayer],
        featureCount: existingCount + features.length,
        layerFeatureCounts: newLayerCounts,
        bbox: currentBbox,
        updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json(
        { layerId, name: newLayer.name, featuresAdded: features.length },
        {
            status: 201,
            headers: {
                ...CORS,
                'X-Rate-Limit-Remaining': String(rateLimit.remaining),
            }
        }
    );
}
