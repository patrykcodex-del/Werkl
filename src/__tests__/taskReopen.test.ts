import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';

const { mockTxBlockUpsert, mockTxTaskUpdate } = vi.hoisted(() => ({
    mockTxBlockUpsert: vi.fn(),
    mockTxTaskUpdate: vi.fn(),
}));

vi.mock('../lib/taskStore', () => ({
    getTask: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        $transaction: vi.fn((cb: (tx: unknown) => unknown) =>
            cb({
                taskWorkerBlock: { upsert: mockTxBlockUpsert },
                task: { update: mockTxTaskUpdate },
            })
        ),
        agent: { findUnique: vi.fn() },
    },
}));

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue(null),
}));

import { POST } from '../app/api/tasks/[id]/reopen/route';
import { getTask } from '../lib/taskStore';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/agentAuth';

const mockGetTask = vi.mocked(getTask);
const mockAgentFindUnique = vi.mocked(prisma.agent.findUnique);

const postingAgentId = 'agent-poster';
const otherAgentId = 'agent-other';

const rejectedTask = {
    id: 'task-1',
    title: 'Test Task',
    status: 'rejected',
    postedBy: postingAgentId,
    assignedTo: 'worker-1',
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

function makePostRequest(apiKey: string | null) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (apiKey !== null) headers['x-api-key'] = apiKey;
    return new NextRequest('http://localhost/api/tasks/task-1/reopen', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockTxTaskUpdate.mockResolvedValue({ ...rejectedTask, status: 'open', assignedTo: null });
    mockTxBlockUpsert.mockResolvedValue({});
});

describe('POST /api/tasks/[id]/reopen', () => {
    it('returns 200 and transitions rejected → open for the posting Agent', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(postingAgent as never);
        mockGetTask.mockResolvedValueOnce(rejectedTask as never);

        const res = await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('open');
        expect(body.assignedTo).toBeNull();
    });

    it('creates a TaskWorkerBlock for the previously-assigned Worker', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(postingAgent as never);
        mockGetTask.mockResolvedValueOnce(rejectedTask as never);

        await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(mockTxBlockUpsert).toHaveBeenCalledWith({
            where: { taskId_workerId: { taskId: 'task-1', workerId: 'worker-1' } },
            create: { taskId: 'task-1', workerId: 'worker-1' },
            update: {},
        });
    });

    it('clears assignedTo on the updated Task', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(postingAgent as never);
        mockGetTask.mockResolvedValueOnce(rejectedTask as never);

        await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(mockTxTaskUpdate).toHaveBeenCalledWith({
            where: { id: 'task-1' },
            data: { status: 'open', assignedTo: null },
        });
    });

    it('returns 409 if the Task is not in rejected status', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(postingAgent as never);
        mockGetTask.mockResolvedValueOnce({ ...rejectedTask, status: 'open' } as never);

        const res = await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(409);
    });

    it('returns 401 when no API key is provided', async () => {
        const res = await POST(makePostRequest(null), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(401);
        expect(mockGetTask).not.toHaveBeenCalled();
    });

    it('returns 401 when an invalid key is provided', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(null);

        const res = await POST(makePostRequest('invalid-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(401);
    });

    it('returns 403 when a different valid Agent tries to reopen', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(otherAgent as never);
        mockGetTask.mockResolvedValueOnce(rejectedTask as never);

        const res = await POST(makePostRequest('other-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toMatch(/forbidden/i);
    });

    it('returns 403 for a suspended Agent', async () => {
        mockAgentFindUnique.mockResolvedValueOnce({ ...postingAgent, suspended: true } as never);

        const res = await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(res.status).toBe(403);
    });

    it('returns 404 when the Task does not exist', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(postingAgent as never);
        mockGetTask.mockResolvedValueOnce(null as never);

        const res = await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'nonexistent' }),
        });

        expect(res.status).toBe(404);
    });

    it('does not create a TaskWorkerBlock if no worker was assigned', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(postingAgent as never);
        mockGetTask.mockResolvedValueOnce({ ...rejectedTask, assignedTo: null } as never);

        await POST(makePostRequest('posting-key'), {
            params: Promise.resolve({ id: 'task-1' }),
        });

        expect(mockTxBlockUpsert).not.toHaveBeenCalled();
    });
});
