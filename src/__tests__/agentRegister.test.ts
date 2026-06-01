import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);

vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: {
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue(null),
}));

import { POST } from '../app/api/agents/register/route';
import { prisma } from '../lib/prisma';
import { hashApiKey } from '../lib/agentAuth';
import { decryptWebhookSecret } from '../lib/webhookAuth';

const mockFindFirst = vi.mocked(prisma.agent.findFirst);
const mockCreate = vi.mocked(prisma.agent.create);

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/agents/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockImplementation((async ({ data }: any) => ({
        id: 'agent-new',
        suspended: false,
        tasksPostedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        callbackUrl: null,
        ...data,
    })) as never);
});

describe('POST /api/agents/register', () => {
    it('returns 201 with both an apiKey and a webhookSecret (each 64-char hex)', async () => {
        const res = await POST(makeRequest({ name: 'agent-1' }));
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.apiKey).toMatch(/^[0-9a-f]{64}$/);
        expect(body.webhookSecret).toMatch(/^[0-9a-f]{64}$/);
        expect(body.apiKey).not.toBe(body.webhookSecret);
        expect(body.agentId).toBe('agent-new');
    });

    it('stores webhookSecretEncrypted on the Agent record (decryptable back to the returned secret)', async () => {
        const res = await POST(makeRequest({ name: 'agent-1' }));
        const { webhookSecret } = await res.json();

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const call = mockCreate.mock.calls[0][0] as any;
        expect(decryptWebhookSecret(call.data.webhookSecretEncrypted)).toBe(webhookSecret);
        expect(call.data.webhookSecretEncrypted).not.toContain(webhookSecret);
        expect(call.data.apiKeyHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('uses distinct storage formats for apiKeyHash and webhookSecretEncrypted', async () => {
        await POST(makeRequest({ name: 'agent-1' }));
        const call = mockCreate.mock.calls[0][0] as any;
        expect(call.data.apiKeyHash).not.toBe(call.data.webhookSecretEncrypted);
    });

    it('persists ownerEmail when supplied at registration', async () => {
        const res = await POST(
            makeRequest({ name: 'agent-1', ownerEmail: 'owner@example.com' }),
        );
        expect(res.status).toBe(201);
        const call = mockCreate.mock.calls[0][0] as any;
        expect(call.data.ownerEmail).toBe('owner@example.com');
    });

    it('stores ownerEmail as null when omitted', async () => {
        await POST(makeRequest({ name: 'agent-1' }));
        const call = mockCreate.mock.calls[0][0] as any;
        expect(call.data.ownerEmail).toBeNull();
    });

    it('returns 400 and does not create an Agent when ownerEmail is malformed', async () => {
        const res = await POST(
            makeRequest({ name: 'agent-1', ownerEmail: 'not-an-email' }),
        );
        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });
});
