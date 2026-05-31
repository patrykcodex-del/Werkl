import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
    prisma: {
        task: {
            count: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}));

import { checkAgentTaskPostRateLimit } from '../lib/agentRateLimit';
import { prisma } from '../lib/prisma';

const mockCount = vi.mocked(prisma.task.count);
const mockFindFirst = vi.mocked(prisma.task.findFirst);

const ORIGINAL_ENV = process.env.AGENT_TASK_POST_LIMIT_PER_HOUR;

beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AGENT_TASK_POST_LIMIT_PER_HOUR;
});

afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
        delete process.env.AGENT_TASK_POST_LIMIT_PER_HOUR;
    } else {
        process.env.AGENT_TASK_POST_LIMIT_PER_HOUR = ORIGINAL_ENV;
    }
});

describe('checkAgentTaskPostRateLimit', () => {
    it('allows a request when the agent has posted fewer tasks than the limit in the last hour', async () => {
        mockCount.mockResolvedValueOnce(3);
        const result = await checkAgentTaskPostRateLimit('agent-1');
        expect(result).toEqual({ allowed: true });
    });

    it('rejects when the agent has reached the limit, with retryAfterSec until the oldest task in the window ages out', async () => {
        process.env.AGENT_TASK_POST_LIMIT_PER_HOUR = '5';
        const now = new Date('2026-05-31T12:00:00Z');
        vi.setSystemTime(now);
        // Oldest task in window was 50 minutes ago -> ages out in 10 min = 600s
        const oldestCreatedAt = new Date(now.getTime() - 50 * 60 * 1000);

        mockCount.mockResolvedValueOnce(5);
        mockFindFirst.mockResolvedValueOnce({ createdAt: oldestCreatedAt } as never);

        const result = await checkAgentTaskPostRateLimit('agent-1');
        expect(result).toEqual({ allowed: false, retryAfterSec: 600 });

        vi.useRealTimers();
    });

    it('counts only tasks posted by the given agent within the last rolling hour', async () => {
        const now = new Date('2026-05-31T12:00:00Z');
        vi.setSystemTime(now);
        mockCount.mockResolvedValueOnce(0);

        await checkAgentTaskPostRateLimit('agent-42');

        expect(mockCount).toHaveBeenCalledWith({
            where: {
                postedBy: 'agent-42',
                createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
            },
        });
        vi.useRealTimers();
    });

    it('uses the default limit of 60 when AGENT_TASK_POST_LIMIT_PER_HOUR is not set', async () => {
        mockCount.mockResolvedValueOnce(59);
        const allowed = await checkAgentTaskPostRateLimit('agent-1');
        expect(allowed).toEqual({ allowed: true });

        mockCount.mockResolvedValueOnce(60);
        mockFindFirst.mockResolvedValueOnce({ createdAt: new Date() } as never);
        const rejected = await checkAgentTaskPostRateLimit('agent-1');
        expect(rejected.allowed).toBe(false);
    });
});
