'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/formatters';
import { Card, CardHeader, CardFooter } from '../ui/card';
import { Button } from '../ui/button';

interface HistoryTask {
    id: string;
    title: string;
    status: string;
    reward: { amount: number; currency: string } | null;
    claimedAt: string | null;
    updatedAt: string;
    paidOut: boolean;
}

const HISTORY_STATUS_CFG: Record<string, { label: string; icon: string; textClass: string; bgClass: string }> = {
    completed:            { label: 'Completed',    icon: '✓', textClass: 'text-success', bgClass: 'bg-success/12' },
    approved:             { label: 'Approved',     icon: '✓', textClass: 'text-success', bgClass: 'bg-success/12' },
    pending_verification: { label: 'Under review', icon: '⏳', textClass: 'text-accent',  bgClass: 'bg-accent/12'  },
    rejected:             { label: 'Rejected',     icon: '✕', textClass: 'text-danger',  bgClass: 'bg-danger/12'  },
    expired:              { label: 'Missed',       icon: '⏱', textClass: 'text-muted',   bgClass: 'bg-elevated'   },
};

function HistoryRow({ task }: { task: HistoryTask }) {
    const cfg  = HISTORY_STATUS_CFG[task.status] ?? HISTORY_STATUS_CFG['expired'];
    const date = new Date(task.updatedAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-elevated">
            <span
                className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                    cfg.bgClass, cfg.textClass,
                )}
            >
                {cfg.icon}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-primary">{task.title}</p>
                <p className="text-xs mt-0.5 text-muted">{cfg.label} · {date}</p>
            </div>
            {task.reward && (
                <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs font-semibold text-success">
                        {formatCurrency(task.reward.amount, task.reward.currency)}
                    </span>
                    {task.paidOut && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5 bg-success/15 text-success">
                            Paid
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

type HistoryTab = 'done' | 'missed';

const PAGE_SIZE = 10;

export function SessionHistoryPanel() {
    const [tab, setTab]         = useState<HistoryTab>('done');
    const [tasks, setTasks]     = useState<HistoryTask[]>([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset]   = useState(0);

    useEffect(() => {
        setLoading(true);
        setTasks([]);
        setOffset(0);
        const controller = new AbortController();
        const timeout    = setTimeout(() => controller.abort(), 10_000);
        fetch(`/api/tasks/history?tab=${tab}&limit=${PAGE_SIZE}&offset=0`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
                setTasks(data.tasks ?? []);
                setTotal(data.total ?? 0);
            })
            .catch(() => { /* ignore */ })
            .finally(() => { clearTimeout(timeout); setLoading(false); });
        return () => { clearTimeout(timeout); controller.abort(); };
    }, [tab]);

    async function loadMore() {
        const nextOffset = offset + PAGE_SIZE;
        setOffset(nextOffset);
        const res  = await fetch(`/api/tasks/history?tab=${tab}&limit=${PAGE_SIZE}&offset=${nextOffset}`);
        const data = await res.json();
        setTasks((prev) => [...prev, ...(data.tasks ?? [])]);
    }

    const hasMore = tasks.length < total;

    return (
        <Card>
            <CardHeader>
                <span className="text-sm">🗂️</span>
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">Task history</p>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full bg-surface text-muted border border-border">
                    {total}
                </span>
            </CardHeader>

            {/* Tabs */}
            <div className="flex border-b border-border">
                {(['done', 'missed'] as HistoryTab[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            'flex-1 py-2 text-xs font-semibold transition-colors cursor-pointer',
                            tab === t
                                ? 'text-accent border-b-2 border-accent bg-accent/5'
                                : 'text-muted border-b-2 border-transparent',
                        )}
                    >
                        {t === 'done' ? '✓ Completed' : '⏱ Missed'}
                    </button>
                ))}
            </div>

            <div className="p-2 space-y-1 min-h-[6rem]">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                    </div>
                )}
                {!loading && tasks.length === 0 && (
                    <p className="text-center text-xs py-8 text-muted">
                        {tab === 'done' ? 'No completed tasks yet.' : 'No missed tasks — great work!'}
                    </p>
                )}
                {!loading && tasks.map((t) => <HistoryRow key={t.id} task={t} />)}
            </div>

            {hasMore && !loading && (
                <div className="px-4 pb-3">
                    <Button variant="outline" size="full" className="py-2 text-xs rounded-xl" onClick={loadMore}>
                        Load more
                    </Button>
                </div>
            )}
        </Card>
    );
}
