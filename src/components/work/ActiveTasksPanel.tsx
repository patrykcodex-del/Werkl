import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Card, CardFooter } from '../ui/card';
import { CONCURRENCY_LIMIT } from '../../lib/constants';
import { ActiveTaskExpandableRow } from './ActiveTaskExpandableRow';
import type { Task } from '../../types';

interface ActiveTasksPanelProps {
    tasks: Task[];
    onTaskUpdate: (updated: Task) => void;
}

export function ActiveTasksPanel({ tasks, onTaskUpdate }: ActiveTasksPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (tasks.length === 0) return null;

    const atCapacity = tasks.length >= CONCURRENCY_LIMIT;

    return (
        <Card className={cn(atCapacity ? 'border-yellow-500' : 'border-accent')}>
            <div
                className={cn(
                    'flex items-center gap-2 px-4 py-3 border-b',
                    atCapacity
                        ? 'border-yellow-500 bg-yellow-500/[0.07]'
                        : 'border-accent bg-accent/[0.06]',
                )}
            >
                <span className="text-sm">{atCapacity ? '⚠️' : '📋'}</span>
                <p className={cn('text-xs font-semibold uppercase tracking-widest', atCapacity ? 'text-yellow-500' : 'text-accent')}>
                    {atCapacity ? 'Queue full' : 'Your active tasks'}
                </p>
                <span
                    className={cn(
                        'ml-auto text-xs font-bold px-2 py-0.5 rounded-full',
                        atCapacity ? 'bg-yellow-500 text-black' : 'bg-accent text-white',
                    )}
                >
                    {tasks.length} / {CONCURRENCY_LIMIT}
                </span>
            </div>

            <div className="p-2 space-y-1">
                {tasks.map((t) => (
                    <ActiveTaskExpandableRow
                        key={t.id}
                        task={t}
                        expanded={expandedId === t.id}
                        onToggle={() => setExpandedId(expandedId === t.id ? null : t.id)}
                        onTaskUpdate={onTaskUpdate}
                    />
                ))}
            </div>

            <CardFooter>
                <p className={cn('text-xs', atCapacity ? 'text-yellow-500' : 'text-muted')}>
                    {atCapacity
                        ? 'Complete or submit a task above to unlock your next offer.'
                        : `Click a task to expand it and submit your result. You can hold up to ${CONCURRENCY_LIMIT} tasks at once.`}
                </p>
            </CardFooter>
        </Card>
    );
}
