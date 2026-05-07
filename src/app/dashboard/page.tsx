import React from 'react';
import TaskList from '../../components/TaskList';
import { listTasks } from '../../lib/taskStore';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/route';

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string; email?: string | null } | undefined)?.id ?? session?.user?.email ?? null;
    const allTasks = await listTasks();
    const myTasks = userId ? allTasks.filter((t) => t.assignedTo === userId) : [];
    const openTasks = allTasks.filter((t) => t.status === 'open');

    const stats = [
        { label: 'Open Tasks',   value: openTasks.length,                                        color: 'var(--green)' },
        { label: 'My Tasks',     value: myTasks.length,                                           color: 'var(--accent)' },
        { label: 'Completed',    value: myTasks.filter((t) => t.status === 'completed').length,   color: 'var(--text-secondary)' },
        { label: 'Total Posted', value: allTasks.length,                                          color: 'var(--text-secondary)' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard</h1>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {session?.user ? `Welcome back, ${session.user.name}` : 'Sign in to start accepting tasks.'}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.map(({ label, value, color }) => (
                    <div
                        key={label}
                        className="rounded-xl border p-5"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                    >
                        <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <p className="font-mono text-3xl font-bold" style={{ color }}>{value}</p>
                    </div>
                ))}
            </div>

            {/* My tasks */}
            {session?.user && (
                <div className="space-y-3">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>My Tasks</h2>
                    <TaskList tasks={myTasks} />
                </div>
            )}

            {/* Open tasks */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Open Tasks</h2>
                    <a href="/" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--accent)' }}>
                        View all →
                    </a>
                </div>
                <TaskList tasks={openTasks.slice(0, 6)} />
            </div>
        </div>
    );
}
