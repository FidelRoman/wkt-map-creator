import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { lsCreateCheckout } from '@/lib/lemonsqueezy';

const VARIANT_IDS: Record<string, Record<string, string>> = {
    pro: {
        month: process.env.LS_VARIANT_PRO_MONTHLY ?? '',
        year: process.env.LS_VARIANT_PRO_YEARLY ?? '',
    },
    business: {
        month: process.env.LS_VARIANT_BUSINESS_MONTHLY ?? '',
        year: process.env.LS_VARIANT_BUSINESS_YEARLY ?? '',
    },
};

export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        const decoded = await getAuth().verifyIdToken(idToken);

        const { planId, interval } = await request.json();
        const variantId = VARIANT_IDS[planId]?.[interval];
        if (!variantId) {
            return NextResponse.json({ error: 'Variante no configurada' }, { status: 400 });
        }

        const storeId = process.env.LEMONSQUEEZY_STORE_ID ?? '';
        const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

        const url = await lsCreateCheckout({
            storeId,
            variantId,
            email: decoded.email ?? '',
            firebaseUid: decoded.uid,
            successUrl: `${origin}/?upgrade=success`,
            cancelUrl: `${origin}/?upgrade=canceled`,
        });

        return NextResponse.json({ url });
    } catch (error) {
        console.error('LS checkout error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
