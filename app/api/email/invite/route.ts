import { NextRequest, NextResponse } from 'next/server';
import { sendCollaboratorInviteEmail } from '@/lib/email';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    const { inviteeEmail, inviterName, projectName, projectUrl, role } = await req.json().catch(() => ({}));
    if (!inviteeEmail || !projectName || !projectUrl) {
        return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }
    await sendCollaboratorInviteEmail(inviteeEmail, inviterName ?? 'Someone', projectName, projectUrl, role ?? 'editor');
    return NextResponse.json({ sent: true });
}
