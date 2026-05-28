/**
 * releaseTask.ts
 *
 * Handles a worker releasing an accepted task back to the open pool.
 *
 * Design principles:
 *  - Accidental accepts within the grace window: no penalty (no reliability hit, no cooldown).
 *  - Late releases: reduce reliabilityScore; enough late releases in a rolling window trigger cooldown.
 *  - Released tasks are excluded from being re-offered to the same worker for RELEASE_EXCLUSION_HOURS.
 *  - Everything is atomic inside a Prisma transaction.
 */

import { prisma } from './prisma';
import type { ReleaseReason } from '../types';

// ─── Configuration ────────────────────────────────────────────────────────────

/** Seconds after acceptance during which a worker can release with no penalty. */
export const RELEASE_GRACE_SECS = 30;

/** How much to reduce reliabilityScore per late release. Capped at 0.0. */
const LATE_RELEASE_RELIABILITY_PENALTY = 0.08;

/**
 * How many late releases within LATE_RELEASE_WINDOW_HOURS trigger a cooldown.
 * Uses a rolling window so sustained abuse accumulates.
 */
const LATE_RELEASE_COOLDOWN_THRESHOLD = 3;
const LATE_RELEASE_WINDOW_HOURS = 24;

/** How long (minutes) a cooldown lasts once triggered. */
const COOLDOWN_DURATION_MINS = 30;

/**
 * How many hours a released task is excluded from being re-routed back to the
 * same worker. Prevents task-hoarding/cherry-picking loops.
 */
export const RELEASE_EXCLUSION_HOURS = 24;

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ReleaseError extends Error {
    constructor(
        public readonly code:
            | 'NOT_FOUND'
            | 'NOT_OWNER'
            | 'WRONG_STATUS'
            | 'ALREADY_SUBMITTED'
            | 'NO_SESSION',
        message: string,
    ) {
        super(message);
        this.name = 'ReleaseError';
    }
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface ReleaseResult {
    withinGrace: boolean;
    penaltyApplied: boolean;
    cooldownApplied: boolean;
    cooldownUntil?: string; // ISO
    newReliabilityScore: number;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Release an accepted task back to the open pool.
 *
 * Validates:
 *  - task exists and is claimed by workerId
 *  - task has not already been submitted / approved / rejected / settled
 *  - worker has an active or paused session (session must not be ended)
 *
 * Atomically:
 *  - resets task to open, clears assignment, records releasedAt, increments releaseCount
 *  - marks the related TaskOffer as released, records reason and penalty flag
 *  - upserts WorkerStat: increments release counters, applies reliability penalty if late
 *  - applies cooldown if late release threshold is exceeded
 *  - writes a TaskReleaseEvent audit record
 */
export async function releaseAcceptedTask(
    taskId: string,
    workerId: string,
    reason?: ReleaseReason,
): Promise<ReleaseResult> {
    return prisma.$transaction(async (tx) => {
        // ── 1. Load & validate task ──────────────────────────────────────────
        const task = await tx.task.findUnique({ where: { id: taskId } });
        if (!task) throw new ReleaseError('NOT_FOUND', 'Task not found');
        if (task.assignedTo !== workerId) throw new ReleaseError('NOT_OWNER', 'You do not own this task');
        if (task.status !== 'claimed' && task.status !== 'in_progress') {
            if (['pending_verification', 'approved', 'rejected', 'cancelled', 'expired'].includes(task.status)) {
                throw new ReleaseError('ALREADY_SUBMITTED', 'Task cannot be released in its current state');
            }
            throw new ReleaseError('WRONG_STATUS', `Cannot release a task with status "${task.status}"`);
        }

        // ── 2. Check worker has a live session ───────────────────────────────
        const session = await tx.workerSession.findFirst({
            where: { workerId, status: { in: ['active', 'paused'] } },
        });
        if (!session) throw new ReleaseError('NO_SESSION', 'No active session — cannot release');

        // ── 3. Determine grace window ────────────────────────────────────────
        const now = new Date();
        const claimedAt = task.claimedAt ?? now; // fallback shouldn't happen
        const graceExpiresAt = new Date(claimedAt.getTime() + RELEASE_GRACE_SECS * 1000);
        const withinGrace = now <= graceExpiresAt;

        // ── 4. Load current worker stats ─────────────────────────────────────
        const existingStat = await tx.workerStat.findUnique({ where: { userId: workerId } });
        const reliabilityBefore = existingStat?.reliabilityScore ?? 1.0;
        let reliabilityAfter = reliabilityBefore;

        // ── 5. Compute penalty ───────────────────────────────────────────────
        let penaltyApplied = false;
        let cooldownApplied = false;
        let cooldownUntil: Date | undefined;

        if (!withinGrace) {
            penaltyApplied = true;
            reliabilityAfter = Math.max(0.0, reliabilityBefore - LATE_RELEASE_RELIABILITY_PENALTY);

            // Check how many late releases in the rolling window
            const windowStart = new Date(now.getTime() - LATE_RELEASE_WINDOW_HOURS * 3600_000);
            const recentLate = await tx.taskReleaseEvent.count({
                where: { workerId, withinGrace: false, createdAt: { gte: windowStart } },
            });

            // +1 for this release (not yet written, so count current release)
            if (recentLate + 1 >= LATE_RELEASE_COOLDOWN_THRESHOLD) {
                cooldownApplied = true;
                cooldownUntil = new Date(now.getTime() + COOLDOWN_DURATION_MINS * 60_000);
            }
        }

        // ── 6. Find the accepted TaskOffer for this task+worker ──────────────
        const acceptedOffer = await tx.taskOffer.findFirst({
            where: { taskId, workerId, status: 'accepted' },
            orderBy: { acceptedAt: 'desc' },
        });

        // ── 7. Atomic mutations ───────────────────────────────────────────────

        // 7a. Reset task to open
        await tx.task.update({
            where: { id: taskId },
            data: {
                status: 'open',
                assignedTo: null,
                claimedAt: null,
                claimExpiresAt: null,
                completionDeadline: null,
                releasedAt: now,
                releaseCount: { increment: 1 },
                reassignCount: { increment: 1 },
            },
        });

        // 7b. Mark the accepted offer as released
        if (acceptedOffer) {
            await tx.taskOffer.update({
                where: { id: acceptedOffer.id },
                data: {
                    status: 'released',
                    releasedAt: now,
                    releaseReason: reason ?? null,
                    releasePenaltyApplied: penaltyApplied,
                },
            });
        }

        // 7c. Upsert worker stats
        await tx.workerStat.upsert({
            where: { userId: workerId },
            create: {
                userId: workerId,
                releasedTaskCount: 1,
                graceReleasedTaskCount: withinGrace ? 1 : 0,
                lateReleasedTaskCount: withinGrace ? 0 : 1,
                reliabilityScore: reliabilityAfter,
                currentCooldownUntil: cooldownUntil ?? null,
            },
            update: {
                releasedTaskCount: { increment: 1 },
                graceReleasedTaskCount: withinGrace ? { increment: 1 } : undefined,
                lateReleasedTaskCount: withinGrace ? undefined : { increment: 1 },
                reliabilityScore: reliabilityAfter,
                ...(cooldownApplied ? { currentCooldownUntil: cooldownUntil } : {}),
            },
        });

        // 7d. Write audit event
        await tx.taskReleaseEvent.create({
            data: {
                taskId,
                workerId,
                offerId: acceptedOffer?.id ?? 'unknown',
                withinGrace,
                reason: reason ?? null,
                penaltyApplied,
                reliabilityBefore,
                reliabilityAfter,
            },
        });

        return {
            withinGrace,
            penaltyApplied,
            cooldownApplied,
            cooldownUntil: cooldownUntil?.toISOString(),
            newReliabilityScore: reliabilityAfter,
        };
    });
}
