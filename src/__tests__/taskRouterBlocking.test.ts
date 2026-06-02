import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock prisma before importing the router ──────────────────────────────────

const mockTx = {
    workerSession: { findUnique: vi.fn() },
    workerStat: { findUnique: vi.fn() },
    taskOffer: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    task: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    taskReleaseEvent: { findMany: vi.fn() },
    taskWorkerBlock: { findMany: vi.fn() },
};

vi.mock('../lib/prisma', () => ({
    prisma: {
        $transaction: vi.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    },
}));

import { routeNextTaskForSession } from '../lib/taskRouter';

// ── Constants ────────────────────────────────────────────────────────────────

const SESSION_ID = 'session-1';
const WORKER_ID = 'worker-1';

const baseSession = {
    id: SESSION_ID,
    workerId: WORKER_ID,
    status: 'active',
    lastHeartbeatAt: new Date(), // fresh heartbeat
    skippedCount: 0,
    expiredOfferCount: 0,
};

function baseTask(id: string) {
    return {
        id,
        title: `Task ${id}`,
        description: 'desc',
        context: null,
        status: 'open',
        priority: 'medium',
        taskType: 'async',
        rewardAmount: null,
        rewardCurrency: null,
        expiresAt: null,
        estimatedMins: null,
        claimTimeoutMins: 5,
        completionMins: null,
        postedBy: 'agent-1',
        assignedTo: null,
        autoReassign: true,
        reassignCount: 0,
        releaseCount: 0,
        paidOut: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        claimedAt: null,
        claimExpiresAt: null,
        completionDeadline: null,
        releasedAt: null,
    };
}

/**
 * Set up mocks for the "happy path" through routeNextTaskForSession.
 * The calls in order (when no expired/orphaned tasks exist):
 *  1. workerSession.findUnique       — session
 *  2. workerStat.findUnique          — cooldown check
 *  3. taskOffer.findFirst            — existing pending offer
 *  4. task.findMany                  — expired claimed tasks
 *  5. task.count                     — active concurrency count
 *  6. task.findMany                  — orphaned offered tasks
 *  7. workerStat.findUnique          — scoring stats
 *  8. taskOffer.findMany             — session skipped/expired offers
 *  9. taskReleaseEvent.findMany      — recent releases
 * 10. taskWorkerBlock.findMany       — blocks for this worker  ← NEW
 * 11. task.findMany                  — open tasks for routing
 * 12. task.update                    — mark task as offered    (only when offers created)
 * 13. taskOffer.create               — create the offer        (only when offers created)
 */
function setupHappyPathMocks({
    openTasks = [] as ReturnType<typeof baseTask>[],
    blocks = [] as { taskId: string }[],
} = {}) {
    mockTx.workerSession.findUnique.mockResolvedValue(baseSession);
    mockTx.workerStat.findUnique
        .mockResolvedValueOnce({ currentCooldownUntil: null }) // cooldown check
        .mockResolvedValueOnce(null);                           // scoring stats
    mockTx.taskOffer.findFirst.mockResolvedValue(null);
    mockTx.task.findMany
        .mockResolvedValueOnce([])          // expired claimed
        .mockResolvedValueOnce([])          // orphaned offered
        .mockResolvedValue(openTasks);      // open tasks
    mockTx.task.count.mockResolvedValue(0);
    mockTx.taskOffer.findMany.mockResolvedValue([]);  // session skipped/expired
    mockTx.taskReleaseEvent.findMany.mockResolvedValue([]);
    mockTx.taskWorkerBlock.findMany.mockResolvedValue(blocks);
    mockTx.task.update.mockResolvedValue({});
    if (openTasks.length > 0) {
        mockTx.taskOffer.create.mockResolvedValue({
            id: 'offer-1',
            taskId: openTasks[0].id,
            workerId: WORKER_ID,
            sessionId: SESSION_ID,
            status: 'pending',
            offeredAt: new Date(),
            expiresAt: new Date(),
            respondedAt: null,
            task: openTasks[0],
        });
    }
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('taskRouter — TaskWorkerBlock exclusion', () => {
    it('includes blocked task IDs in the exclusion list passed to the open-tasks query', async () => {
        const BLOCKED_TASK_ID = 'task-blocked';

        setupHappyPathMocks({
            blocks: [{ taskId: BLOCKED_TASK_ID }],
            openTasks: [],
        });

        await routeNextTaskForSession(SESSION_ID);

        // Find the open-tasks query by matching where.status === 'open'
        const openTasksCall = mockTx.task.findMany.mock.calls.find(
            (call) => (call[0] as { where?: { status?: string } } | undefined)?.where?.status === 'open'
        );
        expect(openTasksCall).toBeDefined();
        expect(openTasksCall![0].where.id?.notIn).toContain(BLOCKED_TASK_ID);
    });

    it('returns an offer for a non-blocked Task even when the worker has a block on another Task', async () => {
        const BLOCKED_TASK_ID = 'task-blocked';
        const open = baseTask('task-allowed');

        setupHappyPathMocks({
            blocks: [{ taskId: BLOCKED_TASK_ID }],
            openTasks: [open],
        });

        const result = await routeNextTaskForSession(SESSION_ID);

        expect(result).not.toBeNull();
        expect(result?.taskId).toBe('task-allowed');
    });

    it('returns null when the only open Task is blocked for the Worker', async () => {
        const BLOCKED_TASK_ID = 'task-blocked';

        // No open tasks returned (the WHERE excludes the blocked task)
        setupHappyPathMocks({
            blocks: [{ taskId: BLOCKED_TASK_ID }],
            openTasks: [],
        });

        const result = await routeNextTaskForSession(SESSION_ID);
        expect(result).toBeNull();
    });

    it('queries taskWorkerBlock for the current worker', async () => {
        setupHappyPathMocks({ openTasks: [] });

        await routeNextTaskForSession(SESSION_ID);

        expect(mockTx.taskWorkerBlock.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ workerId: WORKER_ID }),
            })
        );
    });
});
