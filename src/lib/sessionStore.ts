/**
 * sessionStore.ts
 *
 * CRUD helpers for WorkerSession and TaskOffer.
 * All mutations that touch both task + offer status use transactions
 * to prevent race conditions (e.g. expiry racing an accept).
 */

import { prisma } from './prisma';
import type { WorkerSession, TaskOffer, SessionStatus } from '../types';
import type {
    WorkerSession as PrismaSession,
    TaskOffer as PrismaOffer,
} from '../generated/prisma/client';

// ─── Heartbeat timeout ────────────────────────────────────────────────────────
/** Sessions that have not sent a heartbeat in this many seconds are considered stale. */
export const HEARTBEAT_TIMEOUT_SECS = 60;

/** Default offer TTL in seconds. */
export const OFFER_TTL_SECS = 30;

// ─── Mapping helpers ──────────────────────────────────────────────────────────

function toSession(p: PrismaSession): WorkerSession {
    return {
        id: p.id,
        workerId: p.workerId,
        status: p.status as SessionStatus,
        startedAt: p.startedAt.toISOString(),
        endedAt: p.endedAt?.toISOString(),
        lastHeartbeatAt: p.lastHeartbeatAt.toISOString(),
        acceptedCount: p.acceptedCount,
        skippedCount: p.skippedCount,
        expiredOfferCount: p.expiredOfferCount,
    };
}

function toOffer(p: PrismaOffer & { task?: import('../generated/prisma/client').Task | null }): TaskOffer {
    return {
        id: p.id,
        taskId: p.taskId,
        workerId: p.workerId,
        sessionId: p.sessionId,
        status: p.status as TaskOffer['status'],
        offeredAt: p.offeredAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
        respondedAt: p.respondedAt?.toISOString(),
        acceptedAt: p.acceptedAt?.toISOString(),
        releasedAt: p.releasedAt?.toISOString(),
        releaseReason: p.releaseReason ?? undefined,
        releasePenaltyApplied: p.releasePenaltyApplied,
        task: p.task
            ? {
                  id: p.task.id,
                  title: p.task.title,
                  description: p.task.description,
                  context: p.task.context ?? undefined,
                  status: p.task.status.replace('in_progress', 'in-progress') as import('../types').TaskStatus,
                  priority: 'medium', // simplified; caller can compute if needed
                  taskType: p.task.taskType as import('../types').TaskType,
                  reward:
                      p.task.rewardAmount != null && p.task.rewardCurrency != null
                          ? { amount: p.task.rewardAmount, currency: p.task.rewardCurrency }
                          : undefined,
                  estimatedMins: p.task.estimatedMins ?? undefined,
                  claimTimeoutMins: p.task.claimTimeoutMins,
                  completionMins: p.task.completionMins ?? undefined,
                  expiresAt: p.task.expiresAt?.toISOString(),
                  claimedAt: p.task.claimedAt?.toISOString(),
                  claimExpiresAt: p.task.claimExpiresAt?.toISOString(),
                  completionDeadline: p.task.completionDeadline?.toISOString(),
                  releasedAt: p.task.releasedAt?.toISOString(),
                  postedBy: p.task.postedBy,
                  assignedTo: p.task.assignedTo ?? undefined,
                  autoReassign: p.task.autoReassign,
                  reassignCount: p.task.reassignCount,
                  releaseCount: p.task.releaseCount,
                  result: p.task.result ?? undefined,
                  verificationNote: p.task.verificationNote ?? undefined,
                  paidOut: p.task.paidOut,
                  createdAt: p.task.createdAt.toISOString(),
                  updatedAt: p.task.updatedAt.toISOString(),
              }
            : undefined,
    };
}

// ─── Active task queries ──────────────────────────────────────────────────────

/** Returns tasks currently claimed or in-progress by a worker (only non-expired ones). */
export async function getActiveTasksForWorker(workerId: string): Promise<import('../types').Task[]> {
    const now = new Date();
    const tasks = await prisma.task.findMany({
        where: {
            assignedTo: workerId,
            status: { in: ['claimed', 'in_progress'] },
            // Exclude tasks whose claim window has already expired
            OR: [{ claimExpiresAt: null }, { claimExpiresAt: { gt: now } }],
        },
        orderBy: { claimedAt: 'asc' },
    });
    return tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        context: t.context ?? undefined,
        status: t.status.replace('in_progress', 'in-progress') as import('../types').TaskStatus,
        priority: (t.priority ?? 'medium') as import('../types').TaskPriority,
        taskType: t.taskType as import('../types').TaskType,
        reward:
            t.rewardAmount != null && t.rewardCurrency != null
                ? { amount: t.rewardAmount, currency: t.rewardCurrency }
                : undefined,
        estimatedMins: t.estimatedMins ?? undefined,
        claimTimeoutMins: t.claimTimeoutMins,
        completionMins: t.completionMins ?? undefined,
        expiresAt: t.expiresAt?.toISOString(),
        claimedAt: t.claimedAt?.toISOString(),
        claimExpiresAt: t.claimExpiresAt?.toISOString(),
        completionDeadline: t.completionDeadline?.toISOString(),
        releasedAt: t.releasedAt?.toISOString(),
        postedBy: t.postedBy,
        assignedTo: t.assignedTo ?? undefined,
        autoReassign: t.autoReassign,
        reassignCount: t.reassignCount,
        releaseCount: t.releaseCount,
        result: t.result ?? undefined,
        verificationNote: t.verificationNote ?? undefined,
        paidOut: t.paidOut,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
    }));
}

// ─── WorkerSession ────────────────────────────────────────────────────────────

/** Start a new active session for a worker.
 *  Ends any previously active/paused session first. */
export async function startSession(workerId: string): Promise<WorkerSession> {
    // End any existing active or paused sessions
    await prisma.workerSession.updateMany({
        where: { workerId, status: { in: ['active', 'paused'] } },
        data: { status: 'ended', endedAt: new Date() },
    });

    const session = await prisma.workerSession.create({
        data: { workerId },
    });
    return toSession(session);
}

export async function pauseSession(sessionId: string, workerId: string): Promise<WorkerSession | null> {
    const session = await prisma.workerSession.findUnique({ where: { id: sessionId } });
    if (!session || session.workerId !== workerId || session.status !== 'active') return null;
    const updated = await prisma.workerSession.update({
        where: { id: sessionId },
        data: { status: 'paused' },
    });
    return toSession(updated);
}

export async function resumeSession(sessionId: string, workerId: string): Promise<WorkerSession | null> {
    const session = await prisma.workerSession.findUnique({ where: { id: sessionId } });
    if (!session || session.workerId !== workerId || session.status !== 'paused') return null;
    const updated = await prisma.workerSession.update({
        where: { id: sessionId },
        data: { status: 'active', lastHeartbeatAt: new Date() },
    });
    return toSession(updated);
}

export async function endSession(sessionId: string, workerId: string): Promise<WorkerSession | null> {
    const session = await prisma.workerSession.findUnique({ where: { id: sessionId } });
    if (!session || session.workerId !== workerId) return null;
    if (session.status === 'ended') return toSession(session);

    // Cancel any pending offers for this session
    await prisma.taskOffer.updateMany({
        where: { sessionId, status: 'pending' },
        data: { status: 'cancelled', respondedAt: new Date() },
    });
    // Return offered tasks back to open
    const cancelledOffers = await prisma.taskOffer.findMany({
        where: { sessionId, status: 'cancelled' },
    });
    if (cancelledOffers.length > 0) {
        await prisma.task.updateMany({
            where: { id: { in: cancelledOffers.map((o) => o.taskId) }, status: 'offered' },
            data: { status: 'open', assignedTo: null },
        });
    }

    const updated = await prisma.workerSession.update({
        where: { id: sessionId },
        data: { status: 'ended', endedAt: new Date() },
    });
    return toSession(updated);
}

export async function heartbeatSession(sessionId: string, workerId: string): Promise<WorkerSession | null> {
    const session = await prisma.workerSession.findUnique({ where: { id: sessionId } });
    if (!session || session.workerId !== workerId || session.status !== 'active') return null;
    const updated = await prisma.workerSession.update({
        where: { id: sessionId },
        data: { lastHeartbeatAt: new Date() },
    });
    return toSession(updated);
}

export async function getActiveSession(workerId: string): Promise<WorkerSession | null> {
    const session = await prisma.workerSession.findFirst({
        where: { workerId, status: { in: ['active', 'paused'] } },
        orderBy: { startedAt: 'desc' },
    });
    return session ? toSession(session) : null;
}

// ─── TaskOffer ────────────────────────────────────────────────────────────────

/** Returns the current pending offer for a worker (includes task data). Ignores expired offers. */
export async function getCurrentOffer(workerId: string): Promise<TaskOffer | null> {
    const offer = await prisma.taskOffer.findFirst({
        where: { workerId, status: 'pending', expiresAt: { gt: new Date() } },
        orderBy: { offeredAt: 'desc' },
        include: { task: true },
    });
    return offer ? toOffer(offer) : null;
}

/** Accept an offer atomically — verifies ownership, expiry, and pending status. */
export async function acceptOffer(offerId: string, workerId: string): Promise<TaskOffer> {
    return prisma.$transaction(async (tx) => {
        const offer = await tx.taskOffer.findUnique({ where: { id: offerId } });
        if (!offer) throw new Error('Offer not found');
        if (offer.workerId !== workerId) throw new Error('Not your offer');
        if (offer.status !== 'pending') throw new Error(`Offer is already ${offer.status}`);
        if (offer.expiresAt < new Date()) throw new Error('Offer has expired');

        const now = new Date();

        // Update offer → accepted
        const updated = await tx.taskOffer.update({
            where: { id: offerId },
            data: { status: 'accepted', respondedAt: now, acceptedAt: now },
            include: { task: true },
        });

        // Update task → claimed by worker
        const claimExpiresAt = new Date(now.getTime() + updated.task.claimTimeoutMins * 60_000);
        const completionDeadline = updated.task.completionMins
            ? new Date(now.getTime() + updated.task.completionMins * 60_000)
            : null;

        await tx.task.update({
            where: { id: offer.taskId },
            data: {
                status: 'claimed',
                assignedTo: workerId,
                claimedAt: now,
                claimExpiresAt,
                completionDeadline,
            },
        });

        // Increment session accepted count
        await tx.workerSession.update({
            where: { id: offer.sessionId },
            data: { acceptedCount: { increment: 1 } },
        });

        return toOffer(updated);
    });
}

/** Skip an offer — worker passes on this task. */
export async function skipOffer(offerId: string, workerId: string): Promise<TaskOffer> {
    return prisma.$transaction(async (tx) => {
        const offer = await tx.taskOffer.findUnique({ where: { id: offerId } });
        if (!offer) throw new Error('Offer not found');
        if (offer.workerId !== workerId) throw new Error('Not your offer');
        if (offer.status !== 'pending') throw new Error(`Offer is already ${offer.status}`);

        const now = new Date();

        const updated = await tx.taskOffer.update({
            where: { id: offerId },
            data: { status: 'skipped', respondedAt: now },
            include: { task: true },
        });

        // Return task to open pool
        await tx.task.update({
            where: { id: offer.taskId, status: 'offered' },
            data: { status: 'open', assignedTo: null },
        });

        // Increment session skipped count
        await tx.workerSession.update({
            where: { id: offer.sessionId },
            data: { skippedCount: { increment: 1 } },
        });

        return toOffer(updated);
    });
}

/**
 * Expire all pending offers whose expiresAt is in the past.
 * Returns the number of offers expired.
 * Called by the background cron job.
 */
export async function expireStaleOffers(): Promise<{ offersExpired: number; sessionsEnded: number }> {
    const now = new Date();

    // Find all stale pending offers
    const staleOffers = await prisma.taskOffer.findMany({
        where: { status: 'pending', expiresAt: { lt: now } },
    });

    if (staleOffers.length === 0) {
        return { offersExpired: 0, sessionsEnded: 0 };
    }

    const staleIds = staleOffers.map((o) => o.id);
    const staleTaskIds = staleOffers.map((o) => o.taskId);
    const sessionIds = Array.from(new Set(staleOffers.map((o) => o.sessionId)));

    await prisma.$transaction([
        // Mark offers expired
        prisma.taskOffer.updateMany({
            where: { id: { in: staleIds } },
            data: { status: 'expired', respondedAt: now },
        }),
        // Return tasks to open pool
        prisma.task.updateMany({
            where: { id: { in: staleTaskIds }, status: 'offered' },
            data: { status: 'open', assignedTo: null },
        }),
        // Increment expiredOfferCount on relevant sessions
        ...sessionIds.map((sid) => {
            const count = staleOffers.filter((o) => o.sessionId === sid).length;
            return prisma.workerSession.update({
                where: { id: sid },
                data: { expiredOfferCount: { increment: count } },
            });
        }),
    ]);

    // End sessions that are stale (no heartbeat)
    const cutoff = new Date(now.getTime() - HEARTBEAT_TIMEOUT_SECS * 1000);
    const endedSessions = await prisma.workerSession.updateMany({
        where: { status: 'active', lastHeartbeatAt: { lt: cutoff } },
        data: { status: 'ended', endedAt: now },
    });

    return { offersExpired: staleIds.length, sessionsEnded: endedSessions.count };
}
