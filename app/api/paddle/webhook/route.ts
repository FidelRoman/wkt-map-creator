import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { paddleVerifyWebhook } from '@/lib/paddle';
import type { UserProfile } from '@/lib/firebase';
import { sendUpgradeEmail } from '@/lib/email';

export const runtime = 'nodejs';

async function getUidFromSubscription(subscriptionId: string): Promise<string | null> {
    const db = getAdminDb();
    const snap = await db.collection('users').where('paddleSubscriptionId', '==', subscriptionId).limit(1).get();
    return snap.empty ? null : snap.docs[0].id;
}

async function updateUser(uid: string, updates: Record<string, unknown>) {
    await getAdminDb().collection('users').doc(uid).update(updates);
}

function mapStatus(s: string): UserProfile['subscriptionStatus'] {
    if (s === 'active') return 'active';
    if (s === 'trialing') return 'trialing';
    if (s === 'past_due') return 'past_due';
    if (s === 'canceled' || s === 'cancelled') return 'canceled';
    return null;
}

export async function POST(request: NextRequest) {
    const rawBody = await request.text();
    const signature = request.headers.get('paddle-signature') ?? '';

    const valid = await paddleVerifyWebhook(rawBody, signature);
    if (!valid) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const eventType: string = event.event_type ?? '';
    const data = event.data ?? {};
    const firebaseUid: string | null = data.custom_data?.firebase_uid ?? null;
    const subscriptionId: string = String(data.id ?? '');

    try {
        switch (eventType) {
            case 'subscription.created':
            case 'subscription.updated': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                const status = data.status ?? 'active';
                const plan = (status === 'active' || status === 'trialing') ? 'pro' : 'free';
                const periodEnd = data.current_billing_period?.ends_at ?? null;
                await updateUser(uid, {
                    plan,
                    paddleCustomerId: data.customer_id ?? null,
                    paddleSubscriptionId: subscriptionId,
                    subscriptionStatus: mapStatus(status),
                    currentPeriodEnd: periodEnd,
                });
                if (plan === 'pro' && (status === 'active' || status === 'trialing')) {
                    const userDoc = await getAdminDb().collection('users').doc(uid).get();
                    const userData = userDoc.data();
                    if (userData?.email) {
                        sendUpgradeEmail(userData.email, userData.displayName ?? '', periodEnd).catch(() => {});
                    }
                }
                break;
            }

            case 'subscription.canceled': {
                const uid = firebaseUid ?? (await getUidFromSubscription(subscriptionId));
                if (!uid) break;
                await updateUser(uid, { subscriptionStatus: 'canceled', plan: 'free' });
                break;
            }

            case 'transaction.completed': {
                const txSubscriptionId = data.subscription_id ?? subscriptionId;
                const uid = firebaseUid ?? (await getUidFromSubscription(txSubscriptionId));
                if (!uid) break;
                await updateUser(uid, {
                    subscriptionStatus: 'active',
                    'usageCounters.apiCallsThisMonth': 0,
                    'usageCounters.apiCallsResetAt': new Date(),
                });
                break;
            }

            case 'transaction.payment_failed': {
                const txSubscriptionId = data.subscription_id ?? subscriptionId;
                const uid = firebaseUid ?? (await getUidFromSubscription(txSubscriptionId));
                if (!uid) break;
                await updateUser(uid, { subscriptionStatus: 'past_due' });
                break;
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Paddle webhook handler error:', error);
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
    }
}
