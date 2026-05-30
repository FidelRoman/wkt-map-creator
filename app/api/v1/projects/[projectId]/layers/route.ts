import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { PLAN_LIMITS } from '@/lib/plans';

export const runtime = 'nodejs';

const CORS = { 'Access-Control-Allow-Origin': '*' };

async function verifyApiKey(apiKey: string): Promise<{ uid: string; plan: string } | null> {
    const db = getAdminDb();

    // Fast path: O(1) index lookup
    const indexDoc = await db.collection('apiKeyIndex').doc(apiKey).get();
    if (indexDoc.exists) {
        const { uid } = indexDoc.data() as { uid: string };
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            return { uid, plan: userDoc.data()?.plan ?? 'free' };
        }
    }

    // Legacy fallback: scan Pro users (old keys without index entry)
    const proSnapshot = await db.collection('users').where('plan', '==', 'pro').get();
    for (const userDoc of proSnapshot.docs) {
        const userData = userDoc.data();
        const apiKeys: any[] = userData.apiKeys ?? [];
        const found = apiKeys.find((k: any) => k.key === apiKey);
        if (found) {
            // Back-fill the index so next call is O(1)
            await db.collection('apiKeyIndex').doc(apiKey).set({ uid: userDoc.id, createdAt: found.createdAt ?? new Date() });
            return { uid: userDoc.id, plan: userData.plan ?? 'pro' };
        }
    }

    return null;
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' },
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
    if (user.plan !== 'pro') {
        return NextResponse.json({ error: 'API access requires Pro plan' }, { status: 403, headers: CORS });
    }

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
    const limits = PLAN_LIMITS['pro'];
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
        features: JSON.stringify({ type: 'FeatureCollection', features }),
    };

    await db.collection('projects').doc(projectId).update({ layers: [...layers, newLayer] });

    return NextResponse.json(
        { layerId, name: newLayer.name, featuresAdded: features.length },
        { status: 201, headers: CORS }
    );
}
