'use client';

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { Task } from '../../../types';

const priorityStyles: Record<Task['priority'], string> = {
    low: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
    urgent: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
};

function formatReward(reward: Task['reward']): string | null {
    if (!reward) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: reward.currency }).format(reward.amount);
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function TaskDetailPage({ params }: PageProps) {
    const router = useRouter();
    const { data: session } = useSession();
    const [task, setTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState(false);
    const [result, setResult] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [id, setId] = useState<string | null>(null);

    useEffect(() => {
        params.then(({ id }) => setId(id));
    }, [params]);

    useEffect(() => {
        if (!id) return;
        fetch(`/api/tasks/${id}`)
            .then((r) => r.json())
            .then((data) => { setTask(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    const userId = (session?.user as { id?: string; email?: string | null } | undefined)?.id ?? session?.user?.email;
    const isAssignee = !!(task?.assignedTo && userId && task.assignedTo === userId);
    const rewardLabel = formatReward(task?.reward);

    async function handleClaim() {
        if (!session) { router.push('/auth/signin'); return; }
        setClaiming(true);
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'claimed' }),
        });
        if (res.ok) setTask(await res.json());
        setClaiming(false);
    }

    async function handleSubmitResult() {
        if (!result.trim()) return;
        setSubmitting(true);
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending_verification', result }),
        });
        if (res.ok) setTask(await res.json());
        setSubmitting(false);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!task) {
        return (
            <div className="text-center py-24">
                <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Task not found.</p>
                <a href="/tasks" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">← Back to tasks</a>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <a href="/tasks" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">← Back to tasks</a>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">{task.title}</h1>
                    <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${priorityStyles[task.priority]}`}>
                        {task.priority}
                    </span>
                </div>

                {/* Reward banner */}
                {task.reward && (
                    <div className="flex items-center gap-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
                        <span className="text-2xl">💰</span>
                        <div>
                            <p className="text-lg font-bold text-green-700 dark:text-green-400">{rewardLabel}</p>
                            <p className="text-xs text-green-600 dark:text-green-500">Reward for completing this task</p>
                        </div>
                    </div>
                )}

                <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{task.description}</p>

                {/* Agent context */}
                {task.context && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300">
                        <p className="font-semibold text-gray-700 dark:text-gray-200 mb-1">Context from agent</p>
                        <p className="whitespace-pre-wrap">{task.context}</p>
                    </div>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <span>Posted by <span className="font-medium text-gray-600 dark:text-gray-300">{task.postedBy}</span></span>
                    <span>·</span>
                    <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                    <span>·</span>
                    <span className="capitalize font-medium text-gray-600 dark:text-gray-300">{task.status.replace('_', ' ')}</span>
                </div>

                {/* ── State-specific UI ── */}

                {/* Open → claim */}
                {task.status === 'open' && (
                    <button
                        onClick={handleClaim}
                        disabled={claiming}
                        className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
                    >
                        {claiming ? 'Claiming…' : session ? 'Accept this task' : 'Sign in to accept'}
                    </button>
                )}

                {/* Claimed by someone else */}
                {task.status === 'claimed' && !isAssignee && (
                    <div className="text-center py-3 text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                        This task has been claimed by another user.
                    </div>
                )}

                {/* Claimed by current user → submit result */}
                {task.status === 'claimed' && isAssignee && (
                    <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Submit your result</p>
                        <textarea
                            value={result}
                            onChange={(e) => setResult(e.target.value)}
                            placeholder="Enter your response or findings here…"
                            rows={5}
                            className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
                        />
                        <button
                            onClick={handleSubmitResult}
                            disabled={submitting || !result.trim()}
                            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Submitting…' : 'Submit for verification'}
                        </button>
                    </div>
                )}

                {/* Pending verification */}
                {task.status === 'pending_verification' && (
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-semibold">
                            <span className="text-lg">⏳</span>
                            <span>Awaiting agent verification</span>
                        </div>
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                            Your result has been submitted. The AI agent will review it and release your reward if approved.
                        </p>
                        {task.result && (
                            <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 rounded p-3 text-sm text-gray-600 dark:text-gray-300 mt-2">
                                <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">Your submitted result:</p>
                                <p className="whitespace-pre-wrap">{task.result}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Rejected */}
                {task.status === 'rejected' && (
                    <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold">
                            <span className="text-lg">❌</span>
                            <span>Result not accepted</span>
                        </div>
                        {task.verificationNote && (
                            <p className="text-sm text-red-600 dark:text-red-400">
                                <span className="font-medium">Agent feedback: </span>{task.verificationNote}
                            </p>
                        )}
                    </div>
                )}

                {/* Approved */}
                {task.status === 'approved' && (
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                            <span className="text-lg">✅</span>
                            <span>Task approved! {rewardLabel && `${rewardLabel} has been added to your balance.`}</span>
                        </div>
                        {task.verificationNote && (
                            <p className="text-sm text-green-600 dark:text-green-400">
                                <span className="font-medium">Agent note: </span>{task.verificationNote}
                            </p>
                        )}
                        {isAssignee && (
                            <a
                                href="/earnings"
                                className="inline-block mt-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
                            >
                                View earnings & collect payout →
                            </a>
                        )}
                    </div>
                )}

                {/* Completed (legacy) */}
                {task.status === 'completed' && (
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300">
                        <p className="font-semibold mb-1">Completed</p>
                        <p className="whitespace-pre-wrap">{task.result}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
