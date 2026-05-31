import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);
process.env.OPERATOR_API_KEY = 'operator-secret';

vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue(null),
}));

import { POST } from '../app/api/agents/[agentId]/reset-webhook-secret/route';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/agentAuth';
import { decryptWebhookSecret } from '../lib/webhookAuth';

const mockAgentFindUnique = vi.mocked(prisma.agent.findUnique);
const mockAgentUpdate = vi.mocked(prisma.agent.update);

const existingAgent = {
    id: 'agent-1',
    name: 'existing-agent',
    apiKeyHash: hashApiKey('existing-key'),
    webhookSecretEncrypted: 'old-encrypted-blob',
    callbackUrl: 'https://example.com/cb',
    suspended: false,
    tasksPostedCount: 7,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
};

function makeRequest(operatorKey: string | null) {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (operatorKey !== null) headers['x-operator-key'] = operatorKey;
    return new NextRequest('http://localhost/api/agents/agent-1/reset-webhook-secret', {
        method: 'POST',
        headers,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('POST /api/agents/[agentId]/reset-webhook-secret', () => {
    it('returns 401 when the operator key is missing', async () => {
        const res = await POST(makeRequest(null), {
            params: Promise.resolve({ agentId: 'agent-1' }),
        });
        expect(res.status).toBe(401);
        expect(mockAgentFindUnique).not.toHaveBeenCalled();
        expect(mockAgentUpdate).not.toHaveBeenCalled();
    });

    it('returns 404 when the Agent does not exist', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(null);
        const res = await POST(makeRequest('operator-secret'), {
            params: Promise.resolve({ agentId: 'missing' }),
        });
        expect(res.status).toBe(404);
        expect(mockAgentUpdate).not.toHaveBeenCalled();
    });

    it('returns 200 with a fresh plaintext webhookSecret and the agentId', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(existingAgent as never);
        mockAgentUpdate.mockImplementationOnce((async ({ data, where }: any) => ({
            ...existingAgent,
            ...data,
            id: where.id,
        })) as never);

        const res = await POST(makeRequest('operator-secret'), {
            params: Promise.resolve({ agentId: 'agent-1' }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.agentId).toBe('agent-1');
        expect(body.webhookSecret).toMatch(/^[0-9a-f]{64}$/);
    });

    it('writes only webhookSecretEncrypted, preserving apiKeyHash and other fields', async () => {
        mockAgentFindUnique.mockResolvedValueOnce({ ...existingAgent, suspended: true } as never);
        mockAgentUpdate.mockImplementationOnce((async ({ data, where }: any) => ({
            ...existingAgent,
            suspended: true,
            ...data,
            id: where.id,
        })) as never);

        await POST(makeRequest('operator-secret'), {
            params: Promise.resolve({ agentId: 'agent-1' }),
        });

        expect(mockAgentUpdate).toHaveBeenCalledTimes(1);
        const call = mockAgentUpdate.mock.calls[0][0] as any;
        expect(call.where).toEqual({ id: 'agent-1' });
        expect(Object.keys(call.data)).toEqual(['webhookSecretEncrypted']);
        expect(call.data.webhookSecretEncrypted).not.toBe(existingAgent.webhookSecretEncrypted);
    });

    it('persists an encrypted blob that decrypts back to the returned plaintext', async () => {
        mockAgentFindUnique.mockResolvedValueOnce(existingAgent as never);
        let writtenEncrypted: string | undefined;
        mockAgentUpdate.mockImplementationOnce((async ({ data, where }: any) => {
            writtenEncrypted = data.webhookSecretEncrypted;
            return { ...existingAgent, ...data, id: where.id };
        }) as never);

        const res = await POST(makeRequest('operator-secret'), {
            params: Promise.resolve({ agentId: 'agent-1' }),
        });
        const { webhookSecret } = await res.json();

        expect(decryptWebhookSecret(writtenEncrypted!)).toBe(webhookSecret);
    });
});
