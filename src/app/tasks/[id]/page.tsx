'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';

import type { Task, ReleaseReason } from '../../../types';
import { RELEASE_REASON_LABELS } from '../../../types';
import { useCountdown } from '../../../hooks/useCountdown';

// Grace window in seconds — must match server config in releaseTask.ts
const RELEASE_GRACE_SECS = 30;

const priorityStyles: Record<Task['priority'], { color: string; bg: string }> = {
    low:    { color: 'var(--text-muted)',  bg: 'rgba(71,85,105,0.2)' },
    medium: { color: 'var(--accent)',      bg: 'var(--accent-glow)' },
    high:   { color: 'var(--amber)',       bg: 'rgba(251,191,36,0.1)' },
    urgent: { color: 'var(--red)',         bg: 'rgba(248,113,113,0.1)' },
};

function formatReward(reward: Task['reward']): string | null {
    if (!reward) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: reward.currency }).format(reward.amount);
}

function formatDuration(mins: number): string {
    if (mins < 60) return `~${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function TaskDetailPage({ params }: PageProps) {
    const { data: session } = useSession();
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [result, setResult] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [id, setId] = useState<string | null>(null);

    // Release state
    const [releasing, setReleasing] = useState(false);
    const [releaseReason, setReleaseReason] = useState<ReleaseReason | ''>('');
    const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
    const [graceSecsLeft, setGraceSecsLeft] = useState<number | null>(null);

    useEffect(() => {
        params.then(({ id }) => setId(id));
    }, [params]);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/tasks/${id}`)
            .then((r) => r.json())
            .then((data) => { setTask(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    // Grace window countdown — ticks every second while task is claimed by this user
    useEffect(() => {
        if (!task?.claimedAt) { setGraceSecsLeft(null); return; }
        const claimedMs = new Date(task.claimedAt).getTime();
        const graceEndsMs = claimedMs + RELEASE_GRACE_SECS * 1000;

        function tick() {
            const left = Math.max(0, Math.ceil((graceEndsMs - Date.now()) / 1000));
            setGraceSecsLeft(left);
        }
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [task?.claimedAt]);

    const handleRelease = useCallback(async () => {
        if (!id) return;
        setReleasing(true);
        setShowReleaseConfirm(false);
        try {
            const res = await fetch(`/api/tasks/${id}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(releaseReason ? { reason: releaseReason } : {}),
            });
            if (res.ok) {
                // Navigate back to work so the worker immediately gets a new offer
                window.location.href = '/work';
            } else {
                const data = await res.json();
                alert(data.error ?? 'Could not release task.');
                setReleasing(false);
            }
        } catch {
            alert('Network error — could not release task.');
            setReleasing(false);
        }
    }, [id, releaseReason]);

    const userId = (session?.user as { id?: string; email?: string | null } | undefined)?.id ?? session?.user?.email;
    const isAssignee = !!(task?.assignedTo && userId && task.assignedTo === userId);
    const rewardLabel = formatReward(task?.reward ?? undefined);

    const expiryCountdown = useCountdown(task?.status === 'open' ? task.expiresAt : undefined);
    const deadlineCountdown = useCountdown(
        task?.status === 'claimed' ? (task.completionDeadline ?? task.claimExpiresAt) : undefined
    );

    async function handleClaim() {
        if (!session) { signIn('google', {}, { prompt: 'select_account' }); return; }
        setClaiming(true);
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'claimed' }),
        });
        if (res.ok) setTask(await res.json());
        setClaiming(false);
    }

    async function handleSubmitResult() {
        if (!result.trim()) return;
        setSubmitting(true);
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending_verification', result }),
        });
        if (res.ok) setTask(await res.json());
        setSubmitting(false);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div
                    className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="text-center py-24 space-y-3">
                <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>Task not found.</p>
                <a href="/work" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
                    ← Back to work
                </a>
            </div>
        );
    }

    const pri = priorityStyles[task.priority];

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            {/* Back link */}
            <a href="/work" className="inline-flex items-center gap-1 text-sm transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
                ← Back to work
            </a>

            {/* Main card */}
            <div
                className="rounded-xl border p-7 space-y-6"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-xl font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {task.title}
                    </h1>
                    <span
                        className="shrink-0 font-mono text-xs px-2.5 py-1 rounded-full"
                        style={{ color: pri.color, backgroundColor: pri.bg }}
                    >
                        {task.priority}
                    </span>
                </div>

                {/* Reward banner */}
                {task.reward && (
                    <div
                        className="flex items-center gap-4 rounded-lg border px-4 py-3"
                        style={{ borderColor: 'rgba(52,211,153,0.25)', backgroundColor: 'rgba(52,211,153,0.05)' }}
                    >
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-base"
                            style={{ backgroundColor: 'rgba(52,211,153,0.1)' }}
                        >
                            💰
                        </div>
                        <div>
                            <p className="font-mono text-lg font-bold" style={{ color: 'var(--green)' }}>{rewardLabel}</p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Reward for completing this task</p>
                        </div>
                    </div>
                )}

                {/* Description */}
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {task.description}
                </p>

                {/* Agent context */}
                {task.context && (
                    <div
                        className="rounded-lg border p-4 space-y-1"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                    >
                        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                            Context from agent
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                            {task.context}
                        </p>
                    </div>
                )}

                {/* Meta row */}
                <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs pt-4 border-t"
                    style={{ borderColor: 'var(--border-dim)', color: 'var(--text-muted)' }}
                >
                    <span>By <span style={{ color: 'var(--text-secondary)' }}>{task.postedBy}</span></span>
                    <span>·</span>
                    <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span
                        className="font-mono px-2 py-0.5 rounded"
                        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}
                    >
                        {task.status.replace('_', ' ')}
                    </span>
                    <span>·</span>
                    <span
                        className="font-mono text-xs px-2 py-0.5 rounded"
                        style={{
                            color: task.taskType === 'sync' ? 'var(--amber)' : 'var(--cyan)',
                            backgroundColor: task.taskType === 'sync' ? 'rgba(251,191,36,0.1)' : 'rgba(103,232,249,0.1)',
                        }}
                    >
                        {task.taskType === 'sync' ? '⚡ sync' : '⏳ async'}
                    </span>
                    {task.estimatedMins && (
                        <>
                            <span>·</span>
                            <span>{formatDuration(task.estimatedMins)}</span>
                        </>
                    )}
                    {task.reassignCount > 0 && (
                        <>
                            <span>·</span>
                            <span style={{ color: 'var(--amber)' }}>↺ Reassigned {task.reassignCount}×</span>
                        </>
                    )}
                </div>

                {/* Expiry countdown — open tasks */}
                {task.status === 'open' && expiryCountdown && (
                    <div
                        className="flex items-center gap-2 text-sm rounded-lg border px-4 py-2.5"
                        style={{
                            borderColor: expiryCountdown === 'Expired' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)',
                            backgroundColor: expiryCountdown === 'Expired' ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.05)',
                            color: expiryCountdown === 'Expired' ? 'var(--red)' : 'var(--amber)',
                        }}
                    >
                        <span>⏳</span>
                        <span>Task expires in <strong>{expiryCountdown}</strong></span>
                    </div>
                )}

                {/* Completion deadline — claimed by current user */}
                {task.status === 'claimed' && isAssignee && deadlineCountdown && (
                    <div
                        className="flex items-center gap-2 text-sm rounded-lg border px-4 py-2.5"
                        style={{
                            borderColor: deadlineCountdown === 'Expired' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)',
                            backgroundColor: deadlineCountdown === 'Expired' ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.05)',
                            color: deadlineCountdown === 'Expired' ? 'var(--red)' : 'var(--amber)',
                        }}
                    >
                        <span>⚡</span>
                        <span>Submit within <strong>{deadlineCountdown}</strong> or this task will be reassigned</span>
                    </div>
                )}

                {/* ── Action area ── */}

                {/* Open → direct claim no longer allowed; route via Work Session */}
                {task.status === 'open' && (
                    <div
                        className="rounded-lg border p-4 space-y-2 text-center"
                        style={{ borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.05)' }}
                    >
                        <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                            This task is available via Work Session
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            Tasks are routed fairly to workers. Start a session to receive this or similar tasks.
                        </p>
                        <a
                            href="/work"
                            className="inline-block mt-1 px-4 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
                            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                        >
                            Start earning →
                        </a>
                    </div>
                )}

                {/* Claimed by someone else */}
                {task.status === 'claimed' && !isAssignee && (
                    <div
                        className="text-center py-3 text-sm rounded-lg border"
                        style={{
                            color: 'var(--amber)',
                            borderColor: 'rgba(251,191,36,0.3)',
                            backgroundColor: 'rgba(251,191,36,0.05)',
                        }}
                    >
                        This task has been claimed by another user.
                    </div>
                )}

                {/* Claimed by current user → submit + release */}
                {task.status === 'claimed' && isAssignee && (
                    <div
                        className="space-y-4 pt-4 border-t"
                        style={{ borderColor: 'var(--border-dim)' }}
                    >
                        {/* Submit result */}
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Submit your result</p>
                        <textarea
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                            placeholder="Enter your response or findings here…"
                            rows={5}
                            className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-1 resize-y"
                            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                        <button
                            onClick={handleSubmitResult}
                            disabled={submitting || !result.trim()}
                            className="w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                        >
                            {submitting ? 'Submitting…' : 'Submit for verification'}
                        </button>

                        {/* ── Release section ── */}
                        <div className="pt-2 border-t" style={{ borderColor: 'var(--border-dim)' }}>
                            {/* Grace banner */}
                            {graceSecsLeft !== null && graceSecsLeft > 0 && (
                                <div
                                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 mb-3"
                                    style={{
                                        borderColor: 'rgba(52,211,153,0.25)',
                                        backgroundColor: 'rgba(52,211,153,0.05)',
                                    }}
                                >
                                    <p className="text-xs" style={{ color: 'var(--green)' }}>
                                        ✓ You can release this task without penalty for the next{' '}
                                        <strong>{graceSecsLeft}s</strong>.
                                    </p>
                                </div>
                            )}
                            {graceSecsLeft !== null && graceSecsLeft === 0 && (
                                <div
                                    className="flex items-center gap-2 rounded-lg border px-4 py-2.5 mb-3"
                                    style={{
                                        borderColor: 'rgba(251,191,36,0.3)',
                                        backgroundColor: 'rgba(251,191,36,0.05)',
                                    }}
                                >
                                    <span>⚠️</span>
                                    <p className="text-xs" style={{ color: 'var(--amber)' }}>
                                        Releasing now will affect your reliability score.
                                    </p>
                                </div>
                            )}

                            {/* Inline confirmation panel (shown after clicking Release) */}
                            {showReleaseConfirm ? (
                                <div
                                    className="rounded-lg border p-4 space-y-3"
                                    style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.04)' }}
                                >
                                    <p className="text-sm font-semibold" style={{ color: 'var(--red)' }}>
                                        Release this task?
                                    </p>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        The task will return to the queue and your reliability score will be reduced.
                                        You will not receive this task again for 24 hours.
                                    </p>
                                    {/* Reason picker */}
                                    <select
                                        value={releaseReason}
                                        onChange={(e) => setReleaseReason(e.target.value as ReleaseReason | '')}
                                        className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm focus:outline-none"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                                    >
                                        <option value="">Reason (optional)</option>
                                        {(Object.entries(RELEASE_REASON_LABELS) as [ReleaseReason, string][]).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRelease}
                                            disabled={releasing}
                                            className="flex-1 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--red)', color: '#fff' }}
                                        >
                                            {releasing ? 'Releasing…' : 'Confirm release'}
                                        </button>
                                        <button
                                            onClick={() => setShowReleaseConfirm(false)}
                                            disabled={releasing}
                                            className="flex-1 py-2 text-sm rounded-lg border transition-colors hover:bg-white/5 disabled:opacity-50"
                                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                                        >
                                            Keep task
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (graceSecsLeft && graceSecsLeft > 0) {
                                            // Within grace — release immediately, no confirm needed
                                            handleRelease();
                                        } else {
                                            setShowReleaseConfirm(true);
                                        }
                                    }}
                                    disabled={releasing}
                                    className="w-full py-2 text-sm rounded-lg border transition-colors hover:bg-white/5 disabled:opacity-50"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                >
                                    {releasing ? 'Releasing…' : 'Release back to queue'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Pending verification */}
                {task.status === 'pending_verification' && (
                    <div
                        className="rounded-lg border p-4 space-y-2"
                        style={{
                            borderColor: 'rgba(129,140,248,0.3)',
                            backgroundColor: 'rgba(129,140,248,0.05)',
                        }}
                    >
                        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--accent)' }}>
                            <span>⏳</span>
                            <span>Awaiting agent verification</span>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Your result has been submitted. The AI agent will review it and release your reward if approved.
                        </p>
                        {task.result && (
                            <div
                                className="rounded border p-3 text-sm mt-2"
                                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                            >
                                <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Your submitted result:</p>
                                <p className="whitespace-pre-wrap">{task.result}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Rejected */}
                {task.status === 'rejected' && (
                    <div
                        className="rounded-lg border p-4 space-y-2"
                        style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.05)' }}
                    >
                        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--red)' }}>
                            <span>✕</span>
                            <span>Result not accepted</span>
                        </div>
                        {task.verificationNote && (
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Agent feedback: </span>
                                {task.verificationNote}
                            </p>
                        )}
                    </div>
                )}

                {/* Approved */}
                {task.status === 'approved' && (
                    <div
                        className="rounded-lg border p-4 space-y-2"
                        style={{ borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.05)' }}
                    >
                        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--green)' }}>
                            <span>✓</span>
                            <span>Task approved!{rewardLabel && ` ${rewardLabel} added to your balance.`}</span>
                        </div>
                        {task.verificationNote && (
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Agent note: </span>
                                {task.verificationNote}
                            </p>
                        )}
                        {isAssignee && (
                            <a
                                href="/earnings"
                                className="inline-block mt-2 px-4 py-2 text-sm font-semibold rounded-lg transition-opacity hover:opacity-90"
                                style={{ backgroundColor: 'var(--green)', color: '#000' }}
                            >
                                View earnings & collect payout →
                            </a>
                        )}
                    </div>
                )}

                {/* Completed (legacy) */}
                {task.status === 'completed' && (
                    <div
                        className="rounded-lg border p-4 space-y-2"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                    >
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Completed</p>
                        <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{task.result}</p>
                    </div>
                )}

                {/* Expired */}
                {task.status === 'expired' && (
                    <div
                        className="rounded-lg border p-4 space-y-1"
                        style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.05)' }}
                    >
                        <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--red)' }}>
                            <span>🕐</span>
                            <span>Task expired</span>
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            This task was not completed within the required time window.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
