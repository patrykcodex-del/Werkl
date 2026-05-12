'use client';

import React from 'react';
import Link from 'next/link';
import type { Task } from '../types';

const priorityStyles: Record<Task['priority'], { label: string; color: string; bg: string }> = {
    low:    { label: 'Low',        color: 'var(--text-muted)',  bg: 'rgba(71,85,105,0.2)' },
    medium: { label: 'Standard',   color: 'var(--accent)',      bg: 'var(--accent-glow)' },
    high:   { label: 'High Value', color: 'var(--amber)',       bg: 'rgba(251,191,36,0.1)' },
    urgent: { label: '🔥 Hot',     color: 'var(--red)',         bg: 'rgba(248,113,113,0.1)' },
};

const statusStyles: Record<Task['status'], string> = {
    open:                 'var(--green)',
    offered:              'var(--accent)',
    claimed:              'var(--amber)',
    'in-progress':        'var(--accent)',
    completed:            'var(--text-muted)',
    cancelled:            'var(--red)',
    expired:              'var(--text-muted)',
    pending_verification: 'var(--cyan)',
    approved:             'var(--green)',
    rejected:             'var(--red)',
};

function formatReward(reward: Task['reward']): string | null {
    if (!reward) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: reward.currency }).format(reward.amount);
}

const TaskCard: React.FC<{ task: Task }> = ({ task }) => {
    const rewardLabel = formatReward(task.reward);
    const pri = priorityStyles[task.priority];

    return (
        <Link href={`/tasks/${task.id}`} className="block group">
            <div
                className="border rounded-xl p-5 transition-all duration-150 h-full flex flex-col gap-2 hover:shadow-lg"
                style={{
                    borderColor: 'var(--border)',
                    backgroundColor: 'var(--bg-surface)',
                }}
                onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-elevated)';
                }}
                onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)';
                }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-semibold leading-snug transition-colors group-hover:text-indigo-300" style={{ color: 'var(--text-primary)' }}>
                        {task.title}
                    </h3>
                    <span
                        className="shrink-0 font-mono text-xs px-2 py-0.5 rounded-full"
                        style={{ color: pri.color, backgroundColor: pri.bg }}
                    >
                        {pri.label}
                    </span>
                </div>

                {/* Description */}
                <p className="text-sm line-clamp-2 flex-1" style={{ color: 'var(--text-secondary)' }}>
                    {task.description}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between mt-1">
                    <span className="font-mono text-xs" style={{ color: statusStyles[task.status] }}>
                        {task.status}
                    </span>
                    {rewardLabel ? (
                        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--green)' }}>{rewardLabel}</span>
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No reward set</span>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default TaskCard;
