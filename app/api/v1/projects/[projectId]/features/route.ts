import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { PLAN_LIMITS } from '@/lib/plans';
import { stringify } from 'wellknown';

export const runtime = 'nodejs';

async function verifyApiKey(apiKey: string): Promise<{ uid: string; plan: string } | null> {
    const db = getAdminDb();
    const snapshot = await db
        .collection('users')
        .where('apiKeys', 'array-contains-any', [{ key: apiKey }])
        .limit(1)
        .get();

    if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        return { uid: snapshot.docs[0].id, plan: data.plan ?? 'free' };
    }

    // Fallback: search by scanning (Firestore doesn't support nested array-contains-any easily)
    const allUsersSnapshot = await db.collection('users').where('plan', 'in', ['pro', 'business']).get();
    for (const userDoc of allUsersSnapshot.docs) {
        const userData = userDoc.data();
        const apiKeys: any[] = userData.apiKeys ?? [];
        const found = apiKeys.find((k: any) => k.key === apiKey);
        if (found) {
            // Update lastUsed
            const updatedKeys = apiKeys.map((k: any) => k.key === apiKey ? { ...k, lastUsed: new Date() } : k);
            await userDoc.ref.update({ apiKeys: updatedKeys });
            return { uid: userDoc.id, plan: userData.plan ?? 'pro' };
        }
    }

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

    if (!['pro', 'business'].includes(user.plan)) {
        return NextResponse.json({ error: 'API access requires Pro or Business plan', upgradeUrl: '/?upgrade=api' }, { status: 403 });
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
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.data()!;
    const limits = PLAN_LIMITS[user.plan as 'pro' | 'business'];
    const dailyLimit = limits.apiRateLimitPerDay ?? 1000;
    const apiCallsToday = userData.usageCounters?.apiCallsThisMonth ?? 0;

    if (apiCallsToday >= dailyLimit) {
        return NextResponse.json({ error: `Daily API limit reached (${dailyLimit} calls). Upgrade to Business for higher limits.` }, { status: 429 });
    }

    // Increment counter
    await db.collection('users').doc(user.uid).update({
        'usageCounters.apiCallsThisMonth': apiCallsToday + 1
    });

    // Query params
    const searchParams = request.nextUrl.searchParams;
    const layerFilter = searchParams.get('layer');
    const nameFilter = searchParams.get('name')?.toLowerCase();
    const bboxStr = searchParams.get('bbox');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), user.plan === 'business' ? 10000 : 1000);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    let bbox: [number, number, number, number] | null = null;
    if (bboxStr) {
        const parts = bboxStr.split(',').map(Number);
        if (parts.length === 4 && parts.every(n => !isNaN(n))) {
            bbox = parts as [number, number, number, number];
        }
    }

    // Build GeoJSON response
    const layers: any[] = projectData.layers ?? [];
    const allFeatures: any[] = [];

    for (const layer of layers) {
        if (layerFilter && layer.id !== layerFilter) continue;
        const featuresRaw = typeof layer.features === 'string' ? JSON.parse(layer.features) : layer.features;
        const features = featuresRaw?.features ?? [];

        for (const feature of features) {
            if (nameFilter && !feature.properties?.name?.toLowerCase().includes(nameFilter)) continue;

            if (bbox) {
                const geom = feature.geometry;
                if (geom?.coordinates) {
                    const coords = geom.coordinates.flat(Infinity);
                    const lngs = coords.filter((_: any, i: number) => i % 2 === 0);
                    const lats = coords.filter((_: any, i: number) => i % 2 === 1);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    if (maxLng < bbox[0] || minLng > bbox[2] || maxLat < bbox[1] || minLat > bbox[3]) continue;
                }
            }

            allFeatures.push({
                ...feature,
                properties: {
                    ...feature.properties,
                    _layerId: layer.id,
                    _layerName: layer.name,
                    _wkt: (() => { try { return stringify(feature.geometry); } catch { return null; } })(),
                }
            });
        }
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
            'X-Total-Count': String(allFeatures.length),
            'X-Rate-Limit-Remaining': String(dailyLimit - apiCallsToday - 1),
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
        return NextResponse.json({ error: 'API key required' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const apiKey = authHeader.split('Bearer ')[1].trim();
    const user = await verifyApiKey(apiKey);
    if (!user) return NextResponse.json({ error: 'Invalid API key' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (!['pro', 'business'].includes(user.plan)) {
        return NextResponse.json({ error: 'API access requires Pro or Business plan' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const db = getAdminDb();
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    const projectData = projectDoc.data()!;
    if (projectData.ownerId !== user.uid && !projectData.collaborators?.includes(user.uid)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    let body: any;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const { layerId, features } = body;
    if (!layerId || !Array.isArray(features)) {
        return NextResponse.json({ error: 'Body must include layerId (string) and features (array)' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const layers: any[] = projectData.layers ?? [];
    const layerIdx = layers.findIndex((l: any) => l.id === layerId);
    if (layerIdx === -1) return NextResponse.json({ error: 'Layer not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });

    const layer = layers[layerIdx];
    const existingFeatures = (() => {
        try {
            const fc = typeof layer.features === 'string' ? JSON.parse(layer.features) : layer.features;
            return fc?.features ?? [];
        } catch { return []; }
    })();

    const limits = PLAN_LIMITS[user.plan as 'pro' | 'business'];
    const maxFeatures = limits.maxFeaturesPerLayer ?? 500;
    if (existingFeatures.length + features.length > maxFeatures) {
        return NextResponse.json({ error: `Exceeds maxFeaturesPerLayer limit (${maxFeatures})` }, { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const merged = [...existingFeatures, ...features];
    layers[layerIdx] = { ...layer, features: JSON.stringify({ type: 'FeatureCollection', features: merged }) };
    await db.collection('projects').doc(projectId).update({ layers });

    return NextResponse.json({ added: features.length, total: merged.length }, {
        status: 201,
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    const { projectId } = await params;

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'API key required' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
    const apiKey = authHeader.split('Bearer ')[1].trim();
    const user = await verifyApiKey(apiKey);
    if (!user) return NextResponse.json({ error: 'Invalid API key' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    if (!['pro', 'business'].includes(user.plan)) {
        return NextResponse.json({ error: 'API access requires Pro or Business plan' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const db = getAdminDb();
    const projectDoc = await db.collection('projects').doc(projectId).get();
    if (!projectDoc.exists) return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
    const projectData = projectDoc.data()!;
    if (projectData.ownerId !== user.uid) {
        return NextResponse.json({ error: 'Only the project owner can delete features' }, { status: 403, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    let body: any;
    try { body = await request.json(); } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const { layerId, featureIndex } = body;
    if (!layerId || typeof featureIndex !== 'number') {
        return NextResponse.json({ error: 'Body must include layerId (string) and featureIndex (number)' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const layers: any[] = projectData.layers ?? [];
    const layerIdx = layers.findIndex((l: any) => l.id === layerId);
    if (layerIdx === -1) return NextResponse.json({ error: 'Layer not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });

    const layer = layers[layerIdx];
    const fc = typeof layer.features === 'string' ? JSON.parse(layer.features) : layer.features;
    const features: any[] = fc?.features ?? [];
    if (featureIndex < 0 || featureIndex >= features.length) {
        return NextResponse.json({ error: `featureIndex ${featureIndex} out of range (0–${features.length - 1})` }, { status: 422, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    features.splice(featureIndex, 1);
    layers[layerIdx] = { ...layer, features: JSON.stringify({ type: 'FeatureCollection', features }) };
    await db.collection('projects').doc(projectId).update({ layers });

    return NextResponse.json({ deleted: true, remaining: features.length }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
    });
}
