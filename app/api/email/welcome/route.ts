import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const { email, name } = await req.json().catch(() => ({}));
    if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });
    await sendWelcomeEmail(email, name ?? '');
    return NextResponse.json({ sent: true });
}
