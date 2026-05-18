import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { lsVerifyWebhook } from '@/lib/lemonsqueezy';

export const runtime = 'nodejs';

const PLAN_FROM_VARIANT: Record<string, 'pro' | 'business'> = {
    [process.env.LS_VARIANT_PRO_MONTHLY ?? '___']: 'pro',
    [process.env.LS_VARIANT_PRO_YEARLY ?? '___']: 'pro',
    [process.env.LS_VARIANT_BUSINESS_MONTHLY ?? '___']: 'business',
    [process.env.LS_VARIANT_BUSINESS_YEARLY ?? '___']: 'business',
};

async function getUidFromSubscription(subscriptionId: string): Promise<string | null> {
    const db = getAdminDb();
    const snap = await db.collection('users').where('lsSubscriptionId', '==', subscriptionId).limit(1).get();
    return snap.empty ? null : snap.docs[0].id;
}

async function updateUser(uid: string, updates: Record<string, unknown>) {
    await getAdminDb().collection('users').doc(uid).update(updates);
}

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get('X-Signature') ?? '';
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '';

    if (!secret || !lsVerifyWebhook(body, signature, secret)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    let payload: any;
    try {
        payload = JSON.parse(body);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventName: string = payload.meta?.event_name ?? '';
    const firebaseUid: string | null = payload.meta?.custom_data?.firebase_uid ?? null;
    const attrs = payload.data?.attributes ?? {};
    const subscriptionId: string = String(payload.data?.id ?? '');
    const variantId: string = String(attrs.variant_id ?? '');
    const plan = PLAN_FROM_VARIANT[variantId] ?? 'pro';
    const customerPortalUrl: string = attrs.urls?.customer_portal ?? '';
    const renewsAt: string | null = attrs.renews_at ?? null;

    try {
        switch (eventName) {
            case 'subscription_created': {
                const uid = firebaseUid;
                if (!uid) break;
                await updateUser(uid, {
                    plan,
                    lsSubscriptionId: subscriptionId,
                    lsCustomerId: String(attrs.customer_id ?? ''),
                    lsCustomerPortalUrl: customerPortalUrl,
                    subscriptionStatus: 'active',
                    currentPeriodEnd: renewsAt ? new Date(renewsAt) : null,
                });
                break;
            }

            case 'subscription_updated': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                const status = attrs.status === 'cancelled' ? 'canceled' : (attrs.status ?? 'active');
                await updateUser(uid, {
                    plan: attrs.status === 'expired' ? 'free' : plan,
                    subscriptionStatus: status,
                    lsCustomerPortalUrl: customerPortalUrl || undefined,
                    currentPeriodEnd: renewsAt ? new Date(renewsAt) : null,
                });
                break;
            }

            case 'subscription_cancelled': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                // Cancelled but still active until period end
                await updateUser(uid, { subscriptionStatus: 'canceled' });
                break;
            }

            case 'subscription_expired': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                await updateUser(uid, {
                    plan: 'free',
                    subscriptionStatus: 'canceled',
                    lsSubscriptionId: null,
                    currentPeriodEnd: null,
                });
                break;
            }

            case 'subscription_payment_success': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                await updateUser(uid, {
                    subscriptionStatus: 'active',
                    currentPeriodEnd: renewsAt ? new Date(renewsAt) : null,
                    'usageCounters.apiCallsThisMonth': 0,
                    'usageCounters.apiCallsResetAt': new Date(),
                });
                break;
            }

            case 'subscription_payment_failed': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                await updateUser(uid, { subscriptionStatus: 'past_due' });
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('LS webhook handler error:', error);
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }
}
