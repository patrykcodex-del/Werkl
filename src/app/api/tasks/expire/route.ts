import { NextRequest, NextResponse } from 'next/server';
import { expireStaleTasks } from '../../../../lib/taskStore';

/**
 * POST /api/tasks/expire
 *
 * Cron-style endpoint to:
 *  1. Return expired claims (claimExpiresAt or completionDeadline past) back to the open pool.
 *  2. Permanently expire open tasks that are past their hard `expiresAt`.
 *
 * Should be called every 1–5 minutes by a cron service (e.g. Vercel Cron, GitHub Actions, etc.).
 * Requires the WERKL_API_KEY header for security.
 */
export async function POST(req: NextRequest) {
    const key = req.headers.get('x-api-key');
    if (key !== process.env.WERKL_API_KEY) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await expireStaleTasks();

    return NextResponse.json({
        ok: true,
        ...result,
        message: `${result.claimTimeouts} claim(s) timed out, ${result.completionTimeouts} completion(s) timed out, ${result.hardExpired} task(s) hard-expired.`,
    });
}
