import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = await params;

    let body: { password?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    if (!body.password) {
        return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
    }

    const db = getAdminDb();
    const projectDoc = await db.collection('projects').doc(projectId).get();

    if (!projectDoc.exists) {
        return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    const passwordHash: string | null = projectDoc.data()?.passwordHash ?? null;

    if (!passwordHash) {
        return NextResponse.json({ valid: true });
    }

    const valid = await bcrypt.compare(body.password, passwordHash);

    if (!valid) {
        return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
}
