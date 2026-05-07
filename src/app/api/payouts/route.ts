import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import {
    getEarnings,
    createPayoutRequest,
    updatePayoutRequest,
    listPayoutRequests,
} from '../../../lib/earningsStore';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
    apiVersion: '2026-04-22.dahlia',
});

function getUserId(session: Session | null): string | null {
    if (!session?.user) return null;
    return (session.user as { id?: string; email?: string | null }).id ?? session.user.email ?? null;
}

// GET /api/payouts — get earnings summary + payout history
export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const earnings = await getEarnings(userId);
    const payouts = await listPayoutRequests(userId);
    return NextResponse.json({ earnings, payouts });
}

// POST /api/payouts — request a payout
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    const userId = getUserId(session);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const earnings = await getEarnings(userId);
    if (earnings.balance <= 0) {
        return NextResponse.json({ error: 'No balance available to pay out' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { stripeAccountId } = body; // user's connected Stripe account ID

    const payout = await createPayoutRequest(userId, earnings.balance, earnings.currency);

    // If Stripe is configured and the user provided their connected account ID,
    // attempt a real Stripe transfer
    if (process.env.STRIPE_SECRET_KEY && stripeAccountId) {
        try {
            const amountInCents = Math.round(payout.amount * 100);
            const transfer = await stripe.transfers.create({
                amount: amountInCents,
                currency: payout.currency.toLowerCase(),
                destination: stripeAccountId,
                description: `Werkl.ai payout for ${userId}`,
            });
            await updatePayoutRequest(payout.id, {
                status: 'paid',
                stripePayoutId: transfer.id,
            });
            return NextResponse.json({ payout: { ...payout, status: 'paid', stripePayoutId: transfer.id } });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            await updatePayoutRequest(payout.id, { status: 'failed' });
            return NextResponse.json({ error: `Stripe transfer failed: ${message}` }, { status: 502 });
        }
    }

    // No Stripe account provided — record as pending for manual processing
    return NextResponse.json({ payout });
}
