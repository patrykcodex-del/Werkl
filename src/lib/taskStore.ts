import { prisma } from './prisma';
import type { Task, TaskStatus, TaskPriority, TaskReward } from '../types';
import type { Task as PrismaTask } from '../generated/prisma/client';

// ─── Mapping ─────────────────────────────────────────────────────────────────

function toTask(p: PrismaTask): Task {
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        context: p.context ?? undefined,
        status: p.status.replace('in_progress', 'in-progress') as TaskStatus,
        priority: p.priority as TaskPriority,
        reward:
            p.rewardAmount != null && p.rewardCurrency != null
                ? { amount: p.rewardAmount, currency: p.rewardCurrency }
                : undefined,
        postedBy: p.postedBy,
        assignedTo: p.assignedTo ?? undefined,
        result: p.result ?? undefined,
        verificationNote: p.verificationNote ?? undefined,
        paidOut: p.paidOut,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}

function toPrismaStatus(status: TaskStatus) {
    return status.replace('in-progress', 'in_progress') as
        | 'open'
        | 'claimed'
        | 'in_progress'
        | 'pending_verification'
        | 'approved'
        | 'rejected'
        | 'completed'
        | 'cancelled';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listTasks(status?: TaskStatus): Promise<Task[]> {
    const rows = await prisma.task.findMany({
        where: status ? { status: toPrismaStatus(status) } : undefined,
        orderBy: { createdAt: 'desc' },
    });
    return rows.map(toTask);
}

export async function getTask(id: string): Promise<Task | undefined> {
    const row = await prisma.task.findUnique({ where: { id } });
    return row ? toTask(row) : undefined;
}

export async function createTask(data: {
    title: string;
    description: string;
    context?: string;
    priority?: TaskPriority;
    reward?: TaskReward;
    postedBy: string;
}): Promise<Task> {
    const row = await prisma.task.create({
        data: {
            title: data.title,
            description: data.description,
            context: data.context,
            priority: (data.priority ?? 'medium') as TaskPriority,
            rewardAmount: data.reward?.amount,
            rewardCurrency: data.reward?.currency,
            postedBy: data.postedBy,
        },
    });
    return toTask(row);
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<Task | undefined> {
    try {
        const row = await prisma.task.update({
            where: { id },
            data: {
                ...(patch.title !== undefined && { title: patch.title }),
                ...(patch.description !== undefined && { description: patch.description }),
                ...(patch.context !== undefined && { context: patch.context }),
                ...(patch.status !== undefined && { status: toPrismaStatus(patch.status) }),
                ...(patch.priority !== undefined && { priority: patch.priority }),
                ...(patch.reward !== undefined && {
                    rewardAmount: patch.reward.amount,
                    rewardCurrency: patch.reward.currency,
                }),
                ...(patch.assignedTo !== undefined && { assignedTo: patch.assignedTo }),
                ...(patch.result !== undefined && { result: patch.result }),
                ...(patch.verificationNote !== undefined && { verificationNote: patch.verificationNote }),
                ...(patch.paidOut !== undefined && { paidOut: patch.paidOut }),
            },
        });
        return toTask(row);
    } catch {
        return undefined;
    }
}
