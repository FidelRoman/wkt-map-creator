import { NextRequest, NextResponse } from 'next/server';
import { sendUsageWarningEmail } from '@/lib/email';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST(req: NextRequest) {
    const { email, name, projectName, count, max, uid } = await req.json().catch(() => ({}));
    if (!email || !count || !max) return NextResponse.json({ error: 'missing fields' }, { status: 400 });

    // Server-side dedup: only send once per 30 days per user
    if (uid) {
        const db = getAdminDb();
        const userDoc = await db.collection('users').doc(uid).get();
        const lastSent: Date | null = userDoc.data()?.usageWarningEmailSentAt?.toDate?.() ?? null;
        if (lastSent && Date.now() - lastSent.getTime() < COOLDOWN_MS) {
            return NextResponse.json({ sent: false, reason: 'cooldown' });
        }
        await db.collection('users').doc(uid).set(
            { usageWarningEmailSentAt: FieldValue.serverTimestamp() },
            { merge: true }
        );
    }

    await sendUsageWarningEmail(email, name ?? '', projectName ?? 'your project', count, max);
    return NextResponse.json({ sent: true });
}
