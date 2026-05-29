/**
 * taskRouter.ts
 *
 * Matches open tasks to eligible active workers and creates short-lived TaskOffers.
 *
 * Architecture note:
 * -  The scoring function is intentionally simple for MVP. Replace or extend
 *    `scoreWorkerForTask()` with a more sophisticated algorithm (ML, Elo, etc.)
 *    without changing the public `routeNextTaskForSession()` API.
 * -  Routing is currently pull-based (the worker's heartbeat/session triggers it).
 *    For production, consider a push-based queue (e.g. BullMQ, Inngest) that
 *    proactively routes offers as soon as workers become available.
 */

import { prisma } from './prisma';
import { OFFER_TTL_SECS, HEARTBEAT_TIMEOUT_SECS } from './sessionStore';
import { RELEASE_EXCLUSION_HOURS } from './releaseTask';
import type { TaskOffer } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkerContext {
    workerId: string;
    sessionId: string;
    reliabilityScore: number; // 0–1 from WorkerStat
    totalApproved: number;
    totalCompleted: number;
    totalExpired: number;    // from WorkerStat
    lateReleasedTaskCount: number; // from WorkerStat
    skippedCount: number;    // from current WorkerSession
    expiredOfferCount: number; // from current WorkerSession
}

interface TaskCandidate {
    id: string;
    rewardAmount: number;
    expiresAt: Date | null;
    estimatedMins: number | null;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score how well a worker fits a task candidate.
 *
 * Higher is better. Components:
 *  + reliabilityScore (0–1)  → how historically reliable is the worker
 *  + approvalRate    (0–1)  → approved / completed ratio
 *  - timeoutPenalty          → penalise workers with many offer timeouts
 *  - skipPenalty             → penalise workers who skip too often in this session
 *
 * TODO: Add skill matching when worker profiles have skill tags.
 * TODO: Add trust-level gating once workers have a trustLevel field.
 * TODO: Factor in task urgency / reward into priority weighting.
 */
function scoreWorkerForTask(worker: WorkerContext, _task: TaskCandidate): number {
    const reliabilityScore = worker.reliabilityScore; // 0–1
    const approvalRate =
        worker.totalCompleted > 0 ? worker.totalApproved / worker.totalCompleted : 0.5;

    // Normalise timeouts and skips to a 0–1 penalty (caps at 0.5 each)
    const timeoutPenalty = Math.min(worker.expiredOfferCount * 0.05, 0.5);
    const skipPenalty = Math.min(worker.skippedCount * 0.03, 0.3);
    // Late releases reduce priority for high-value tasks (caps at 0.3)
    const lateReleasePenalty = Math.min(worker.lateReleasedTaskCount * 0.05, 0.3);

    const score =
        reliabilityScore * 0.4 +
        approvalRate * 0.4 -
        timeoutPenalty -
        skipPenalty -
        lateReleasePenalty;

    return score;
}

// ─── Router ───────────────────────────────────────────────────────────────────

/**
 * Route the next available open task to the worker's active session.
 *
 * Returns the created TaskOffer, or null if:
 *  - the session is not active
 *  - the worker already has a pending offer
 *  - there are no eligible open tasks
 *
 * Uses a transaction so that selecting + marking a task as "offered"
 * is atomic — prevents two concurrent calls from routing the same task.
 */
export async function routeNextTaskForSession(sessionId: string): Promise<TaskOffer | null> {
    return prisma.$transaction(async (tx) => {
        // 1. Load the session
        const session = await tx.workerSession.findUnique({ where: { id: sessionId } });
        if (!session || session.status !== 'active') return null;

        // 2. Ensure the session's heartbeat is fresh
        const cutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_SECS * 1000);
        if (session.lastHeartbeatAt < cutoff) return null;

        const now = new Date();

        // 2a. Cooldown check — worker is blocked from receiving offers until cooldownUntil
        const workerStatCooldown = await tx.workerStat.findUnique({
            where: { userId: session.workerId },
            select: { currentCooldownUntil: true },
        });
        if (workerStatCooldown?.currentCooldownUntil && workerStatCooldown.currentCooldownUntil > now) {
            return null;
        }

        // 3. Check for an existing live pending offer — skip routing if one is still active.
        //    Expired pending offers are ignored: they will be cleaned up by expireStaleOffers
        //    but must not block new routing.
        const existingOffer = await tx.taskOffer.findFirst({
            where: { workerId: session.workerId, status: 'pending', expiresAt: { gt: now } },
        });
        if (existingOffer) return null;

        // 3a. Concurrency limit — don't route new tasks if worker is already at the cap.
        //     First, recover any claimed tasks whose claimExpiresAt has passed — they should
        //     go back to open so the worker gets new offers and the count drops correctly.
        const expiredClaimed = await tx.task.findMany({
            where: {
                assignedTo: session.workerId,
                status: { in: ['claimed', 'in_progress'] },
                claimExpiresAt: { lte: now },
            },
            select: { id: true },
        });
        if (expiredClaimed.length > 0) {
            await tx.task.updateMany({
                where: { id: { in: expiredClaimed.map((t) => t.id) } },
                data: { status: 'open', assignedTo: null, claimedAt: null, claimExpiresAt: null },
            });
        }

        const CONCURRENCY_LIMIT = 3;
        const activeTaskCount = await tx.task.count({
            where: {
                assignedTo: session.workerId,
                status: { in: ['claimed', 'in_progress'] },
                OR: [{ claimExpiresAt: null }, { claimExpiresAt: { gt: now } }],
            },
        });
        if (activeTaskCount >= CONCURRENCY_LIMIT) return null;

        // 3b. Recover orphaned tasks: tasks stuck in "offered" with no live pending offer.
        //     This happens when a previous session ended without clean-up, or the cron hasn't run yet.
        const orphanedOfferedTasks = await tx.task.findMany({
            where: { status: 'offered' },
            select: { id: true },
        });
        if (orphanedOfferedTasks.length > 0) {
            const orphanedIds = orphanedOfferedTasks.map((t) => t.id);
            // Find which of those have a live (non-expired) pending offer
            const liveOffers = await tx.taskOffer.findMany({
                where: { taskId: { in: orphanedIds }, status: 'pending', expiresAt: { gt: now } },
                select: { taskId: true },
            });
            const liveTaskIds = new Set(liveOffers.map((o) => o.taskId));
            const stuckIds = orphanedIds.filter((id) => !liveTaskIds.has(id));
            if (stuckIds.length > 0) {
                await tx.task.updateMany({
                    where: { id: { in: stuckIds } },
                    data: { status: 'open', assignedTo: null },
                });
            }
        }

        // 4. Load worker stats for scoring
        const workerStat = await tx.workerStat.findUnique({
            where: { userId: session.workerId },
        });

        const workerCtx: WorkerContext = {
            workerId: session.workerId,
            sessionId: session.id,
            reliabilityScore: workerStat?.reliabilityScore ?? 1.0,
            totalApproved: workerStat?.totalApproved ?? 0,
            totalCompleted: workerStat?.totalCompleted ?? 0,
            totalExpired: workerStat?.totalExpired ?? 0,
            lateReleasedTaskCount: workerStat?.lateReleasedTaskCount ?? 0,
            skippedCount: session.skippedCount,
            expiredOfferCount: session.expiredOfferCount,
        };

        // 5. Find open tasks not currently offered to anyone
        //    Exclude tasks this worker has already skipped or had expire in this session,
        //    plus tasks they released recently (to prevent immediate re-routing back to same worker).
        const alreadySeenOffers = await tx.taskOffer.findMany({
            where: {
                sessionId: session.id,
                status: { in: ['skipped', 'expired'] },
            },
            select: { taskId: true },
        });

        // Tasks released by this worker within the exclusion window
        const recentReleaseWindow = new Date(now.getTime() - RELEASE_EXCLUSION_HOURS * 3600_000);
        const recentReleases = await tx.taskReleaseEvent.findMany({
            where: { workerId: session.workerId, createdAt: { gt: recentReleaseWindow } },
            select: { taskId: true },
        });

        // Tasks permanently blocked for this worker (Reopen flow: rejected result, can't retry)
        const workerBlocks = await tx.taskWorkerBlock.findMany({
            where: { workerId: session.workerId },
            select: { taskId: true },
        });

        const excludedTaskIds = [
            ...alreadySeenOffers.map((o) => o.taskId),
            ...recentReleases.map((r) => r.taskId),
            ...workerBlocks.map((b) => b.taskId),
        ];

        const openTasks = await tx.task.findMany({
            where: {
                status: 'open',
                ...(excludedTaskIds.length > 0 ? { id: { notIn: excludedTaskIds } } : {}),
                // Exclude tasks that are past their hard deadline
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: new Date() } },
                ],
            },
            take: 20, // score a batch, not the whole table
            orderBy: { createdAt: 'asc' }, // oldest first as tiebreaker
        });

        if (openTasks.length === 0) return null;

        // 6. Score and select the best task for this worker
        const scored = openTasks
            .map((t) => ({
                task: t,
                score: scoreWorkerForTask(workerCtx, {
                    id: t.id,
                    rewardAmount: t.rewardAmount ?? 0,
                    expiresAt: t.expiresAt,
                    estimatedMins: t.estimatedMins,
                }),
            }))
            .sort((a, b) => b.score - a.score);

        const best = scored[0].task;

        // 7. Atomically mark the task as "offered" and create the offer
        await tx.task.update({
            where: { id: best.id },
            data: { status: 'offered', assignedTo: session.workerId },
        });

        const expiresAt = new Date(Date.now() + OFFER_TTL_SECS * 1000);

        const offer = await tx.taskOffer.create({
            data: {
                taskId: best.id,
                workerId: session.workerId,
                sessionId: session.id,
                expiresAt,
            },
            include: { task: true },
        });

        // Map to public TaskOffer type
        return {
            id: offer.id,
            taskId: offer.taskId,
            workerId: offer.workerId,
            sessionId: offer.sessionId,
            status: 'pending',
            offeredAt: offer.offeredAt.toISOString(),
            expiresAt: offer.expiresAt.toISOString(),
            respondedAt: undefined,
            task: {
                id: offer.task.id,
                title: offer.task.title,
                description: offer.task.description,
                context: offer.task.context ?? undefined,
                status: 'offered',
                priority: 'medium',
                taskType: offer.task.taskType as import('../types').TaskType,
                reward:
                    offer.task.rewardAmount != null && offer.task.rewardCurrency != null
                        ? { amount: offer.task.rewardAmount, currency: offer.task.rewardCurrency }
                        : undefined,
                estimatedMins: offer.task.estimatedMins ?? undefined,
                claimTimeoutMins: offer.task.claimTimeoutMins,
                completionMins: offer.task.completionMins ?? undefined,
                expiresAt: offer.task.expiresAt?.toISOString(),
                claimedAt: undefined,
                claimExpiresAt: undefined,
                completionDeadline: undefined,
                releasedAt: undefined,
                postedBy: offer.task.postedBy,
                assignedTo: session.workerId,
                autoReassign: offer.task.autoReassign,
                reassignCount: offer.task.reassignCount,
                releaseCount: offer.task.releaseCount,
                paidOut: offer.task.paidOut,
                createdAt: offer.task.createdAt.toISOString(),
                updatedAt: offer.task.updatedAt.toISOString(),
            },
        } satisfies TaskOffer;
    });
}
