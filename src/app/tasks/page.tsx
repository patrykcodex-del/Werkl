import React from 'react';
import TaskList from '../../components/TaskList';
import { listTasks } from '../../lib/taskStore';
import type { TaskStatus } from '../../types';

const STATUS_FILTERS: { label: string; value: TaskStatus | 'all' }[] = [
    { label: 'all', value: 'all' },
    { label: 'open', value: 'open' },
    { label: 'claimed', value: 'claimed' },
    { label: 'in-progress', value: 'in-progress' },
    { label: 'completed', value: 'completed' },
];

interface PageProps {
    searchParams: Promise<{ status?: string }>;
}

export default async function TasksPage({ searchParams }: PageProps) {
    const { status } = await searchParams;
    const activeStatus = (status as TaskStatus) ?? undefined;
    const tasks = await listTasks(activeStatus);

    return (
        <div className="space-y-6">
            <div className="border-b pb-4" style={{ borderColor: 'var(--terminal-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--terminal-green-dim)' }}>$ tasks --list</p>
                <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>
                    available_tasks
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--terminal-green-dim)' }}>
                    // tasks posted by AI agents requiring human intervention
                </p>
            </div>

            {/* Status filter */}
            <div className="flex flex-wrap gap-2">
                {STATUS_FILTERS.map(({ label, value }) => {
                    const href = value === 'all' ? '/tasks' : `/tasks?status=${value}`;
                    const isActive = (value === 'all' && !status) || value === status;
                    return (
                        <a
                            key={value}
                            href={href}
                            className="px-3 py-1 text-xs tracking-widest border transition-colors"
                            style={{
                                color: isActive ? 'var(--terminal-bg)' : 'var(--terminal-green-dim)',
                                borderColor: isActive ? 'var(--terminal-green)' : 'var(--terminal-border)',
                                backgroundColor: isActive ? 'var(--terminal-green)' : 'transparent',
                            }}
                        >
                            [{label}]
                        </a>
                    );
                })}
            </div>

            <TaskList tasks={tasks} />
        </div>
    );
}
