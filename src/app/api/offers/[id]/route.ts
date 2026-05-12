/**
 * PATCH /api/offers/[id]
 * Respond to a task offer.
 *
 * Body: { action: "accept" | "skip" }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { acceptOffer, skipOffer } from '../../../../lib/sessionStore';
import { routeNextTaskForSession } from '../../../../lib/taskRouter';

type Params = { params: Promise<{ id: string }> };

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id: offerId } = await params;

    const authSession = await getServerSession(authOptions);
    const userId = getUserId(authSession);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body as { action?: string };

    try {
        if (action === 'accept') {
            const offer = await acceptOffer(offerId, userId);
            return NextResponse.json({ offer });
        }
        if (action === 'skip') {
            const skipped = await skipOffer(offerId, userId);
            // Immediately route the next task so the client gets it in one round-trip
            const nextOffer = await routeNextTaskForSession(skipped.sessionId);
            return NextResponse.json({ offer: skipped, nextOffer: nextOffer ?? null });
        }
        return NextResponse.json({ error: 'action must be "accept" or "skip"' }, { status: 400 });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        const status =
            message === 'Not your offer' ? 403
            : message === 'Offer not found' ? 404
            : 409;
        return NextResponse.json({ error: message }, { status });
    }
}
