import React from 'react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/formatters';
import { PRIORITY_DOT_CLASS, PRIORITY_TEXT_CLASS } from '../../lib/priority';
import { OFFER_TTL } from '../../lib/constants';
import { useSecondsLeft } from '../../hooks/useSecondsLeft';
import type { Task, TaskPriority } from '../../types';

export type StreamItemState = 'entering' | 'visible' | 'gone';

export interface StreamTask extends Task {
    _streamState: StreamItemState;
}

interface StreamItemProps {
    task: StreamTask;
    isOffered: boolean;
    offerExpiresAt?: string;
}

export function StreamItem({ task, isOffered, offerExpiresAt }: StreamItemProps) {
    const taskSecsLeft  = useSecondsLeft(task.expiresAt);
    const offerSecsLeft = useSecondsLeft(offerExpiresAt);
    const isGone        = task._streamState === 'gone';

    const displaySecs   = isOffered ? offerSecsLeft : taskSecsLeft;
    const isExpiring    = !isGone && displaySecs > 0 && displaySecs <= 8;
    const offerProgress = isOffered
        ? Math.max(0, Math.min(100, (offerSecsLeft / OFFER_TTL) * 100))
        : null;

    return (
        <div
            className={cn(
                'relative flex flex-col gap-1 px-3.5 py-2.5 rounded-xl border transition-all duration-300 overflow-hidden',
                isOffered && !isExpiring  && 'border-accent bg-accent/[0.08] shadow-[0_0_0_1px_rgba(99,102,241,0.3)]',
                isOffered && isExpiring   && 'border-danger bg-danger/[0.07] shadow-[0_0_0_1px_rgba(248,113,113,0.35)]',
                !isOffered && isExpiring  && 'border-danger/30 bg-danger/[0.04]',
                !isOffered && !isExpiring && 'border-border bg-surface',
            )}
            style={{
                opacity:   isGone ? 0 : 1,
                transform: isGone ? 'translateX(14px)' : 'translateX(0)',
            }}
        >
            {/* Offer progress bar */}
            {isOffered && offerProgress !== null && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-elevated">
                    <div
                        className={cn('h-full transition-all duration-500', isExpiring ? 'bg-danger' : 'bg-accent')}
                        style={{ width: `${offerProgress}%` }}
                    />
                </div>
            )}

            <div className="flex items-center gap-3">
                <span
                    className={cn('shrink-0 w-2 h-2 rounded-full', PRIORITY_DOT_CLASS[task.priority as TaskPriority])}
                />
                <p
                    className={cn(
                        'flex-1 text-xs font-medium truncate',
                        isGone ? 'text-muted line-through' : 'text-primary',
                        isOffered && !isGone && 'font-semibold',
                    )}
                >
                    {task.title}
                </p>
                {task.reward && (
                    <span className="shrink-0 font-mono text-xs font-semibold text-success">
                        {formatCurrency(task.reward.amount, task.reward.currency)}
                    </span>
                )}
                {isGone ? (
                    <span className="shrink-0 text-xs text-danger">gone</span>
                ) : isOffered ? (
                    <span
                        className={cn('shrink-0 font-mono text-xs tabular-nums font-bold', isExpiring ? 'text-danger animate-pulse' : 'text-accent')}
                        style={{ minWidth: '2.5rem', textAlign: 'right' }}
                    >
                        {displaySecs}s
                    </span>
                ) : task.expiresAt && taskSecsLeft > 0 ? (
                    <span
                        className={cn('shrink-0 font-mono text-xs tabular-nums', isExpiring ? 'text-danger animate-pulse' : 'text-muted')}
                        style={{ minWidth: '2.5rem', textAlign: 'right' }}
                    >
                        {taskSecsLeft}s
                    </span>
                ) : (
                    <span className="shrink-0 font-mono text-xs text-muted" style={{ minWidth: '2.5rem', textAlign: 'right' }}>
                        open
                    </span>
                )}
            </div>

            {isOffered && !isGone && (
                <div className="flex items-center gap-1.5 pl-5">
                    <span className={cn('text-xs font-semibold', isExpiring ? 'text-danger' : 'text-accent')}>
                        {isExpiring ? '⚠ expiring' : '→ offered to you'}
                    </span>
                </div>
            )}
        </div>
    );
}
