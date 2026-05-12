/**
 * GET /api/tasks/history
 *
 * Returns the authenticated worker's task history:
 *   - completed / approved / pending_verification  → "done"
 *   - expired (was assigned to them)               → "missed"
 *   - rejected                                     → "rejected"
 *
 * Query params:
 *   limit  (default 20)
 *   offset (default 0)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/prisma';
import type { $Enums } from '../../../../generated/prisma/client';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

const DONE_STATUSES:   $Enums.TaskStatus[] = ['completed', 'approved', 'pending_verification', 'rejected'];
const MISSED_STATUSES: $Enums.TaskStatus[] = ['expired'];

export async function GET(req: NextRequest) {
    const authSession = await getServerSession(authOptions);
    const userId = getUserId(authSession);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp     = req.nextUrl.searchParams;
    const tab    = sp.get('tab') === 'missed' ? 'missed' : 'done';
    const limit  = Math.min(parseInt(sp.get('limit')  ?? '20'), 100);
    const offset = parseInt(sp.get('offset') ?? '0');

    const statuses = tab === 'missed' ? MISSED_STATUSES : DONE_STATUSES;

    const [tasks, total] = await Promise.all([
        prisma.task.findMany({
            where: { assignedTo: userId, status: { in: statuses } },
            orderBy: { updatedAt: 'desc' },
            take: limit,
            skip: offset,
        }),
        prisma.task.count({
            where: { assignedTo: userId, status: { in: statuses } },
        }),
    ]);

    const mapped = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        taskType: t.taskType,
        reward: t.rewardAmount != null && t.rewardCurrency != null
            ? { amount: t.rewardAmount, currency: t.rewardCurrency }
            : null,
        estimatedMins: t.estimatedMins,
        claimedAt: t.claimedAt?.toISOString() ?? null,
        completionDeadline: t.completionDeadline?.toISOString() ?? null,
        result: t.result ?? null,
        verificationNote: t.verificationNote ?? null,
        paidOut: t.paidOut,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    }));

    return NextResponse.json({ tasks: mapped, total, hasMore: offset + tasks.length < total });
}
