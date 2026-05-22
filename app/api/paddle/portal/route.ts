import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { paddle } from '@/lib/paddle';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization') ?? '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let uid: string;
    try {
        const decoded = await getAdminAuth().verifyIdToken(idToken);
        uid = decoded.uid;
    } catch {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userDoc = await getAdminDb().collection('users').doc(uid).get();
    const paddleCustomerId: string | null = userDoc.data()?.paddleCustomerId ?? null;

    if (!paddleCustomerId) {
        return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    try {
        const session = await paddle.customerPortalSessions.create(paddleCustomerId, []);
        return NextResponse.json({ url: session.urls.general.overview });
    } catch (err) {
        console.error('Paddle portal session error:', err);
        return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
    }
}
