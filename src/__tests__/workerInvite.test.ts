import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
    prisma: {
        workerInvite: {
            findUnique: vi.fn(),
            update: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

import { gateWorkerSignIn, inviteWorker } from '../lib/workerInvite';
import { prisma } from '../lib/prisma';

const mockFind = vi.mocked(prisma.workerInvite.findUnique);
const mockUpdate = vi.mocked(prisma.workerInvite.update);
const mockUpsert = vi.mocked(prisma.workerInvite.upsert);

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

    it('rejects (without throwing) when the Invite lookup errors', async () => {
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockFind.mockRejectedValueOnce(
            new Error('The table `public.WorkerInvite` does not exist in the current database.'),
        );

        const result = await gateWorkerSignIn({ email: 'worker@example.com' });

        expect(result).toBe(false);
        // The original error should be logged server-side, never returned to the caller.
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});

describe('inviteWorker', () => {
    it('upserts an Invite with the supplied email and invitedBy', async () => {
        mockUpsert.mockResolvedValueOnce({
            email: 'new@example.com',
            invitedAt: new Date(),
            invitedBy: 'operator',
            usedAt: null,
        } as never);

        await inviteWorker({ email: 'new@example.com', invitedBy: 'operator' });

        expect(mockUpsert).toHaveBeenCalledTimes(1);
        const call = mockUpsert.mock.calls[0][0] as {
            where: { email: string };
            create: { email: string; invitedBy?: string };
            update: Record<string, never>;
        };
        expect(call.where).toEqual({ email: 'new@example.com' });
        expect(call.create.email).toBe('new@example.com');
        expect(call.create.invitedBy).toBe('operator');
        expect(call.update).toEqual({});
    });

    it('normalizes the email to lowercase and trims whitespace', async () => {
        mockUpsert.mockResolvedValueOnce({} as never);

        await inviteWorker({ email: '  Worker@Example.COM  ' });

        const call = mockUpsert.mock.calls[0][0] as { where: { email: string } };
        expect(call.where.email).toBe('worker@example.com');
    });

    it('rejects an empty email', async () => {
        await expect(inviteWorker({ email: '   ' })).rejects.toThrow(/email/i);
        expect(mockUpsert).not.toHaveBeenCalled();
    });
});
