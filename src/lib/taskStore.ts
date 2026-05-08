import { prisma } from './prisma';
import type { Task, TaskStatus, TaskPriority, TaskType, TaskReward } from '../types';
import type { Task as PrismaTask } from '../generated/prisma/client';

// ─── Platform-computed priority ──────────────────────────────────────────────
// Agents cannot self-assign priority. The platform derives it from deadline
// urgency and reward value so it can't be gamed.

function computePriority(p: PrismaTask): TaskPriority {
    const reward = p.rewardAmount ?? 0;
    const minsUntilExpiry = p.expiresAt
        ? (p.expiresAt.getTime() - Date.now()) / 60000
        : Infinity;

    if (minsUntilExpiry <= 60  || reward >= 8) return 'urgent';
    if (minsUntilExpiry <= 360 || reward >= 5) return 'high';
    if (minsUntilExpiry <= 1440 || reward >= 2) return 'medium';
    return 'low';
}

// ─── Mapping ─────────────────────────────────────────────────────────────────

function toTask(p: PrismaTask): Task {
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        context: p.context ?? undefined,
        status: p.status.replace('in_progress', 'in-progress') as TaskStatus,
        priority: computePriority(p),
        taskType: p.taskType as TaskType,
        reward:
            p.rewardAmount != null && p.rewardCurrency != null
                ? { amount: p.rewardAmount, currency: p.rewardCurrency }
                : undefined,
        estimatedMins: p.estimatedMins ?? undefined,
        claimTimeoutMins: p.claimTimeoutMins,
        completionMins: p.completionMins ?? undefined,
        expiresAt: p.expiresAt?.toISOString(),
        claimedAt: p.claimedAt?.toISOString(),
        claimExpiresAt: p.claimExpiresAt?.toISOString(),
        completionDeadline: p.completionDeadline?.toISOString(),
        postedBy: p.postedBy,
        assignedTo: p.assignedTo ?? undefined,
        autoReassign: p.autoReassign,
        reassignCount: p.reassignCount,
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
        | 'expired'
        | 'cancelled';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type TaskSortField = 'createdAt' | 'reward' | 'priority';
export type TaskSortOrder = 'asc' | 'desc';

export interface ListTasksOptions {
    status?: TaskStatus | TaskStatus[];
    priority?: TaskPriority;
    sort?: TaskSortField;
    order?: TaskSortOrder;
    limit?: number;
    offset?: number;
}

export interface TaskPage {
    tasks: Task[];
    total: number;
    limit: number;
    offset: number;
}

export async function listTasks(options?: TaskStatus | ListTasksOptions): Promise<Task[]> {
    // Backwards-compat: accept plain status string
    const opts: ListTasksOptions =
        options == null
            ? {}
            : typeof options === 'string'
            ? { status: options }
            : options;

    const { status, priority, sort = 'createdAt', order = 'desc' } = opts;

    const statusFilter = status
        ? Array.isArray(status)
            ? { in: status.map(toPrismaStatus) }
            : toPrismaStatus(status)
        : undefined;

    const orderBy: object = sort === 'reward'
        ? { rewardAmount: order }
        : sort === 'priority'
        ? { rewardAmount: order } // fetch by reward as proxy; re-sort in memory below
        : { createdAt: order };

    const rows = await prisma.task.findMany({
        where: {
            ...(statusFilter ? { status: statusFilter } : {}),
        },
        orderBy,
    });

    const priorityRank: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
    let tasks = rows.map(toTask);
    if (sort === 'priority') {
        tasks = tasks.sort((a, b) =>
            order === 'desc'
                ? priorityRank[b.priority] - priorityRank[a.priority]
                : priorityRank[a.priority] - priorityRank[b.priority]
        );
    }
    return priority ? tasks.filter(t => t.priority === priority) : tasks;
}

export async function listTasksPaged(options: ListTasksOptions): Promise<TaskPage> {
    const { status, sort = 'createdAt', order = 'desc', limit = 24, offset = 0 } = options;

    const statusFilter = status
        ? Array.isArray(status)
            ? { in: status.map(toPrismaStatus) }
            : toPrismaStatus(status)
        : undefined;

    const where = statusFilter ? { status: statusFilter } : {};
    const orderBy: object = sort === 'reward' ? { rewardAmount: order } : { createdAt: order };

    const [rows, total] = await Promise.all([
        prisma.task.findMany({ where, orderBy, skip: offset, take: limit }),
        prisma.task.count({ where }),
    ]);

    return { tasks: rows.map(toTask), total, limit, offset };
}

export async function getNextTask(): Promise<Task | undefined> {
    // Return the single best open task: highest reward first, then oldest
    const rows = await prisma.task.findMany({
        where: { status: 'open' },
        orderBy: [{ rewardAmount: 'desc' }, { createdAt: 'asc' }],
        take: 1,
    });
    return rows[0] ? toTask(rows[0]) : undefined;
}

export async function getTask(id: string): Promise<Task | undefined> {
    const row = await prisma.task.findUnique({ where: { id } });
    return row ? toTask(row) : undefined;
}

export async function createTask(data: {
    title: string;
    description: string;
    context?: string;
    taskType?: TaskType;
    reward?: TaskReward;
    estimatedMins?: number;
    claimTimeoutMins?: number;
    completionMins?: number;
    expiresAt?: string;
    autoReassign?: boolean;
    postedBy: string;
}): Promise<Task> {
    const row = await prisma.task.create({
        data: {
            title: data.title,
            description: data.description,
            context: data.context,
            // priority is intentionally omitted — computed by platform on read
            taskType: (data.taskType ?? 'async') as TaskType,
            rewardAmount: data.reward?.amount,
            rewardCurrency: data.reward?.currency,
            estimatedMins: data.estimatedMins,
            claimTimeoutMins: data.claimTimeoutMins ?? 5,
            completionMins: data.completionMins,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
            autoReassign: data.autoReassign ?? true,
            postedBy: data.postedBy,
        },
    });
    return toTask(row);
}

export async function updateTask(id: string, patch: Partial<Task> & {
    claimedAt?: string | null;
    claimExpiresAt?: string | null;
    completionDeadline?: string | null;
}): Promise<Task | undefined> {
    try {
        const row = await prisma.task.update({
            where: { id },
            data: {
                ...(patch.title !== undefined && { title: patch.title }),
                ...(patch.description !== undefined && { description: patch.description }),
                ...(patch.context !== undefined && { context: patch.context }),
                ...(patch.status !== undefined && { status: toPrismaStatus(patch.status) }),
                ...(patch.priority !== undefined && { priority: patch.priority }),
                ...(patch.taskType !== undefined && { taskType: patch.taskType }),
                ...(patch.reward !== undefined && {
                    rewardAmount: patch.reward.amount,
                    rewardCurrency: patch.reward.currency,
                }),
                ...(patch.assignedTo !== undefined && { assignedTo: patch.assignedTo }),
                ...(patch.claimedAt !== undefined && { claimedAt: patch.claimedAt ? new Date(patch.claimedAt) : null }),
                ...(patch.claimExpiresAt !== undefined && { claimExpiresAt: patch.claimExpiresAt ? new Date(patch.claimExpiresAt) : null }),
                ...(patch.completionDeadline !== undefined && { completionDeadline: patch.completionDeadline ? new Date(patch.completionDeadline) : null }),
                ...(patch.autoReassign !== undefined && { autoReassign: patch.autoReassign }),
                ...(patch.reassignCount !== undefined && { reassignCount: patch.reassignCount }),
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

// ─── Expiry / Reassignment ────────────────────────────────────────────────────

/**
 * Called by the /api/tasks/expire cron endpoint.
 * Returns counts of affected rows.
 */
export async function expireStaleTasks(): Promise<{
    claimTimeouts: number;
    completionTimeouts: number;
    hardExpired: number;
}> {
    const now = new Date();

    // 1. Claimed tasks whose claim window expired (worker never started)
    const claimTimeoutResult = await prisma.task.findMany({
        where: {
            status: 'claimed',
            claimExpiresAt: { lte: now },
        },
        select: { id: true, autoReassign: true, reassignCount: true, assignedTo: true },
    });

    let claimTimeouts = 0;
    for (const task of claimTimeoutResult) {
        if (task.autoReassign) {
            await prisma.task.update({
                where: { id: task.id },
                data: {
                    status: 'open',
                    assignedTo: null,
                    claimedAt: null,
                    claimExpiresAt: null,
                    completionDeadline: null,
                    reassignCount: { increment: 1 },
                },
            });
        } else {
            await prisma.task.update({ where: { id: task.id }, data: { status: 'expired' } });
        }
        // update worker stat
        if (task.assignedTo) {
            await prisma.workerStat.upsert({
                where: { userId: task.assignedTo },
                create: { userId: task.assignedTo, totalClaimed: 1, totalExpired: 1, reliabilityScore: 0.5 },
                update: {
                    totalExpired: { increment: 1 },
                },
            });
        }
        claimTimeouts++;
    }

    // 2. Claimed/in-progress tasks that missed the completion deadline
    const completionTimeoutResult = await prisma.task.findMany({
        where: {
            status: { in: ['claimed', 'in_progress'] },
            completionDeadline: { lte: now },
            // avoid double-processing tasks already caught above (claimExpiresAt was null or in future)
            claimExpiresAt: null,
        },
        select: { id: true, autoReassign: true, reassignCount: true, assignedTo: true },
    });

    let completionTimeouts = 0;
    for (const task of completionTimeoutResult) {
        if (task.autoReassign) {
            await prisma.task.update({
                where: { id: task.id },
                data: {
                    status: 'open',
                    assignedTo: null,
                    claimedAt: null,
                    claimExpiresAt: null,
                    completionDeadline: null,
                    reassignCount: { increment: 1 },
                },
            });
        } else {
            await prisma.task.update({ where: { id: task.id }, data: { status: 'expired' } });
        }
        if (task.assignedTo) {
            await prisma.workerStat.upsert({
                where: { userId: task.assignedTo },
                create: { userId: task.assignedTo, totalClaimed: 1, totalExpired: 1, reliabilityScore: 0.5 },
                update: { totalExpired: { increment: 1 } },
            });
        }
        completionTimeouts++;
    }

    // 3. Open tasks past their hard expiresAt
    const hardExpiredResult = await prisma.task.updateMany({
        where: {
            status: 'open',
            expiresAt: { lte: now },
        },
        data: { status: 'expired' },
    });

    return {
        claimTimeouts,
        completionTimeouts,
        hardExpired: hardExpiredResult.count,
    };
}

/**
 * Recalculate and persist the reliability score for a worker.
 * Score = approvalRate * (1 - expiredRate)
 */
export async function refreshWorkerScore(userId: string): Promise<void> {
    const stat = await prisma.workerStat.findUnique({ where: { userId } });
    if (!stat || stat.totalClaimed === 0) return;

    const approvalRate = stat.totalApproved / Math.max(stat.totalCompleted, 1);
    const expiredRate = stat.totalExpired / stat.totalClaimed;
    const score = Math.max(0, Math.min(1, approvalRate * (1 - expiredRate)));

    await prisma.workerStat.update({
        where: { userId },
        data: { reliabilityScore: score },
    });
}

