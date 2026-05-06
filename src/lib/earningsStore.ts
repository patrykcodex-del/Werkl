import { prisma } from './prisma';
import type { EarningEntry, UserEarnings } from '../types';

// ─── Earnings ─────────────────────────────────────────────────────────────────

export async function getEarnings(userId: string): Promise<UserEarnings> {
    const entries = await prisma.earningEntry.findMany({
        where: { userId },
        orderBy: { earnedAt: 'desc' },
    });
    const balance = entries
        .filter((e) => !e.paidOut)
        .reduce((sum, e) => sum + e.amount, 0);

    return {
        userId,
        balance,
        currency: 'USD',
        entries: entries.map((e) => ({
            taskId: e.taskId,
            taskTitle: e.taskTitle,
            amount: e.amount,
            currency: e.currency,
            earnedAt: e.earnedAt.toISOString(),
            paidOut: e.paidOut,
        })),
    };
}

export async function creditEarning(
    userId: string,
    entry: Omit<EarningEntry, 'paidOut'>,
): Promise<void> {
    await prisma.earningEntry.create({
        data: {
            userId,
            taskId: entry.taskId,
            taskTitle: entry.taskTitle,
            amount: entry.amount,
            currency: entry.currency,
            earnedAt: new Date(entry.earnedAt),
        },
    });
}

export async function markPaidOut(userId: string, taskId: string): Promise<boolean> {
    const entry = await prisma.earningEntry.findFirst({
        where: { userId, taskId, paidOut: false },
    });
    if (!entry) return false;
    await prisma.earningEntry.update({
        where: { id: entry.id },
        data: { paidOut: true },
    });
    return true;
}

// ─── Payout Requests ──────────────────────────────────────────────────────────

export interface PayoutRequest {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'processing' | 'paid' | 'failed';
    createdAt: string;
    stripePayoutId?: string;
}

function toPayoutRequest(p: {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: string;
    createdAt: Date;
    stripePayoutId: string | null;
}): PayoutRequest {
    return {
        id: p.id,
        userId: p.userId,
        amount: p.amount,
        currency: p.currency,
        status: p.status as PayoutRequest['status'],
        createdAt: p.createdAt.toISOString(),
        stripePayoutId: p.stripePayoutId ?? undefined,
    };
}

export async function createPayoutRequest(
    userId: string,
    amount: number,
    currency: string,
): Promise<PayoutRequest> {
    const row = await prisma.payoutRequest.create({
        data: { userId, amount, currency },
    });
    return toPayoutRequest(row);
}

export async function getPayoutRequest(id: string): Promise<PayoutRequest | undefined> {
    const row = await prisma.payoutRequest.findUnique({ where: { id } });
    return row ? toPayoutRequest(row) : undefined;
}

export async function updatePayoutRequest(
    id: string,
    patch: Partial<PayoutRequest>,
): Promise<PayoutRequest | undefined> {
    try {
        const row = await prisma.payoutRequest.update({
            where: { id },
            data: {
                ...(patch.status && { status: patch.status }),
                ...(patch.stripePayoutId !== undefined && { stripePayoutId: patch.stripePayoutId }),
            },
        });
        return toPayoutRequest(row);
    } catch {
        return undefined;
    }
}

export async function listPayoutRequests(userId: string): Promise<PayoutRequest[]> {
    const rows = await prisma.payoutRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPayoutRequest);
}
