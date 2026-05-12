/**
 * POST /api/sessions
 * Start a new active work session for the authenticated worker.
 *
 * GET /api/sessions
 * Return the current active session (if any) for the authenticated worker.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { startSession, getActiveSession } from '../../../lib/sessionStore';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

export async function GET(_req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Always return a session — create a paused one if none exists yet.
    let workerSession = await getActiveSession(userId);
    if (!workerSession) {
        workerSession = await startSession(userId);
        // Immediately pause it so the worker chooses when to start receiving offers.
        const { pauseSession } = await import('../../../lib/sessionStore');
        workerSession = (await pauseSession(workerSession.id, userId)) ?? workerSession;
    }
    return NextResponse.json({ session: workerSession });
}

export async function POST(_req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const workerSession = await startSession(userId);
        return NextResponse.json({ session: workerSession }, { status: 201 });
    } catch (err) {
        console.error('[POST /api/sessions] startSession failed:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Internal server error' },
            { status: 500 }
        );
    }
}
