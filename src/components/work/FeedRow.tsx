import React from 'react';
import { cn } from '../../lib/utils';
import { timeAgo, formatCurrency } from '../../lib/formatters';
import { PRIORITY_DOT_CLASS } from '../../lib/priority';
import { Badge } from '../ui/badge';
import type { Task } from '../../types';

export function FeedRow({ task, isNew }: { task: Task; isNew: boolean }) {
    return (
        <div
            className={cn(
                'group flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200',
                'hover:border-accent hover:bg-elevated cursor-default',
                isNew
                    ? 'border-accent bg-accent-glow feed-row-enter'
                    : 'border-border bg-surface',
            )}
        >
            <span
                className={cn(
                    'shrink-0 w-2 h-2 rounded-full transition-transform duration-200 group-hover:scale-125',
                    PRIORITY_DOT_CLASS[task.priority],
                )}
                title={task.priority}
            />
            <p className="flex-1 text-sm font-medium truncate text-primary group-hover:text-accent transition-colors duration-200">
                {task.title}
            </p>
            {task.reward && (
                <Badge variant="mono">
                    {formatCurrency(task.reward.amount, task.reward.currency)}
                </Badge>
            )}
            <span
                className="shrink-0 font-mono text-xs tabular-nums text-muted"
                style={{ minWidth: '3.5rem', textAlign: 'right' }}
            >
                {timeAgo(task.createdAt)}
            </span>
        </div>
    );
}
