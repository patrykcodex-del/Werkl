'use client';

import React, { useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/formatters';
import { PRIORITY_TEXT_CLASS } from '../../lib/priority';
import { OFFER_TTL } from '../../lib/constants';
import { useSecondsLeft } from '../../hooks/useSecondsLeft';
import { useCountdown } from '../../hooks/useCountdown';
import { Button } from '../ui/button';
import type { TaskOffer, TaskPriority } from '../../types';

interface OfferCardProps {
    offer: TaskOffer;
    onAccept: () => void;
    onSkip: () => void;
    onExpire: () => void;
    loading: boolean;
}

export function OfferCard({ offer, onAccept, onSkip, onExpire, loading }: OfferCardProps) {
    const countdown  = useCountdown(offer.expiresAt);
    const secsLeft   = useSecondsLeft(offer.expiresAt);
    const isExpiring = secsLeft > 0 && secsLeft <= 8;
    const isExpired  = secsLeft === 0;

    const expiredFired = useRef(false);
    useEffect(() => {
        if (isExpired && !expiredFired.current) {
            expiredFired.current = true;
            onExpire();
        }
    }, [isExpired, onExpire]);

    const task     = offer.task;
    const progress = Math.max(0, Math.min(100, (secsLeft / OFFER_TTL) * 100));

    return (
        <div
            className={cn(
                'rounded-2xl border p-6 space-y-5 transition-colors duration-500 bg-surface',
                isExpiring
                    ? 'border-danger shadow-[0_0_0_1px_rgba(248,113,113,0.3),0_4px_24px_rgba(248,113,113,0.12)]'
                    : 'border-accent shadow-[0_0_0_1px_rgba(99,102,241,0.25),0_4px_24px_rgba(99,102,241,0.1)]',
            )}
        >
            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden bg-elevated">
                <div
                    className={cn('h-full rounded-full transition-all duration-500', isExpiring ? 'bg-danger' : 'bg-accent')}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className={cn('text-xs font-semibold uppercase tracking-widest mb-1', isExpiring ? 'text-danger' : 'text-accent')}>
                        {isExpiring ? '⚠ Expiring soon' : 'Task offered to you'}
                    </p>
                    <h2 className="text-lg font-bold leading-snug text-primary">
                        {task?.title ?? 'Loading…'}
                    </h2>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-xs mb-0.5 text-muted">Accept within</p>
                    <p className={cn('font-mono text-3xl font-bold tabular-nums', isExpiring ? 'text-danger animate-pulse' : 'text-warning')}>
                        {countdown ?? '…'}
                    </p>
                </div>
            </div>

            {/* Description */}
            {task?.description && (
                <p className="text-sm leading-relaxed line-clamp-3 text-secondary">{task.description}</p>
            )}

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2">
                {task?.reward && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full text-success bg-success/10">
                        💰 {formatCurrency(task.reward.amount, task.reward.currency)}
                    </span>
                )}
                {task?.estimatedMins && (
                    <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full text-secondary bg-elevated">
                        ⏱ ~{task.estimatedMins} min
                    </span>
                )}
                {task?.priority && (
                    <span className={cn('inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-elevated', PRIORITY_TEXT_CLASS[task.priority as TaskPriority])}>
                        {task.priority}
                    </span>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
                <Button
                    variant={isExpiring ? 'destructive' : 'accent'}
                    className="flex-1"
                    onClick={onAccept}
                    disabled={loading || isExpired}
                >
                    {loading ? 'Accepting…' : isExpired ? 'Expired' : 'Accept task'}
                </Button>
                <Button variant="outline" onClick={onSkip} disabled={loading}>
                    Skip
                </Button>
            </div>
        </div>
    );
}
