import React, { Suspense } from 'react';
import TaskList from '../../components/TaskList';
import TaskFilters from '../../components/TaskFilters';
import { listTasks } from '../../lib/taskStore';
import type { ListTasksOptions } from '../../lib/taskStore';
import type { TaskStatus, TaskPriority } from '../../types';

const STATUS_FILTERS: { label: string; value: string }[] = [
    { label: 'All', value: 'all' },
    { label: 'Open', value: 'open' },
    { label: 'Claimed', value: 'claimed' },
];

// "Claimed" tab shows both claimed + in-progress
const CLAIMED_STATUSES: TaskStatus[] = ['claimed', 'in-progress'];

interface PageProps {
    searchParams: Promise<{
        status?: string;
        sort?: string;
        order?: string;
        priority?: string;
    }>;
}

export default async function TasksPage({ searchParams }: PageProps) {
    const { status, sort, order, priority } = await searchParams;

    const activeStatus = status ?? 'open';
    const activeSort = (sort as ListTasksOptions['sort']) ?? 'createdAt';
    const activeOrder = (order as ListTasksOptions['order']) ?? 'desc';
    const activePriority = priority as TaskPriority | undefined;

    let statusFilter: ListTasksOptions['status'];
    if (!activeStatus || activeStatus === 'all') {
        statusFilter = undefined;
    } else if (activeStatus === 'claimed') {
        statusFilter = CLAIMED_STATUSES;
    } else {
        statusFilter = activeStatus as TaskStatus;
    }

    const tasks = await listTasks({
        status: statusFilter,
        priority: activePriority,
        sort: activeSort,
        order: activeOrder,
    });

    return (
        <div className="space-y-6">
            {/* Hero */}
            <div
                className="relative rounded-2xl overflow-hidden"
                style={{ minHeight: '220px' }}
            >
                {/* Background image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1400&q=80"
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {/* Gradient overlay for readability */}
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.45) 60%, rgba(0,0,0,0.25) 100%)',
                    }}
                />
                {/* Content */}
                <div className="relative z-10 px-8 py-10 flex flex-col justify-end h-full" style={{ minHeight: '220px' }}>
                    <span
                        className="text-xs font-semibold uppercase tracking-widest mb-3 inline-block px-3 py-1 rounded-full"
                        style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
                    >
                        Human-in-the-loop
                    </span>
                    <h1 className="text-3xl font-bold text-white drop-shadow mb-2">Task Board</h1>
                    <p className="text-sm max-w-md" style={{ color: 'rgba(255,255,255,0.80)' }}>
                        Browse tasks for reference. To earn rewards, start a{' '}
                        <a href="/work" className="underline font-semibold">Work Session</a>{' '}
                        — tasks are routed fairly to active workers.
                    </p>
                </div>
            </div>

            {/* Controls row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Status tabs */}
                <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map(({ label, value }) => {
                        const params = new URLSearchParams();
                        params.set('status', value);
                        if (sort) params.set('sort', sort);
                        if (order) params.set('order', order);
                        if (priority) params.set('priority', priority);
                        const isActive = value === activeStatus;
                        return (
                            <a
                                key={value}
                                href={`/tasks?${params.toString()}`}
                                className="px-3 py-1 text-sm rounded-lg border transition-colors"
                                style={{
                                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                                    borderColor: isActive ? 'var(--accent)' : 'var(--border)',
                                    backgroundColor: isActive ? 'var(--accent-glow)' : 'transparent',
                                }}
                            >
                                {label}
                            </a>
                        );
                    })}
                </div>

                {/* Sort & filter dropdowns */}
                <Suspense>
                    <TaskFilters
                        currentSort={activeSort}
                        currentOrder={activeOrder}
                        currentPriority={activePriority ?? 'all'}
                    />
                </Suspense>
            </div>

            <TaskList tasks={tasks} />
        </div>
    );
}
