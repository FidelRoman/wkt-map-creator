import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);

        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(decoded.uid).get();
        const url = userDoc.data()?.lsCustomerPortalUrl;

        if (!url) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
        }

        return NextResponse.json({ url });
    } catch (error) {
        console.error('LS portal error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
