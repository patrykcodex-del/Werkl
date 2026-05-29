import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';

vi.mock('../lib/taskStore', () => ({
    getTask: vi.fn(),
    updateTask: vi.fn(),
    refreshWorkerScore: vi.fn(),
}));

vi.mock('../lib/earningsStore', () => ({
    creditEarning: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        workerStat: { upsert: vi.fn() },
        agent: { findUnique: vi.fn() },
    },
}));

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue(null),
}));

import { PATCH } from '../app/api/tasks/[id]/route';
import { getTask, updateTask } from '../lib/taskStore';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/agentAuth';

const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockFindUnique = vi.mocked(prisma.agent.findUnique);

const postingAgentId = 'agent-poster';
const otherAgentId = 'agent-other';

const baseTask = {
    id: 'task-1',
    title: 'Test Task',
    status: 'pending_verification',
    postedBy: postingAgentId,
    assignedTo: 'worker-1',
    claimedAt: new Date().toISOString(),
    reward: null,
};

const postingAgent = {
    id: postingAgentId,
    name: 'posting-agent',
    apiKeyHash: hashApiKey('posting-key'),
    callbackUrl: null,
    suspended: false,
    tasksPostedCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
};

const otherAgent = {
    id: otherAgentId,
    name: 'other-agent',
    apiKeyHash: hashApiKey('other-key'),
    callbackUrl: null,
    suspended: false,
    tasksPostedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
};

function makePatchRequest(apiKey: string, body: object) {
    return new NextRequest('http://localhost/api/tasks/task-1', {
        method: 'PATCH',
        headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateTask.mockResolvedValue({ ...baseTask, status: 'approved' } as never);
});

describe('PATCH /api/tasks/[id] — Agent Verification auth', () => {
    it('returns 200 when the posting agent approves the task', async () => {
        mockGetTask.mockResolvedValueOnce(baseTask as never);
        mockFindUnique.mockResolvedValueOnce(postingAgent as never);

        const res = await PATCH(makePatchRequest('posting-key', { approved: true }), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(200);
    });

    it('returns 403 when a different valid agent tries to verify', async () => {
        mockGetTask.mockResolvedValueOnce(baseTask as never);
        mockFindUnique.mockResolvedValueOnce(otherAgent as never);

        const res = await PATCH(makePatchRequest('other-key', { approved: true }), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toMatch(/forbidden/i);
    });

    it('returns 401 when an invalid key is provided', async () => {
        mockGetTask.mockResolvedValueOnce(baseTask as never);
        mockFindUnique.mockResolvedValueOnce(null);

        const res = await PATCH(makePatchRequest('invalid-key', { approved: true }), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(401);
    });

    it('returns 403 when a suspended agent tries to verify', async () => {
        mockGetTask.mockResolvedValueOnce(baseTask as never);
        mockFindUnique.mockResolvedValueOnce({ ...postingAgent, suspended: true } as never);

        const res = await PATCH(makePatchRequest('posting-key', { approved: true }), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(403);
    });
});
