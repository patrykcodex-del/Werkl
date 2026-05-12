/**
 * PATCH /api/sessions/[id]
 * Update the state of a worker session.
 *
 * Body: { action: "pause" | "resume" | "end" | "heartbeat" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import {
    pauseSession,
    resumeSession,
    endSession,
    heartbeatSession,
} from '../../../../lib/sessionStore';
import { routeNextTaskForSession } from '../../../../lib/taskRouter';

type Params = { params: Promise<{ id: string }> };

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id: sessionId } = await params;

    const authSession = await getServerSession(authOptions);
    const userId = getUserId(authSession);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    let updated = null;
    switch (action) {
        case 'pause':
            updated = await pauseSession(sessionId, userId);
            break;
        case 'resume':
            updated = await resumeSession(sessionId, userId);
            break;
        case 'end':
            updated = await endSession(sessionId, userId);
            break;
        case 'heartbeat':
            updated = await heartbeatSession(sessionId, userId);
            if (updated) {
                // Opportunistically route a new task offer if the worker has none
                const offer = await routeNextTaskForSession(sessionId);
                return NextResponse.json({ session: updated, offer: offer ?? null });
            }
            break;
        default:
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!updated) {
        return NextResponse.json({ error: 'Session not found or action not applicable' }, { status: 404 });
    }

    return NextResponse.json({ session: updated });
}
