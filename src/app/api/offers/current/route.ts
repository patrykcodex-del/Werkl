/**
 * GET /api/offers/current
 * Return the current pending TaskOffer for the authenticated worker.
 * Also triggers routing if none exists and the worker has an active session.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getCurrentOffer, getActiveSession } from '../../../../lib/sessionStore';
import { routeNextTaskForSession } from '../../../../lib/taskRouter';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

export async function GET(_req: NextRequest) {
    const authSession = await getServerSession(authOptions);
    const userId = getUserId(authSession);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Return existing pending offer if any
    let offer = await getCurrentOffer(userId);
    if (offer) return NextResponse.json({ offer });

    // Otherwise attempt to route a new task if the worker has an active session
    const workerSession = await getActiveSession(userId);
    if (workerSession) {
        offer = await routeNextTaskForSession(workerSession.id);
    }

    return NextResponse.json({ offer: offer ?? null });
}
