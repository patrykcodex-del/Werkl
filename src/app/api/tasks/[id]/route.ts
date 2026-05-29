import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask, refreshWorkerScore } from '../../../../lib/taskStore';
import { creditEarning } from '../../../../lib/earningsStore';
import { prisma } from '../../../../lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { authenticateAgentFromRequest } from '../../../../lib/agentAuth';
import { fireAgentWebhook } from '../../../../lib/agentWebhook';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const { status, result, verificationNote, approved } = body;

    // ── Agent / API key path ──────────────────────────────────────────────────
    const agentKeyPresent = req.headers.get('x-api-key') !== null;
    if (agentKeyPresent) {
        const authResult = await authenticateAgentFromRequest(req.headers);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error }, { status: authResult.status });
        }

        const { agent } = authResult;
        if (agent.id !== task.postedBy) {
            return NextResponse.json({ error: 'Forbidden: only the posting Agent may verify this Task' }, { status: 403 });
        }

        if (task.status !== 'pending_verification') {
            return NextResponse.json({ error: 'Task is not awaiting verification' }, { status: 409 });
        }
        if (typeof approved !== 'boolean') {
            return NextResponse.json({ error: 'approved (boolean) is required' }, { status: 400 });
        }
        const newStatus = approved ? 'approved' : 'rejected';
        const updated = await updateTask(id, { status: newStatus, verificationNote });

        if (task.assignedTo) {
            const completionSecs = task.claimedAt
                ? (Date.now() - new Date(task.claimedAt).getTime()) / 1000
                : undefined;

            await prisma.workerStat.upsert({
                where: { userId: task.assignedTo },
                create: {
                    userId: task.assignedTo,
                    totalClaimed: 1,
                    totalCompleted: 1,
                    totalApproved: approved ? 1 : 0,
                    totalRejected: approved ? 0 : 1,
                    avgCompletionSecs: completionSecs ?? null,
                    reliabilityScore: approved ? 1.0 : 0.5,
                },
                update: {
                    totalCompleted: { increment: 1 },
                    totalApproved: approved ? { increment: 1 } : undefined,
                    totalRejected: approved ? undefined : { increment: 1 },
                    ...(completionSecs !== undefined && {
                        avgCompletionSecs: completionSecs,
                    }),
                },
            });
            await refreshWorkerScore(task.assignedTo);

            if (approved && task.reward) {
                await creditEarning(task.assignedTo, {
                    taskId: task.id,
                    taskTitle: task.title,
                    amount: task.reward.amount,
                    currency: task.reward.currency,
                    earnedAt: new Date().toISOString(),
                });
            }
        }
        return NextResponse.json(updated);
    }

    // ── Worker / session path ─────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as typeof session.user & { id?: string }).id ?? session.user.email!;

    if (status === 'claimed') {
        if (task.status !== 'open') {
            return NextResponse.json({ error: 'Task is no longer available' }, { status: 409 });
        }

        const now = new Date();
        const claimExpiresAt = new Date(now.getTime() + task.claimTimeoutMins * 60_000).toISOString();
        const completionDeadline = task.completionMins
            ? new Date(now.getTime() + task.completionMins * 60_000).toISOString()
            : undefined;

        const updated = await updateTask(id, {
            status: 'claimed',
            assignedTo: userId,
            claimedAt: now.toISOString(),
            claimExpiresAt,
            ...(completionDeadline && { completionDeadline }),
        });

        await prisma.workerStat.upsert({
            where: { userId },
            create: { userId, totalClaimed: 1 },
            update: { totalClaimed: { increment: 1 } },
        });

        return NextResponse.json(updated);
    }

    if (status === 'pending_verification') {
        if (task.assignedTo !== userId) {
            return NextResponse.json({ error: 'You are not assigned to this task' }, { status: 403 });
        }
        if (!result?.trim()) {
            return NextResponse.json({ error: 'result is required' }, { status: 400 });
        }
        const updated = await updateTask(id, {
            status: 'pending_verification',
            result,
            claimExpiresAt: undefined,
        });

        const postingAgent = await prisma.agent.findUnique({
            where: { id: task.postedBy },
            select: { callbackUrl: true },
        }).catch(() => null);

        fireAgentWebhook(postingAgent?.callbackUrl ?? null, {
            taskId: task.id,
            status: 'pending_verification',
            title: task.title,
        });

        return NextResponse.json(updated);
    }

    return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
}
