import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);

vi.mock('../lib/taskStore', () => ({
    getTask: vi.fn(),
    updateTask: vi.fn(),
    refreshWorkerScore: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: { findUnique: vi.fn() },
    },
}));

const { mockFireAgentWebhook } = vi.hoisted(() => ({
    mockFireAgentWebhook: vi.fn(),
}));
vi.mock('../lib/agentWebhook', () => ({
    fireAgentWebhook: mockFireAgentWebhook,
}));

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue({
        user: { id: 'worker-1', email: 'worker@test.com' },
    }),
}));

import { PATCH } from '../app/api/tasks/[id]/route';
import { getTask, updateTask } from '../lib/taskStore';
import { prisma } from '../lib/prisma';
import { encryptWebhookSecret } from '../lib/webhookAuth';

const mockGetTask = vi.mocked(getTask);
const mockUpdateTask = vi.mocked(updateTask);
const mockAgentFindUnique = vi.mocked(prisma.agent.findUnique);

const claimedTask = {
    id: 'task-1',
    title: 'Test Task',
    status: 'claimed',
    postedBy: 'agent-poster',
    assignedTo: 'worker-1',
    claimedAt: new Date().toISOString(),
    reward: null,
    claimTimeoutMins: 30,
    completionMins: null,
};

function makeWorkerPatchRequest(body: object) {
    return new NextRequest('http://localhost/api/tasks/task-1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateTask.mockResolvedValue({ ...claimedTask, status: 'pending_verification' } as never);
});

describe('PATCH /api/tasks/[id] — pending_verification webhook', () => {
    it('fires the webhook to the posting agent callbackUrl when transitioning to pending_verification', async () => {
        mockGetTask.mockResolvedValue(claimedTask as never);
        mockAgentFindUnique.mockResolvedValue({
            id: 'agent-poster',
            callbackUrl: 'https://agent.example.com/webhook',
            webhookSecretEncrypted: null,
        } as never);

        const res = await PATCH(
            makeWorkerPatchRequest({ status: 'pending_verification', result: 'Done!' }),
            { params: Promise.resolve({ id: 'task-1' }) }
        );

        expect(res.status).toBe(200);
        expect(mockFireAgentWebhook).toHaveBeenCalledOnce();
        expect(mockFireAgentWebhook).toHaveBeenCalledWith(
            'https://agent.example.com/webhook',
            { taskId: 'task-1', status: 'pending_verification', title: 'Test Task' },
            null,
        );
    });

    it('does not fire the webhook when the posting agent has no callbackUrl', async () => {
        mockGetTask.mockResolvedValue(claimedTask as never);
        mockAgentFindUnique.mockResolvedValue({
            id: 'agent-poster',
            callbackUrl: null,
            webhookSecretEncrypted: null,
        } as never);

        const res = await PATCH(
            makeWorkerPatchRequest({ status: 'pending_verification', result: 'Done!' }),
            { params: Promise.resolve({ id: 'task-1' }) }
        );

        expect(res.status).toBe(200);
        expect(mockFireAgentWebhook).not.toHaveBeenCalled();
    });

    it('still returns 200 even if the agent lookup fails', async () => {
        mockGetTask.mockResolvedValue(claimedTask as never);
        mockAgentFindUnique.mockResolvedValue(null);

        const res = await PATCH(
            makeWorkerPatchRequest({ status: 'pending_verification', result: 'Done!' }),
            { params: Promise.resolve({ id: 'task-1' }) }
        );

        expect(res.status).toBe(200);
    });

    it('passes the decrypted webhookSecret as the third arg when the Agent has one stored', async () => {
        const plaintextSecret = 'a'.repeat(64);
        mockGetTask.mockResolvedValue(claimedTask as never);
        mockAgentFindUnique.mockResolvedValue({
            id: 'agent-poster',
            callbackUrl: 'https://agent.example.com/webhook',
            webhookSecretEncrypted: encryptWebhookSecret(plaintextSecret),
        } as never);

        const res = await PATCH(
            makeWorkerPatchRequest({ status: 'pending_verification', result: 'Done!' }),
            { params: Promise.resolve({ id: 'task-1' }) }
        );

        expect(res.status).toBe(200);
        expect(mockFireAgentWebhook).toHaveBeenCalledWith(
            'https://agent.example.com/webhook',
            { taskId: 'task-1', status: 'pending_verification', title: 'Test Task' },
            plaintextSecret,
        );
    });
});
