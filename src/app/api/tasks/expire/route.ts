import { NextRequest, NextResponse } from 'next/server';
import { expireStaleTasks } from '../../../../lib/taskStore';
import { expireStaleOffers } from '../../../../lib/sessionStore';

/**
 * POST /api/tasks/expire
 *
 * Cron-style endpoint to:
 *  1. Return expired claims (claimExpiresAt or completionDeadline past) back to the open pool.
 *  2. Permanently expire open tasks that are past their hard `expiresAt`.
 *  3. Expire stale TaskOffers and return their tasks to the open pool.
 *  4. End inactive WorkerSessions that have missed their heartbeat window.
 *
 * Should be called every 1–5 minutes by a cron service (e.g. Vercel Cron, GitHub Actions, etc.).
 * Requires the WERKL_API_KEY header for security.
 */
export async function POST(req: NextRequest) {
    const key = req.headers.get('x-api-key');
    if (key !== process.env.WERKL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [taskResult, offerResult] = await Promise.all([
        expireStaleTasks(),
        expireStaleOffers(),
    ]);

    return NextResponse.json({
        ok: true,
        ...taskResult,
        ...offerResult,
        message: [
            `${taskResult.claimTimeouts} claim(s) timed out,`,
            `${taskResult.completionTimeouts} completion(s) timed out,`,
            `${taskResult.hardExpired} task(s) hard-expired,`,
            `${offerResult.offersExpired} offer(s) expired,`,
            `${offerResult.sessionsEnded} session(s) ended.`,
        ].join(' '),
    });
}
