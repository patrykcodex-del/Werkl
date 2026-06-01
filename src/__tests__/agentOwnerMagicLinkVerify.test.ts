import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

process.env.API_KEY_PEPPER = 'test-pepper';
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.NEXTAUTH_SECRET = 'test-secret-test-secret-test-secret-test';

vi.mock('../lib/prisma', () => ({
    prisma: {
        agentOwnerToken: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('../lib/workerInvite', () => ({
    gateWorkerSignIn: vi.fn(async () => false),
}));

vi.mock('next-auth', () => ({
    default: vi.fn(() => ({ GET: vi.fn(), POST: vi.fn() })),
    getServerSession: vi.fn().mockResolvedValue(null),
}));

import { GET } from '../app/api/auth/agent/verify/route';
import { prisma } from '../lib/prisma';
import { gateWorkerSignIn } from '../lib/workerInvite';
import { generateMagicToken, hashMagicToken } from '../lib/agentOwnerMagicLink';

const mockFindToken = vi.mocked(prisma.agentOwnerToken.findUnique);
const mockUpdateToken = vi.mocked(prisma.agentOwnerToken.update);
const mockGateWorker = vi.mocked(gateWorkerSignIn);

function makeRequest(token: string, agentId: string) {
    const url = new URL('http://localhost/api/auth/agent/verify');
    url.searchParams.set('token', token);
    url.searchParams.set('agentId', agentId);
    return new NextRequest(url, { method: 'GET' });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateToken.mockImplementation((async (args: any) => ({
        ...args.where,
        ...args.data,
    })) as never);
});

describe('GET /api/auth/agent/verify', () => {
    it('consumes a valid token and signals success for agentId', async () => {
        const raw = generateMagicToken();
        mockFindToken.mockResolvedValue({
            id: 'tok-1',
            tokenHash: hashMagicToken(raw),
            agentId: 'agent-1',
            email: 'owner@example.com',
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
        } as never);

        const res = await GET(makeRequest(raw, 'agent-1'));

        expect(res.status).toBeLessThan(400);

        // Token marked consumed (single-use enforced at the DB row)
        expect(mockUpdateToken).toHaveBeenCalledTimes(1);
        const updateArgs = mockUpdateToken.mock.calls[0][0] as any;
        expect(updateArgs.where).toEqual({ id: 'tok-1' });
        expect(updateArgs.data.consumedAt).toBeInstanceOf(Date);

        // The session signal carries the agentId — either as a cookie or as JSON.
        // We accept either: a Set-Cookie containing the agentId-bearing session
        // token, or a JSON body that includes agentId.
        const setCookie = res.headers.get('set-cookie') ?? '';
        const bodyText = await res.clone().text();
        expect(setCookie.length > 0 || bodyText.includes('agent-1')).toBe(true);
    });

    it('rejects an expired token without consuming it', async () => {
        const raw = generateMagicToken();
        mockFindToken.mockResolvedValue({
            id: 'tok-1',
            tokenHash: hashMagicToken(raw),
            agentId: 'agent-1',
            email: 'owner@example.com',
            expiresAt: new Date(Date.now() - 1_000),
            consumedAt: null,
        } as never);

        const res = await GET(makeRequest(raw, 'agent-1'));

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockUpdateToken).not.toHaveBeenCalled();
    });

    it('rejects a token already consumed', async () => {
        const raw = generateMagicToken();
        mockFindToken.mockResolvedValue({
            id: 'tok-1',
            tokenHash: hashMagicToken(raw),
            agentId: 'agent-1',
            email: 'owner@example.com',
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: new Date(Date.now() - 5_000),
        } as never);

        const res = await GET(makeRequest(raw, 'agent-1'));

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockUpdateToken).not.toHaveBeenCalled();
    });

    it('rejects an unknown token', async () => {
        mockFindToken.mockResolvedValue(null as never);
        const res = await GET(makeRequest(generateMagicToken(), 'agent-1'));
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockUpdateToken).not.toHaveBeenCalled();
    });

    it('rejects a token whose agentId does not match the query parameter', async () => {
        const raw = generateMagicToken();
        mockFindToken.mockResolvedValue({
            id: 'tok-1',
            tokenHash: hashMagicToken(raw),
            agentId: 'agent-1',
            email: 'owner@example.com',
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
        } as never);

        const res = await GET(makeRequest(raw, 'agent-different'));

        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(mockUpdateToken).not.toHaveBeenCalled();
    });

    it('does not invoke gateWorkerSignIn — agent-owner signin is a separate flow from Worker OAuth', async () => {
        const raw = generateMagicToken();
        mockFindToken.mockResolvedValue({
            id: 'tok-1',
            tokenHash: hashMagicToken(raw),
            agentId: 'agent-1',
            email: 'owner-not-on-worker-invite-list@example.com',
            expiresAt: new Date(Date.now() + 60_000),
            consumedAt: null,
        } as never);

        const res = await GET(makeRequest(raw, 'agent-1'));

        // Worker gate is mocked to always deny; verify route must succeed regardless.
        expect(res.status).toBeLessThan(400);
        expect(mockGateWorker).not.toHaveBeenCalled();
    });
});
