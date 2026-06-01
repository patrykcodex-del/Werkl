import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.API_KEY_PEPPER = 'test-pepper';

vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: { findUnique: vi.fn() },
        task: { count: vi.fn(), findFirst: vi.fn() },
    },
}));

vi.mock('../lib/taskStore', () => ({
    createTask: vi.fn(),
    listTasksPaged: vi.fn(),
}));

import { POST } from '../app/api/tasks/route';
import { prisma } from '../lib/prisma';
import { createTask } from '../lib/taskStore';
import { hashApiKey } from '../lib/agentAuth';
import { NextRequest } from 'next/server';

const mockAgentFind = vi.mocked(prisma.agent.findUnique);
const mockTaskCount = vi.mocked(prisma.task.count);
const mockTaskFindFirst = vi.mocked(prisma.task.findFirst);
const mockCreateTask = vi.mocked(createTask);

const fakeAgent = {
    id: 'agent-1',
    name: 'test-agent',
    apiKeyHash: hashApiKey('valid-key'),
    webhookSecretEncrypted: null,
    callbackUrl: null,
    ownerEmail: null,
    suspended: false,
    tasksPostedCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
};

function makePostRequest(body: unknown, apiKey = 'valid-key') {
    return new NextRequest('http://localhost/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    process.env.AGENT_TASK_POST_LIMIT_PER_HOUR = '2';
});

describe('POST /api/tasks rate limiting', () => {
    it('returns 429 with a Retry-After header when the agent exceeds the per-hour limit', async () => {
        mockAgentFind.mockResolvedValue(fakeAgent);
        mockTaskCount.mockResolvedValueOnce(2); // at limit
        const oldest = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
        mockTaskFindFirst.mockResolvedValueOnce({ createdAt: oldest } as never);

        const res = await POST(makePostRequest({ title: 't', description: 'd' }));

        expect(res.status).toBe(429);
        const retryAfter = res.headers.get('Retry-After');
        expect(retryAfter).not.toBeNull();
        expect(parseInt(retryAfter!, 10)).toBeGreaterThan(0);
        expect(mockCreateTask).not.toHaveBeenCalled();
    });

    it('still allows posting when below the limit', async () => {
        mockAgentFind.mockResolvedValue(fakeAgent);
        mockTaskCount.mockResolvedValueOnce(1);
        mockCreateTask.mockResolvedValueOnce({ id: 'task-1' } as never);

        const res = await POST(makePostRequest({ title: 't', description: 'd' }));

        expect(res.status).toBe(201);
        expect(mockCreateTask).toHaveBeenCalled();
    });
});
