'use client';

import React from 'react';
import Link from 'next/link';
import type { Task } from '../types';

const priorityColor: Record<Task['priority'], string> = {
    low: 'var(--terminal-green-dim)',
    medium: 'var(--terminal-cyan)',
    high: 'var(--terminal-amber)',
    urgent: 'var(--terminal-red)',
};

const statusColor: Record<Task['status'], string> = {
    open: 'var(--terminal-green)',
    claimed: 'var(--terminal-amber)',
    'in-progress': 'var(--terminal-cyan)',
    completed: 'var(--terminal-green-dim)',
    cancelled: 'var(--terminal-red)',
    pending_verification: 'var(--terminal-cyan)',
    approved: 'var(--terminal-green)',
    rejected: 'var(--terminal-red)',
};

function formatReward(reward: Task['reward']): string | null {
    if (!reward) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: reward.currency }).format(reward.amount);
}

interface TaskCardProps {
    task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
    const rewardLabel = formatReward(task.reward);
    return (
        <Link href={`/tasks/${task.id}`} className="block group">
            <div
                className="border p-4 transition-all h-full flex flex-col gap-2 hover:bg-green-950/20"
                style={{ borderColor: 'var(--terminal-border)', backgroundColor: 'var(--terminal-surface)' }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--terminal-green-dim)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--terminal-border)')}
            >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                    <h3
                        className="text-sm font-semibold tracking-wide leading-snug group-hover:text-green-300 transition-colors"
                        style={{ color: 'var(--terminal-green)' }}
                    >
                        &gt; {task.title}
                    </h3>
                    <span
                        className="shrink-0 text-xs tracking-widest border px-1.5 py-0.5"
                        style={{ color: priorityColor[task.priority], borderColor: priorityColor[task.priority] + '66' }}
                    >
                        [{task.priority}]
                    </span>
                </div>

                {/* Description */}
                <p className="text-xs leading-relaxed line-clamp-2 flex-1" style={{ color: 'var(--terminal-green-dim)' }}>
                    {task.description}
                </p>

                {/* Footer row */}
                <div className="flex items-center justify-between mt-1">
                    <span
                        className="text-xs tracking-wider"
                        style={{ color: statusColor[task.status] }}
                    >
                        status:{task.status}
                    </span>
                    {rewardLabel ? (
                        <span className="text-xs font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>
                            {rewardLabel}
                        </span>
                    ) : (
                        <span className="text-xs" style={{ color: 'var(--terminal-green-dim)' }}>no_reward</span>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default TaskCard;
