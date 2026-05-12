/**
 * POST /api/tasks/[id]/release
 *
 * Release an accepted task back to the open pool.
 * Body: { reason?: ReleaseReason }
 *
 * Responses:
 *   200 { withinGrace, penaltyApplied, cooldownApplied, cooldownUntil?, newReliabilityScore }
 *   400 { error }   — validation failure
 *   401             — unauthenticated
 *   403             — not your task
 *   409             — task already submitted / wrong status
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { releaseAcceptedTask, ReleaseError } from '../../../../../lib/releaseTask';
import type { ReleaseReason } from '../../../../../types';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

const VALID_REASONS = new Set<ReleaseReason>([
    'unclear_instructions',
    'too_difficult',
    'not_enough_time',
    'wrong_task_type',
    'other',
]);

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const authSession = await getServerSession(authOptions);
    const workerId = getUserId(authSession);
    if (!workerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;

    let reason: ReleaseReason | undefined;
    try {
        const body = await req.json();
        if (body.reason && VALID_REASONS.has(body.reason)) {
            reason = body.reason as ReleaseReason;
        }
    } catch {
        // Body is optional — proceed without reason
    }

    try {
        const result = await releaseAcceptedTask(taskId, workerId, reason);
        return NextResponse.json(result);
    } catch (err) {
        if (err instanceof ReleaseError) {
            const status =
                err.code === 'NOT_FOUND'         ? 404
              : err.code === 'NOT_OWNER'          ? 403
              : err.code === 'ALREADY_SUBMITTED'  ? 409
              : err.code === 'NO_SESSION'         ? 422
              : 400;
            return NextResponse.json({ error: err.message, code: err.code }, { status });
        }
        console.error('[release]', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
