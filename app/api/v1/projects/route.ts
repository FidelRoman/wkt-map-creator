import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PLAN_LIMITS } from '@/lib/plans';

export const runtime = 'nodejs';

const CORS = {
    'Access-Control-Allow-Origin': '*',
} as const;

const apiKeyCache = new Map<string, { result: { uid: string; plan: string; displayName: string; email: string } | null; expiresAt: number }>();
const API_KEY_CACHE_TTL_MS = 5 * 60 * 1000;

async function verifyApiKey(apiKey: string): Promise<{ uid: string; plan: string; displayName: string; email: string } | null> {
    const cached = apiKeyCache.get(apiKey);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    const db = getAdminDb();

    const indexDoc = await db.collection('apiKeyIndex').doc(apiKey).get();
    if (indexDoc.exists) {
        const { uid } = indexDoc.data() as { uid: string };
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data()!;
            const result = { uid, plan: data.plan ?? 'free', displayName: data.displayName ?? '', email: data.email ?? '' };
            apiKeyCache.set(apiKey, { result, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
            return result;
        }
    }

    // Legacy fallback
    const proSnapshot = await db.collection('users').where('plan', '==', 'pro').get();
    for (const userDoc of proSnapshot.docs) {
        const userData = userDoc.data();
        const found = (userData.apiKeys ?? []).find((k: any) => k.key === apiKey);
        if (found) {
            await db.collection('apiKeyIndex').doc(apiKey).set({ uid: userDoc.id, createdAt: found.createdAt ?? new Date() });
            const result = { uid: userDoc.id, plan: userData.plan ?? 'pro', displayName: userData.displayName ?? '', email: userData.email ?? '' };
            apiKeyCache.set(apiKey, { result, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
            return result;
        }
    }

    apiKeyCache.set(apiKey, { result: null, expiresAt: Date.now() + API_KEY_CACHE_TTL_MS });
    return null;
}

async function checkRateLimit(uid: string, plan: string): Promise<{ error: NextResponse } | { remaining: number }> {
    const monthlyLimit = PLAN_LIMITS[plan as 'free' | 'pro']?.apiRateLimitPerMonth ?? 10;
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(uid).get();
    const apiCallsThisMonth = userDoc.data()?.usageCounters?.apiCallsThisMonth ?? 0;

    if (apiCallsThisMonth >= monthlyLimit) {
        return {
            error: NextResponse.json(
                { error: `Monthly API limit reached (${monthlyLimit} calls/month).` },
                { status: 429, headers: CORS }
            ),
        };
    }

    await db.collection('users').doc(uid).update({
        'usageCounters.apiCallsThisMonth': apiCallsThisMonth + 1,
    });

    return { remaining: monthlyLimit - apiCallsThisMonth - 1 };
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: { ...CORS, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' },
    });
}

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get('Authorization') ?? '';
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!apiKey) {
        return NextResponse.json({ error: 'Missing Authorization header. Use: Bearer <api_key>' }, { status: 401, headers: CORS });
    }

    const user = await verifyApiKey(apiKey);
    if (!user) {
        return NextResponse.json({ error: 'Invalid or revoked API key.' }, { status: 401, headers: CORS });
    }

    const rateLimit = await checkRateLimit(user.uid, user.plan);
    if ('error' in rateLimit) return rateLimit.error;

    // Parse body
    let body: { name?: string; isPublic?: boolean };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: CORS });
    }

    const name = (body.name ?? '').trim();
    if (!name) {
        return NextResponse.json({ error: 'Field "name" is required.' }, { status: 400, headers: CORS });
    }

    // Check project limit
    const db = getAdminDb();
    const maxProjects = PLAN_LIMITS[user.plan as 'free' | 'pro']?.maxProjects;
    if (maxProjects !== null) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        const projectCount = userDoc.data()?.usageCounters?.projectCount ?? 0;
        if (projectCount >= maxProjects) {
            return NextResponse.json(
                { error: `Project limit reached (${maxProjects} projects on ${user.plan} plan). Upgrade to Pro for unlimited projects.` },
                { status: 403, headers: CORS }
            );
        }
    }

    // Create project
    const defaultLayerId = `layer_${Date.now()}`;
    const now = FieldValue.serverTimestamp();
    const docRef = await db.collection('projects').add({
        name,
        ownerId: user.uid,
        ownerName: user.displayName,
        ownerEmail: user.email,
        createdAt: now,
        updatedAt: now,
        layers: [{ id: defaultLayerId, name: 'Layer 1', visible: true }],
        isPublic: body.isPublic === true,
        collaborators: [],
        featureCount: 0,
        layerFeatureCounts: { [defaultLayerId]: 0 },
        bbox: null,
    });

    // Increment project count
    await db.collection('users').doc(user.uid).update({
        'usageCounters.projectCount': FieldValue.increment(1),
    });

    return NextResponse.json(
        { id: docRef.id, name, ownerId: user.uid, isPublic: body.isPublic === true, createdAt: new Date().toISOString() },
        { status: 201, headers: { ...CORS, 'X-Rate-Limit-Remaining': String(rateLimit.remaining) } }
    );
}
