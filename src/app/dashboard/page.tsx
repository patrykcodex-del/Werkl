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
        { label: 'open_tasks', value: openTasks.length, color: 'var(--terminal-green)' },
        { label: 'my_tasks', value: myTasks.length, color: 'var(--terminal-cyan)' },
        { label: 'completed', value: myTasks.filter((t) => t.status === 'completed').length, color: 'var(--terminal-green-dim)' },
        { label: 'total_posted', value: allTasks.length, color: 'var(--terminal-green-dim)' },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="border-b pb-4" style={{ borderColor: 'var(--terminal-border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--terminal-green-dim)' }}>$ dashboard --user</p>
                <h1 className="text-xl font-bold tracking-wider" style={{ color: 'var(--terminal-green)' }}>
                    dashboard
                </h1>
                <p className="text-xs mt-1 tracking-wide" style={{ color: 'var(--terminal-green-dim)' }}>
                    {session?.user
                        ? `// session: ${session.user.name}`
                        : '// no active session — sign in to claim tasks'}
                </p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {stats.map(({ label, value, color }) => (
                    <div
                        key={label}
                        className="border p-4"
                        style={{ borderColor: 'var(--terminal-border)', backgroundColor: 'var(--terminal-surface)' }}
                    >
                        <p className="text-xs tracking-wider mb-2" style={{ color: 'var(--terminal-green-dim)' }}>
                            {label}
                        </p>
                        <p className="text-3xl font-bold tracking-wider" style={{ color }}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* My tasks */}
            {session?.user && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold tracking-widest" style={{ color: 'var(--terminal-green)' }}>
                        &gt; my_tasks
                    </h2>
                    <TaskList tasks={myTasks} />
                </div>
            )}

            {/* Open tasks */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold tracking-widest" style={{ color: 'var(--terminal-green)' }}>
                        &gt; open_tasks
                    </h2>
                    <a
                        href="/tasks"
                        className="text-xs tracking-wider hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--terminal-green-dim)' }}
                    >
                        view_all →
                    </a>
                </div>
                <TaskList tasks={openTasks.slice(0, 6)} />
            </div>
        </div>
    );
}
