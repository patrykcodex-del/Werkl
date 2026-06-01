import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
    prisma: {
        workerInvite: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

import { gateWorkerSignIn } from '../lib/workerInvite';
import { prisma } from '../lib/prisma';

const mockFind = vi.mocked(prisma.workerInvite.findUnique);
const mockUpdate = vi.mocked(prisma.workerInvite.update);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('gateWorkerSignIn', () => {
    it('rejects when the email has no Invite', async () => {
        mockFind.mockResolvedValueOnce(null);
        const result = await gateWorkerSignIn({ email: 'stranger@example.com' });
        expect(result).toBe(false);
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('rejects when no email is provided', async () => {
        const result = await gateWorkerSignIn({ email: null });
        expect(result).toBe(false);
        expect(mockFind).not.toHaveBeenCalled();
    });

    it('allows when the email has an unused Invite', async () => {
        mockFind.mockResolvedValueOnce({
            email: 'worker@example.com',
            invitedAt: new Date('2026-05-01'),
            invitedBy: 'operator',
            usedAt: null,
        } as never);
        mockUpdate.mockResolvedValueOnce({} as never);

        const result = await gateWorkerSignIn({ email: 'worker@example.com' });

        expect(result).toBe(true);
    });

    it('stamps usedAt on the Invite the first time the Worker signs in', async () => {
        mockFind.mockResolvedValueOnce({
            email: 'worker@example.com',
            invitedAt: new Date('2026-05-01'),
            invitedBy: 'operator',
            usedAt: null,
        } as never);
        mockUpdate.mockResolvedValueOnce({} as never);

        await gateWorkerSignIn({ email: 'worker@example.com' });

        expect(mockUpdate).toHaveBeenCalledTimes(1);
        const call = mockUpdate.mock.calls[0][0] as { where: { email: string }; data: { usedAt: Date } };
        expect(call.where).toEqual({ email: 'worker@example.com' });
        expect(call.data.usedAt).toBeInstanceOf(Date);
    });

    it('does not overwrite usedAt on subsequent signins', async () => {
        mockFind.mockResolvedValueOnce({
            email: 'worker@example.com',
            invitedAt: new Date('2026-05-01'),
            invitedBy: 'operator',
            usedAt: new Date('2026-05-02'),
        } as never);

        const result = await gateWorkerSignIn({ email: 'worker@example.com' });

        expect(result).toBe(true);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
