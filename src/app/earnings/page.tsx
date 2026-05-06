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
                <span className="text-xs animate-pulse tracking-widest" style={{ color: 'var(--terminal-green-dim)' }}>
                    [loading earnings data...]
                </span>
            </div>
        );
    }

    const pendingEntries = earnings?.entries.filter((e) => !e.paidOut) ?? [];
    const paidEntries = earnings?.entries.filter((e) => e.paidOut) ?? [];

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            {/* Header */}
            <div className="border-b pb-4" style={{ borderColor: 'var(--terminal-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--terminal-green-dim)' }}>$ earnings --user</p>
                <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>earnings</h1>
                <p className="text-xs mt-1" style={{ color: 'var(--terminal-green-dim)' }}>// track rewards and request payouts</p>
            </div>

            {/* Balance panel */}
            <div
                className="border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                style={{ borderColor: 'var(--terminal-border)', backgroundColor: 'var(--terminal-surface)' }}
            >
                <div>
                    <p className="text-xs tracking-wider mb-1" style={{ color: 'var(--terminal-green-dim)' }}>available_balance</p>
                    <p className="text-4xl font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>
                        {formatCurrency(earnings?.balance ?? 0, earnings?.currency ?? 'USD')}
                    </p>
                </div>
                {(earnings?.balance ?? 0) > 0 && (
                    <div className="w-full sm:w-auto space-y-3">
                        <input
                            type="text"
                            placeholder="stripe_account_id (optional)"
                            value={stripeAccountId}
                            onChange={(e) => setStripeAccountId(e.target.value)}
                            className="w-full sm:w-64 border bg-transparent px-3 py-2 text-xs tracking-wider focus:outline-none"
                            style={{
                                borderColor: 'var(--terminal-border)',
                                color: 'var(--terminal-green)',
                            }}
                        />
                        <button
                            onClick={handleRequestPayout}
                            disabled={requesting}
                            className="w-full py-2 text-xs tracking-widest border transition-colors disabled:opacity-50 hover:bg-green-950/40"
                            style={{ color: 'var(--terminal-green)', borderColor: 'var(--terminal-green)' }}
                        >
                            {requesting ? '[processing...]' : '> request_payout()'}
                        </button>
                    </div>
                )}
            </div>

            {/* Message */}
            {payoutMessage && (
                <div
                    className="border px-4 py-3 text-xs tracking-wider"
                    style={{
                        borderColor: payoutMessage.type === 'success' ? 'var(--terminal-green-dim)' : 'var(--terminal-red)',
                        color: payoutMessage.type === 'success' ? 'var(--terminal-green)' : 'var(--terminal-red)',
                        backgroundColor: 'var(--terminal-surface)',
                    }}
                >
                    {payoutMessage.type === 'success' ? '[OK] ' : '[ERR] '}{payoutMessage.text}
                </div>
            )}

            {/* Pending earnings */}
            {pendingEntries.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-sm tracking-widest" style={{ color: 'var(--terminal-green)' }}>&gt; pending_earnings</h2>
                    <div className="border divide-y" style={{ borderColor: 'var(--terminal-border)' }}>
                        {pendingEntries.map((entry: EarningEntry) => (
                            <div
                                key={entry.taskId}
                                className="flex items-center justify-between px-4 py-3"
                                style={{ borderColor: 'var(--terminal-border)' }}
                            >
                                <div>
                                    <p className="text-xs tracking-wide" style={{ color: 'var(--terminal-green)' }}>{entry.taskTitle}</p>
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--terminal-green-dim)' }}>
                                        {new Date(entry.earnedAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className="text-sm font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>
                                    {formatCurrency(entry.amount, entry.currency)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Payout history */}
            {payouts.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-sm tracking-widest" style={{ color: 'var(--terminal-green)' }}>&gt; payout_history</h2>
                    <div className="border divide-y" style={{ borderColor: 'var(--terminal-border)' }}>
                        {payouts.map((p: PayoutRequest) => (
                            <div key={p.id} className="flex items-center justify-between px-4 py-3" style={{ borderColor: 'var(--terminal-border)' }}>
                                <div>
                                    <p className="text-xs" style={{ color: 'var(--terminal-green-dim)' }}>{new Date(p.createdAt).toLocaleDateString()}</p>
                                    {p.stripePayoutId && (
                                        <p className="text-xs mt-0.5" style={{ color: 'var(--terminal-green-dim)' }}>stripe:{p.stripePayoutId}</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>
                                        {formatCurrency(p.amount, p.currency)}
                                    </p>
                                    <span
                                        className="text-xs tracking-wider"
                                        style={{
                                            color: p.status === 'paid' ? 'var(--terminal-green)' :
                                                p.status === 'failed' ? 'var(--terminal-red)' :
                                                'var(--terminal-amber)',
                                        }}
                                    >
                                        [{p.status}]
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {earnings?.entries.length === 0 && (
                <div className="border py-16 text-center" style={{ borderColor: 'var(--terminal-border)', backgroundColor: 'var(--terminal-surface)' }}>
                    <p className="text-sm tracking-wider" style={{ color: 'var(--terminal-green-dim)' }}>// no earnings found</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--terminal-green-dim)' }}>complete and get tasks approved to start earning</p>
                    <a
                        href="/tasks"
                        className="inline-block mt-4 px-4 py-2 text-xs tracking-widest border transition-colors hover:bg-green-950/40"
                        style={{ color: 'var(--terminal-green)', borderColor: 'var(--terminal-green-dim)' }}
                    >
                        &gt; browse_tasks()
                    </a>
                </div>
            )}

            {/* suppress unused var */}
            {paidEntries.length > 0 && null}
        </div>
    );
}
