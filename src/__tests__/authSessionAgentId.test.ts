import { describe, it, expect, vi } from 'vitest';

process.env.API_KEY_PEPPER = 'test-pepper';
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);
process.env.NEXTAUTH_SECRET = 'test-secret-test-secret-test-secret-test';

vi.mock('../lib/prisma', () => ({ prisma: {} }));

import { authOptions } from '../app/api/auth/[...nextauth]/route';

describe('NextAuth session/jwt callbacks — agentId claim', () => {
    it('propagates agentId from a JWT (set by the magic-link verify route) into session.user', async () => {
        const session = await authOptions.callbacks!.session!({
            session: {
                user: { name: null, email: 'owner@example.com', image: null },
                expires: '2099-01-01T00:00:00.000Z',
            },
            token: {
                sub: 'owner@example.com',
                email: 'owner@example.com',
                agentId: 'agent-42',
            },
        } as never);

        expect((session.user as any).agentId).toBe('agent-42');
    });

    it('omits agentId when the JWT has none (Worker OAuth signin path)', async () => {
        const session = await authOptions.callbacks!.session!({
            session: {
                user: { name: null, email: 'worker@example.com', image: null },
                expires: '2099-01-01T00:00:00.000Z',
            },
            token: {
                sub: 'user-id-1',
                email: 'worker@example.com',
            },
        } as never);

        expect((session.user as any).agentId).toBeUndefined();
    });
});
