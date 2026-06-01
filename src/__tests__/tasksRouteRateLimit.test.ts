import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.API_KEY_PEPPER = 'test-pepper';

vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: { findUnique: vi.fn() },
        task: { count: vi.fn(), findFirst: vi.fn() },
        agentBalance: { findUnique: vi.fn(), update: vi.fn() },
        balanceLedger: { create: vi.fn() },
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
const mockAgentBalanceFindUnique = vi.mocked(prisma.agentBalance.findUnique);
const mockAgentBalanceUpdate = vi.mocked(prisma.agentBalance.update);
const mockBalanceLedgerCreate = vi.mocked(prisma.balanceLedger.create);
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
    mockAgentBalanceFindUnique.mockResolvedValue({ agentId: 'agent-1', balanceCents: 600, currency: 'USD' } as never);
    mockAgentBalanceUpdate.mockResolvedValue({} as never);
    mockBalanceLedgerCreate.mockResolvedValue({} as never);
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

    it('stores a 15% fee and debits reward plus fee for a USD task', async () => {
        mockAgentFind.mockResolvedValue(fakeAgent);
        mockTaskCount.mockResolvedValueOnce(0);
        mockCreateTask.mockResolvedValueOnce({ id: 'task-1', feeCents: 75, rewardCents: 500 } as never);

        const res = await POST(makePostRequest({
            title: 't',
            description: 'd',
            reward: { amount: 5, currency: 'USD' },
        }));

        expect(res.status).toBe(201);
        expect(mockCreateTask).toHaveBeenCalledWith(expect.objectContaining({ feeCents: 75 }));
        expect(mockAgentBalanceUpdate).toHaveBeenCalledWith({
            where: { agentId: 'agent-1' },
            data: { balanceCents: { decrement: 575 } },
        });
        expect(mockBalanceLedgerCreate).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ amountCents: -575, type: 'post_task' }),
        }));
    });

    it('returns 402 when balance cannot cover reward plus fee', async () => {
        mockAgentFind.mockResolvedValue(fakeAgent);
        mockTaskCount.mockResolvedValueOnce(0);
        mockAgentBalanceFindUnique.mockResolvedValueOnce({ agentId: 'agent-1', balanceCents: 550, currency: 'USD' } as never);

        const res = await POST(makePostRequest({
            title: 't',
            description: 'd',
            reward: { amount: 5, currency: 'USD' },
        }));

        expect(res.status).toBe(402);
        expect(mockCreateTask).not.toHaveBeenCalled();
        expect(mockAgentBalanceUpdate).not.toHaveBeenCalled();
    });

    it('rejects non-USD reward currency', async () => {
        mockAgentFind.mockResolvedValue(fakeAgent);
        mockTaskCount.mockResolvedValueOnce(0);

        const res = await POST(makePostRequest({
            title: 't',
            description: 'd',
            reward: { amount: 5, currency: 'EUR' },
        }));

        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe('Unsupported Currency');
        expect(mockCreateTask).not.toHaveBeenCalled();
    });
});
