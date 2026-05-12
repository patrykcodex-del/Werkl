'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/formatters';
import { PRIORITY_DOT_CLASS } from '../../lib/priority';
import { RELEASE_GRACE_SECS } from '../../lib/constants';
import { useSecondsLeft } from '../../hooks/useSecondsLeft';
import { useCountdown } from '../../hooks/useCountdown';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import type { Task, TaskPriority, ReleaseReason } from '../../types';
import { RELEASE_REASON_LABELS } from '../../types';

interface ActiveTaskExpandableRowProps {
    task: Task;
    expanded: boolean;
    onToggle: () => void;
    onTaskUpdate: (updated: Task) => void;
}

export function ActiveTaskExpandableRow({
    task,
    expanded,
    onToggle,
    onTaskUpdate,
}: ActiveTaskExpandableRowProps) {
    const deadline  = task.completionDeadline ?? task.claimExpiresAt;
    const secsLeft  = useSecondsLeft(deadline);
    const totalSecs = task.completionMins ? task.completionMins * 60 : task.claimTimeoutMins * 60;
    const pct       = deadline ? Math.max(0, Math.min(100, (secsLeft / totalSecs) * 100)) : 100;
    const urgent    = secsLeft > 0 && secsLeft < 120;
    const mins      = Math.floor(secsLeft / 60);
    const secs      = secsLeft % 60;
    const timeStr   = secsLeft > 0 ? `${mins}:${String(secs).padStart(2, '0')} left` : 'Expired';

    const [graceSecsLeft, setGraceSecsLeft] = useState<number | null>(null);
    useEffect(() => {
        if (!task.claimedAt) { setGraceSecsLeft(null); return; }
        const graceEndsMs = new Date(task.claimedAt).getTime() + RELEASE_GRACE_SECS * 1000;
        function tick() { setGraceSecsLeft(Math.max(0, Math.ceil((graceEndsMs - Date.now()) / 1000))); }
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [task.claimedAt]);

    const [result, setResult]                         = useState('');
    const [submitting, setSubmitting]                 = useState(false);
    const [releasing, setReleasing]                   = useState(false);
    const [releaseReason, setReleaseReason]           = useState<ReleaseReason | ''>('');
    const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

    const deadlineCountdown = useCountdown(deadline ?? undefined);
    const isActionable      = task.status === 'claimed';

    async function handleSubmitResult() {
        if (!result.trim()) return;
        setSubmitting(true);
        const res = await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending_verification', result }),
        });
        if (res.ok) onTaskUpdate(await res.json());
        setSubmitting(false);
    }

    async function handleRelease() {
        setReleasing(true);
        setShowReleaseConfirm(false);
        try {
            const res = await fetch(`/api/tasks/${task.id}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(releaseReason ? { reason: releaseReason } : {}),
            });
            if (res.ok) {
                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error ?? 'Could not release task.');
                setReleasing(false);
            }
        } catch {
            alert('Network error — could not release task.');
            setReleasing(false);
        }
    }

    return (
        <div
            className={cn(
                'rounded-xl overflow-hidden border transition-colors bg-elevated',
                expanded ? 'border-accent' : 'border-border',
            )}
        >
            {/* Header row — always visible */}
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left bg-transparent"
            >
                <span
                    className={cn('w-2 h-2 rounded-full flex-shrink-0', PRIORITY_DOT_CLASS[task.priority as TaskPriority])}
                />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-primary">{task.title}</p>
                    {deadline && (
                        <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full overflow-hidden bg-border">
                                <div
                                    className={cn('h-full rounded-full transition-all duration-1000', urgent ? 'bg-danger' : secsLeft === 0 ? 'bg-muted' : 'bg-success')}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                            <span className={cn('text-xs font-mono flex-shrink-0', urgent ? 'text-danger' : 'text-muted')}>
                                {timeStr}
                            </span>
                        </div>
                    )}
                </div>
                {task.reward && (
                    <span className="text-xs font-semibold flex-shrink-0 text-success">
                        {task.reward.currency}{task.reward.amount.toFixed(2)}
                    </span>
                )}
                <span
                    className={cn('text-xs flex-shrink-0 text-muted transition-transform duration-200', expanded ? 'rotate-90' : 'rotate-0')}
                >
                    ›
                </span>
            </button>

            {/* Expanded content */}
            {expanded && (
                <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border">
                    {task.description && (
                        <p className="text-sm leading-relaxed text-secondary">{task.description}</p>
                    )}

                    {task.context && (
                        <div className="rounded-lg border border-border p-3 space-y-1 bg-surface">
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1 text-muted">
                                Context from agent
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap text-secondary">
                                {task.context}
                            </p>
                        </div>
                    )}

                    {isActionable && deadlineCountdown && (
                        <div
                            className={cn(
                                'flex items-center gap-2 text-sm rounded-lg border px-3 py-2',
                                deadlineCountdown === 'Expired'
                                    ? 'border-danger/30 bg-danger/5 text-danger'
                                    : 'border-warning/30 bg-warning/5 text-warning',
                            )}
                        >
                            <span>⚡</span>
                            <span>Submit within <strong>{deadlineCountdown}</strong> or this task will be reassigned</span>
                        </div>
                    )}

                    {isActionable && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold text-primary">Submit your result</p>
                            <Textarea
                                value={result}
                                onChange={(e) => setResult(e.target.value)}
                                placeholder="Enter your response or findings here…"
                                rows={4}
                            />
                            <Button
                                variant="accent-outline"
                                size="full"
                                onClick={handleSubmitResult}
                                disabled={submitting || !result.trim()}
                            >
                                {submitting ? 'Submitting…' : 'Submit for verification'}
                            </Button>
                        </div>
                    )}

                    {isActionable && (
                        <div className="pt-2 border-t border-border-dim space-y-2">
                            {graceSecsLeft !== null && graceSecsLeft > 0 && (
                                <div className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/5 px-3 py-2">
                                    <p className="text-xs text-success">
                                        ✓ No penalty release available for the next <strong>{graceSecsLeft}s</strong>.
                                    </p>
                                </div>
                            )}
                            {graceSecsLeft === 0 && (
                                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                                    <span>⚠️</span>
                                    <p className="text-xs text-warning">
                                        Releasing now will affect your reliability score.
                                    </p>
                                </div>
                            )}

                            {showReleaseConfirm ? (
                                <div className="rounded-lg border border-danger/30 bg-danger/[0.04] p-3 space-y-3">
                                    <p className="text-sm font-semibold text-danger">Release this task?</p>
                                    <p className="text-xs text-secondary">
                                        The task will return to the queue and your reliability score will be reduced.
                                    </p>
                                    <select
                                        value={releaseReason}
                                        onChange={(e) => setReleaseReason(e.target.value as ReleaseReason | '')}
                                        className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none text-primary bg-elevated cursor-pointer"
                                    >
                                        <option value="">Reason (optional)</option>
                                        {(Object.entries(RELEASE_REASON_LABELS) as [ReleaseReason, string][]).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="destructive"
                                            className="flex-1 py-2"
                                            onClick={handleRelease}
                                            disabled={releasing}
                                        >
                                            {releasing ? 'Releasing…' : 'Confirm release'}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="flex-1 py-2"
                                            onClick={() => setShowReleaseConfirm(false)}
                                            disabled={releasing}
                                        >
                                            Keep task
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="full"
                                    className="py-2"
                                    onClick={() => {
                                        if (graceSecsLeft && graceSecsLeft > 0) {
                                            handleRelease();
                                        } else {
                                            setShowReleaseConfirm(true);
                                        }
                                    }}
                                    disabled={releasing}
                                >
                                    {releasing ? 'Releasing…' : 'Release back to queue'}
                                </Button>
                            )}
                        </div>
                    )}

                    {task.status === 'pending_verification' && (
                        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-sm text-accent">
                                <span>⏳</span><span>Awaiting agent verification</span>
                            </div>
                            <p className="text-sm text-secondary">
                                Your result has been submitted. The AI agent will review it shortly.
                            </p>
                            {task.result && (
                                <div className="rounded border border-border bg-surface p-2 text-sm mt-1 text-secondary">
                                    <p className="font-medium mb-1 text-primary">Your submission:</p>
                                    <p className="whitespace-pre-wrap">{task.result}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {task.status === 'approved' && (
                        <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-sm text-success">
                                <span>✓</span>
                                <span>
                                    Approved!{task.reward && ` ${formatCurrency(task.reward.amount, task.reward.currency)} added to your balance.`}
                                </span>
                            </div>
                            {task.verificationNote && (
                                <p className="text-sm text-secondary">
                                    <span className="font-medium text-primary">Note: </span>
                                    {task.verificationNote}
                                </p>
                            )}
                            <a
                                href="/earnings"
                                className="inline-block mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-black"
                            >
                                View earnings →
                            </a>
                        </div>
                    )}

                    {task.status === 'rejected' && (
                        <div className="rounded-lg border border-danger/30 bg-danger/5 p-3 space-y-1">
                            <div className="flex items-center gap-2 font-semibold text-sm text-danger">
                                <span>✕</span><span>Result not accepted</span>
                            </div>
                            {task.verificationNote && (
                                <p className="text-sm text-secondary">
                                    <span className="font-medium text-primary">Feedback: </span>
                                    {task.verificationNote}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
