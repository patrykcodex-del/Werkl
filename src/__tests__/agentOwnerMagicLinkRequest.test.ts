import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);
process.env.NEXTAUTH_URL = 'http://localhost:3000';

vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: {
            findUnique: vi.fn(),
        },
        agentOwnerToken: {
            create: vi.fn(),
        },
    },
}));

vi.mock('../lib/agentOwnerMagicLink', async () => {
    const actual = await vi.importActual<typeof import('../lib/agentOwnerMagicLink')>(
        '../lib/agentOwnerMagicLink',
    );
    return {
        ...actual,
        sendMagicLink: vi.fn(async () => {}),
    };
});

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue(null),
}));

import { POST } from '../app/api/auth/agent/request/route';
import { prisma } from '../lib/prisma';
import { sendMagicLink, hashMagicToken } from '../lib/agentOwnerMagicLink';

const mockAgentFind = vi.mocked(prisma.agent.findUnique);
const mockTokenCreate = vi.mocked(prisma.agentOwnerToken.create);
const mockSend = vi.mocked(sendMagicLink);

function makeRequest(body: unknown) {
    return new NextRequest('http://localhost/api/auth/agent/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockTokenCreate.mockResolvedValue({ id: 'tok-1' } as never);
});

describe('POST /api/auth/agent/request', () => {
    it('mints a single-use token and emails the magic link when email matches Agent.ownerEmail', async () => {
        mockAgentFind.mockResolvedValue({
            id: 'agent-1',
            ownerEmail: 'owner@example.com',
        } as never);

        const res = await POST(
            makeRequest({ agentId: 'agent-1', email: 'owner@example.com' }),
        );

        expect(res.status).toBe(200);

        // Token persisted, hashed (never raw), scoped to (email, agentId), with future expiry
        expect(mockTokenCreate).toHaveBeenCalledTimes(1);
        const tokenData = (mockTokenCreate.mock.calls[0][0] as any).data;
        expect(tokenData.agentId).toBe('agent-1');
        expect(tokenData.email).toBe('owner@example.com');
        expect(tokenData.tokenHash).toMatch(/^[0-9a-f]{64}$/);
        expect(tokenData.consumedAt ?? null).toBeNull();
        expect(new Date(tokenData.expiresAt).getTime()).toBeGreaterThan(Date.now());

        // Sender called once with the raw token in the URL, hashed form matches storage
        expect(mockSend).toHaveBeenCalledTimes(1);
        const [to, url] = mockSend.mock.calls[0];
        expect(to).toBe('owner@example.com');
        const rawToken = new URL(url).searchParams.get('token');
        expect(rawToken).toBeTruthy();
        expect(hashMagicToken(rawToken!)).toBe(tokenData.tokenHash);
    });

    it('returns the neutral response with no token persisted and no email sent when the Agent has no ownerEmail', async () => {
        mockAgentFind.mockResolvedValue({
            id: 'agent-1',
            ownerEmail: null,
        } as never);

        const res = await POST(
            makeRequest({ agentId: 'agent-1', email: 'someone@example.com' }),
        );

        expect(res.status).toBe(200);
        expect(mockTokenCreate).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns the neutral response (no leak) when (email, agentId) do not match', async () => {
        mockAgentFind.mockResolvedValue({
            id: 'agent-1',
            ownerEmail: 'owner@example.com',
        } as never);

        const res = await POST(
            makeRequest({ agentId: 'agent-1', email: 'someone-else@example.com' }),
        );

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual({ ok: true });
        expect(mockTokenCreate).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });

    it('returns the neutral response when the Agent does not exist', async () => {
        mockAgentFind.mockResolvedValue(null as never);

        const res = await POST(
            makeRequest({ agentId: 'agent-missing', email: 'owner@example.com' }),
        );

        expect(res.status).toBe(200);
        expect(mockTokenCreate).not.toHaveBeenCalled();
        expect(mockSend).not.toHaveBeenCalled();
    });
});
