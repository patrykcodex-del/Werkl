'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { EarningEntry, UserEarnings } from '../../types';
import type { PayoutRequest } from '../../lib/earningsStore';

function formatCurrency(amount: number, currency: string) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

export default function EarningsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [earnings, setEarnings] = useState<UserEarnings | null>(null);
    const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [stripeAccountId, setStripeAccountId] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [payoutMessage, setPayoutMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/auth/signin');
    }, [status, router]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        fetch('/api/payouts')
            .then((r) => r.json())
            .then(({ earnings, payouts }) => {
                setEarnings(earnings);
                setPayouts(payouts);
                setLoading(false);
            });
    }, [status]);

    async function handleRequestPayout() {
        setRequesting(true);
        setPayoutMessage(null);
        const res = await fetch('/api/payouts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stripeAccountId: stripeAccountId.trim() || undefined }),
        });
        const data = await res.json();
        if (res.ok) {
            setPayoutMessage({
                type: 'success',
                text: data.payout.status === 'paid'
                    ? `Payment of ${formatCurrency(data.payout.amount, data.payout.currency)} sent via Stripe!`
                    : `Payout request of ${formatCurrency(data.payout.amount, data.payout.currency)} submitted.`,
            });
            const refresh = await fetch('/api/payouts').then((r) => r.json());
            setEarnings(refresh.earnings);
            setPayouts(refresh.payouts);
        } else {
            setPayoutMessage({ type: 'error', text: data.error ?? 'Something went wrong.' });
        }
        setRequesting(false);
    }

    if (loading || status === 'loading') {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    const pendingEntries = earnings?.entries.filter((e) => !e.paidOut) ?? [];
    const paidEntries = earnings?.entries.filter((e) => e.paidOut) ?? [];

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Earnings</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track your rewards and request payouts.</p>
            </div>

            {/* Balance card */}
            <div
                className="rounded-xl border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
                <div>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Available balance</p>
                    <p className="font-mono text-4xl font-bold" style={{ color: 'var(--green)' }}>
                        {formatCurrency(earnings?.balance ?? 0, earnings?.currency ?? 'USD')}
                    </p>
                </div>
                {(earnings?.balance ?? 0) > 0 && (
                    <div className="w-full sm:w-auto space-y-3">
                        <input
                            type="text"
                            placeholder="Stripe account ID (optional)"
                            value={stripeAccountId}
                            onChange={(e) => setStripeAccountId(e.target.value)}
                            className="w-full sm:w-64 rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1"
                            style={{
                                borderColor: 'var(--border)',
                                color: 'var(--text-primary)',
                                focusRingColor: 'var(--accent)',
                            }}
                        />
                        <button
                            onClick={handleRequestPayout}
                            disabled={requesting}
                            className="w-full py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                        >
                            {requesting ? 'Processing…' : 'Request payout'}
                        </button>
                    </div>
                )}
            </div>

            {/* Message */}
            {payoutMessage && (
                <div
                    className="rounded-lg border px-4 py-3 text-sm"
                    style={{
                        borderColor: payoutMessage.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(248,113,113,0.3)',
                        color: payoutMessage.type === 'success' ? 'var(--green)' : 'var(--red)',
                        backgroundColor: payoutMessage.type === 'success' ? 'rgba(52,211,153,0.05)' : 'rgba(248,113,113,0.05)',
                    }}
                >
                    {payoutMessage.text}
                </div>
            )}

            {/* Pending earnings */}
            {pendingEntries.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Pending earnings</h2>
                    <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                        {pendingEntries.map((entry: EarningEntry) => (
                            <div key={entry.taskId} className="flex items-center justify-between px-5 py-4" style={{ borderColor: 'var(--border-dim)' }}>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{entry.taskTitle}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(entry.earnedAt).toLocaleDateString()}</p>
                                </div>
                                <span className="font-mono text-sm font-semibold" style={{ color: 'var(--green)' }}>
                                    {formatCurrency(entry.amount, entry.currency)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payout history */}
            {payouts.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Payout history</h2>
                    <div className="rounded-xl border divide-y" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                        {payouts.map((p: PayoutRequest) => (
                            <div key={p.id} className="flex items-center justify-between px-5 py-4" style={{ borderColor: 'var(--border-dim)' }}>
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</p>
                                    {p.stripePayoutId && (
                                        <p className="font-mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Stripe: {p.stripePayoutId}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{formatCurrency(p.amount, p.currency)}</p>
                                    <span
                                        className="font-mono text-xs"
                                        style={{
                                            color: p.status === 'paid' ? 'var(--green)' :
                                                p.status === 'failed' ? 'var(--red)' :
                                                'var(--amber)',
                                        }}
                                    >
                                        {p.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {earnings?.entries.length === 0 && (
                <div className="rounded-xl border py-16 text-center" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                    <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>No earnings yet</p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Complete tasks and get them approved to start earning.</p>
                    <a
                        href="/"
                        className="inline-block mt-4 px-5 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
                        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                        Browse tasks
                    </a>
                </div>
            )}

            {paidEntries.length > 0 && null}
        </div>
    );
}
