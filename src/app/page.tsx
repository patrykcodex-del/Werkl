'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import type { Task, TaskPriority, WorkerSession, TaskOffer, ReleaseReason } from '../types';
import { RELEASE_REASON_LABELS } from '../types';
import { useCountdown } from '../hooks/useCountdown';

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often the feed polls for new tasks (ms) */
const POLL_MS = 5_000;
/** Max rows shown in the feed */
const FEED_LIMIT = 20;

const POLL_INTERVAL_MS      = 3_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const STREAM_POLL_MS        = 4_000;
const STREAM_MAX            = 10;
const CONCURRENCY_LIMIT     = 3;
/** How long (ms) a "gone" task lingers with a fade-out before being removed */
const GONE_LINGER_MS        = 2_200;
const RELEASE_GRACE_SECS    = 30;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 5)   return 'just now';
    if (secs < 60)  return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const PRIORITY_DOT: Record<TaskPriority, { color: string; label: string }> = {
    urgent: { color: 'var(--red)',          label: '🔥' },
    high:   { color: 'var(--amber)',        label: '↑' },
    medium: { color: 'var(--accent)',       label: '·' },
    low:    { color: 'var(--text-muted)',   label: '·' },
};

const PRIORITY_COLOR: Record<TaskPriority, string> = {
    urgent: 'var(--red)',
    high:   'var(--amber)',
    medium: 'var(--accent)',
    low:    'var(--text-muted)',
};

// ─── Feed row ─────────────────────────────────────────────────────────────────

function FeedRow({ task, isNew }: { task: Task; isNew: boolean }) {
    const dot = PRIORITY_DOT[task.priority];
    const [hovered, setHovered] = useState(false);

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ${isNew ? 'feed-row-enter' : ''}`}
            style={{
                borderColor: hovered ? 'var(--accent)' : isNew ? 'var(--accent)' : 'var(--border)',
                backgroundColor: hovered
                    ? 'var(--bg-elevated)'
                    : isNew
                    ? 'var(--accent-glow)'
                    : 'var(--bg-surface)',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span
                className="shrink-0 w-2 h-2 rounded-full transition-transform duration-200"
                style={{
                    backgroundColor: dot.color,
                    transform: hovered ? 'scale(1.4)' : 'scale(1)',
                }}
                title={task.priority}
            />
            <p
                className="flex-1 text-sm font-medium truncate transition-colors duration-200"
                style={{ color: hovered ? 'var(--accent)' : 'var(--text-primary)' }}
            >
                {task.title}
            </p>
            {task.reward ? (
                <span
                    className="shrink-0 font-mono text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: 'var(--green)', backgroundColor: 'rgba(34,197,94,0.1)' }}
                >
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)}
                </span>
            ) : null}
            <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: 'var(--text-muted)', minWidth: '3.5rem', textAlign: 'right' }}>
                {timeAgo(task.createdAt)}
            </span>
        </div>
    );
}

// ─── Work session helpers ──────────────────────────────────────────────────────

function useSecondsLeft(expiresAt: string | undefined): number {
    const compute = (exp: string | undefined) =>
        exp ? Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 1000)) : 0;
    const [secs, setSecs] = useState(() => compute(expiresAt));
    useEffect(() => {
        if (!expiresAt) return;
        setSecs(compute(expiresAt));
        const id = setInterval(() => setSecs(compute(expiresAt)), 500);
        return () => clearInterval(id);
    }, [expiresAt]);
    return secs;
}

function StatusBadge({ status }: { status: WorkerSession['status'] }) {
    const cfg: Record<WorkerSession['status'], { label: string; color: string; bg: string }> = {
        active: { label: '● Receiving tasks', color: 'var(--green)',      bg: 'rgba(34,197,94,0.1)'  },
        paused: { label: '⏸ Not receiving',   color: 'var(--amber)',      bg: 'rgba(251,191,36,0.1)' },
        ended:  { label: '◼ Ended',            color: 'var(--text-muted)', bg: 'rgba(71,85,105,0.15)' },
    };
    const c = cfg[status];
    return (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: c.color, backgroundColor: c.bg }}>
            {c.label}
        </span>
    );
}

function StatCard({ icon, label, value, color, bg }: { icon: string; label: string; value: number; color: string; bg: string }) {
    return (
        <div className="flex flex-col gap-1.5 rounded-xl p-3"
            style={{ backgroundColor: bg, border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center justify-between">
                <span className="text-sm">{icon}</span>
                <span className="font-mono text-xl font-bold tabular-nums" style={{ color }}>{value}</span>
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
        </div>
    );
}

// ─── OfferCard ────────────────────────────────────────────────────────────────

interface OfferCardProps {
    offer: TaskOffer;
    onAccept: () => void;
    onSkip: () => void;
    onExpire: () => void;
    loading: boolean;
}

function OfferCard({ offer, onAccept, onSkip, onExpire, loading }: OfferCardProps) {
    const countdown  = useCountdown(offer.expiresAt);
    const secsLeft   = useSecondsLeft(offer.expiresAt);
    const isExpiring = secsLeft > 0 && secsLeft <= 8;
    const isExpired  = secsLeft === 0;

    const expiredFired = useRef(false);
    useEffect(() => {
        if (isExpired && !expiredFired.current) {
            expiredFired.current = true;
            onExpire();
        }
    }, [isExpired, onExpire]);

    const task = offer.task;
    const OFFER_TTL = 30;
    const progress = Math.max(0, Math.min(100, (secsLeft / OFFER_TTL) * 100));

    return (
        <div
            className="rounded-2xl border p-6 space-y-5 transition-colors duration-500"
            style={{
                borderColor: isExpiring ? 'var(--red)' : 'var(--accent)',
                backgroundColor: 'var(--bg-surface)',
                boxShadow: isExpiring
                    ? '0 0 0 1px rgba(248,113,113,0.3), 0 4px 24px rgba(248,113,113,0.12)'
                    : '0 0 0 1px rgba(99,102,241,0.25), 0 4px 24px rgba(99,102,241,0.1)',
            }}
        >
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: isExpiring ? 'var(--red)' : 'var(--accent)' }}
                />
            </div>

            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                        style={{ color: isExpiring ? 'var(--red)' : 'var(--accent)' }}>
                        {isExpiring ? '⚠ Expiring soon' : 'Task offered to you'}
                    </p>
                    <h2 className="text-lg font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {task?.title ?? 'Loading…'}
                    </h2>
                </div>
                <div className="shrink-0 text-right">
                    <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Accept within</p>
                    <p className={`font-mono text-3xl font-bold tabular-nums ${isExpiring ? 'animate-pulse' : ''}`}
                        style={{ color: isExpiring ? 'var(--red)' : 'var(--amber)' }}>
                        {countdown ?? '…'}
                    </p>
                </div>
            </div>

            {task?.description && (
                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {task.description}
                </p>
            )}

            <div className="flex flex-wrap gap-2">
                {task?.reward && (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1 rounded-full"
                        style={{ color: 'var(--green)', backgroundColor: 'rgba(34,197,94,0.1)' }}>
                        💰 {new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)}
                    </span>
                )}
                {task?.estimatedMins && (
                    <span className="inline-flex items-center gap-1 text-sm px-3 py-1 rounded-full"
                        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }}>
                        ⏱ ~{task.estimatedMins} min
                    </span>
                )}
                {task?.priority && (
                    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                        style={{ color: PRIORITY_COLOR[task.priority as TaskPriority], backgroundColor: 'var(--bg-elevated)' }}>
                        {task.priority}
                    </span>
                )}
            </div>

            <div className="flex gap-3 pt-1">
                <button onClick={onAccept} disabled={loading || isExpired}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-150 disabled:opacity-50"
                    style={{ backgroundColor: isExpiring ? 'var(--red)' : 'var(--accent)', color: '#fff' }}>
                    {loading ? 'Accepting…' : isExpired ? 'Expired' : 'Accept task'}
                </button>
                <button onClick={onSkip} disabled={loading}
                    className="px-5 py-3 rounded-xl font-semibold text-sm border transition-all duration-150 disabled:opacity-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                    Skip
                </button>
            </div>
        </div>
    );
}

// ─── StreamItem ───────────────────────────────────────────────────────────────

type StreamItemState = 'entering' | 'visible' | 'gone';

interface StreamTask extends Task {
    _streamState: StreamItemState;
}

interface StreamItemProps {
    task: StreamTask;
    isOffered: boolean;
    offerExpiresAt?: string;
}

function StreamItem({ task, isOffered, offerExpiresAt }: StreamItemProps) {
    const taskSecsLeft  = useSecondsLeft(task.expiresAt);
    const offerSecsLeft = useSecondsLeft(offerExpiresAt);
    const isGone = task._streamState === 'gone';

    const displaySecs   = isOffered ? offerSecsLeft : taskSecsLeft;
    const isExpiring    = !isGone && displaySecs > 0 && displaySecs <= 8;
    const OFFER_TTL     = 30;
    const offerProgress = isOffered ? Math.max(0, Math.min(100, (offerSecsLeft / OFFER_TTL) * 100)) : null;

    return (
        <div
            className="relative flex flex-col gap-1 px-3.5 py-2.5 rounded-xl border transition-all duration-300 overflow-hidden"
            style={{
                borderColor: isOffered
                    ? (isExpiring ? 'var(--red)' : 'var(--accent)')
                    : isExpiring ? 'rgba(248,113,113,0.35)' : 'var(--border)',
                backgroundColor: isOffered
                    ? (isExpiring ? 'rgba(248,113,113,0.07)' : 'rgba(99,102,241,0.08)')
                    : isExpiring ? 'rgba(248,113,113,0.04)' : 'var(--bg-surface)',
                boxShadow: isOffered && !isExpiring
                    ? '0 0 0 1px rgba(99,102,241,0.3)'
                    : isOffered && isExpiring
                    ? '0 0 0 1px rgba(248,113,113,0.35)'
                    : 'none',
                opacity: isGone ? 0 : 1,
                transform: isGone ? 'translateX(14px)' : 'translateX(0)',
            }}
        >
            {isOffered && offerProgress !== null && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    <div
                        className="h-full transition-all duration-500"
                        style={{ width: `${offerProgress}%`, backgroundColor: isExpiring ? 'var(--red)' : 'var(--accent)' }}
                    />
                </div>
            )}

            <div className="flex items-center gap-3">
                <span className="shrink-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                <p className="flex-1 text-xs font-medium truncate"
                    style={{
                        color: isGone ? 'var(--text-muted)' : 'var(--text-primary)',
                        textDecoration: isGone ? 'line-through' : 'none',
                        fontWeight: isOffered ? 600 : 500,
                    }}>
                    {task.title}
                </p>
                {task.reward && (
                    <span className="shrink-0 font-mono text-xs font-semibold"
                        style={{ color: 'var(--green)' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)}
                    </span>
                )}
                {isGone ? (
                    <span className="shrink-0 text-xs" style={{ color: 'var(--red)' }}>gone</span>
                ) : isOffered ? (
                    <span className={`shrink-0 font-mono text-xs tabular-nums font-bold ${isExpiring ? 'animate-pulse' : ''}`}
                        style={{ color: isExpiring ? 'var(--red)' : 'var(--accent)', minWidth: '2.5rem', textAlign: 'right' }}>
                        {displaySecs}s
                    </span>
                ) : task.expiresAt && taskSecsLeft > 0 ? (
                    <span className={`shrink-0 font-mono text-xs tabular-nums ${isExpiring ? 'animate-pulse' : ''}`}
                        style={{ color: isExpiring ? 'var(--red)' : 'var(--text-muted)', minWidth: '2.5rem', textAlign: 'right' }}>
                        {taskSecsLeft}s
                    </span>
                ) : (
                    <span className="shrink-0 font-mono text-xs"
                        style={{ color: 'var(--text-muted)', minWidth: '2.5rem', textAlign: 'right' }}>
                        open
                    </span>
                )}
            </div>

            {isOffered && !isGone && (
                <div className="flex items-center gap-1.5 pl-5">
                    <span className="text-xs font-semibold"
                        style={{ color: isExpiring ? 'var(--red)' : 'var(--accent)' }}>
                        {isExpiring ? '⚠ expiring' : '→ offered to you'}
                    </span>
                </div>
            )}
        </div>
    );
}

// ─── TickerRow ────────────────────────────────────────────────────────────────

const TICKER_ROW_H  = 44;
const TICKER_STEP_MS  = 1800;
const TICKER_SLIDE_MS = 420;

function TickerRow({ task }: { task: Task }) {
    return (
        <div
            className="flex items-center gap-3 px-3 rounded-lg shrink-0"
            style={{ height: TICKER_ROW_H, backgroundColor: 'var(--bg-elevated)' }}
        >
            <span className="shrink-0 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
            <p className="flex-1 text-xs truncate"
                style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                {task.title}
            </p>
            {task.reward && (
                <span className="shrink-0 font-mono text-xs font-semibold"
                    style={{ color: 'var(--green)' }}>
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)}
                </span>
            )}
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded"
                style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-surface)', fontSize: '0.65rem' }}>
                open
            </span>
        </div>
    );
}

function Ticker({ sourceTasks }: { sourceTasks: StreamTask[] }) {
    const [list, setList] = useState<Task[]>([]);
    const [translateY, setTranslateY] = useState(0);
    const [sliding, setSliding] = useState(false);
    const seenIds = useRef(new Set<string>());

    useEffect(() => {
        const fresh = sourceTasks.filter(
            (t) => t._streamState !== 'gone' && !seenIds.current.has(t.id)
        );
        if (fresh.length === 0) return;
        fresh.forEach((t) => seenIds.current.add(t.id));
        setList((prev) => [...prev, ...fresh].slice(-30));
    }, [sourceTasks]);

    useEffect(() => {
        if (list.length < 2) return;
        const id = setInterval(() => {
            setSliding(true);
            setTranslateY(-TICKER_ROW_H);
            setTimeout(() => {
                setList((prev) => prev.slice(1));
                setTranslateY(0);
                setSliding(false);
            }, TICKER_SLIDE_MS);
        }, TICKER_STEP_MS);
        return () => clearInterval(id);
    }, [list.length]);

    if (list.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 h-full">
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Watching for tasks…</p>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden h-full">
            <div className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, var(--bg-surface), transparent)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to top, var(--bg-surface), transparent)' }} />
            <div
                className="flex flex-col gap-1 px-2"
                style={{
                    transform: `translateY(${translateY}px)`,
                    transition: sliding ? `transform ${TICKER_SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)` : 'none',
                }}
            >
                {list.map((task) => <TickerRow key={task.id} task={task} />)}
            </div>
        </div>
    );
}

// ─── TaskStream ───────────────────────────────────────────────────────────────

interface TaskStreamProps {
    active: boolean;
    offeredTask?: Task;
    offerExpiresAt?: string;
    dismissTaskId?: string;
}

function TaskStream({ active, offeredTask, offerExpiresAt, dismissTaskId }: TaskStreamProps) {
    const offeredTaskId = offeredTask?.id;
    const offeredTaskIdRef = useRef<string | undefined>(undefined);
    offeredTaskIdRef.current = offeredTaskId;

    const [items, setItems] = useState<StreamTask[]>([]);
    const knownIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!offeredTask) return;
        setItems((prev) => {
            if (prev.some((it) => it.id === offeredTask.id)) return prev;
            knownIds.current.add(offeredTask.id);
            const injected: StreamTask = { ...offeredTask, _streamState: 'entering' };
            const next = [injected, ...prev].slice(0, STREAM_MAX);
            setTimeout(() => {
                setItems((p) =>
                    p.map((it) => it.id === offeredTask.id && it._streamState === 'entering'
                        ? { ...it, _streamState: 'visible' } : it)
                );
            }, 450);
            return next;
        });
    }, [offeredTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        async function poll() {
            try {
                const res = await fetch(`/api/tasks?status=open&sort=createdAt&order=desc&limit=${STREAM_MAX}`);
                if (!res.ok) return;
                const data: { tasks: Task[] } = await res.json();

                const fresh = data.tasks.filter((t) => !knownIds.current.has(t.id));
                fresh.forEach((t) => knownIds.current.add(t.id));

                if (fresh.length > 0) {
                    const entering: StreamTask[] = fresh.map((t) => ({ ...t, _streamState: 'entering' }));
                    setItems((prev) => [...entering, ...prev].slice(0, STREAM_MAX));
                    setTimeout(() => {
                        setItems((prev) =>
                            prev.map((it) => it._streamState === 'entering' ? { ...it, _streamState: 'visible' } : it)
                        );
                    }, 550);
                }

                const openIds = new Set(data.tasks.map((t) => t.id));
                setItems((prev) =>
                    prev.map((it) => {
                        if (it._streamState === 'gone') return it;
                        if (it.id === offeredTaskIdRef.current) return it;
                        if (!openIds.has(it.id)) return { ...it, _streamState: 'gone' as StreamItemState };
                        return it;
                    })
                );
            } catch { /* ignore */ }
        }

        poll();
        const id = setInterval(poll, STREAM_POLL_MS);
        return () => clearInterval(id);
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!dismissTaskId) return;
        setItems((prev) =>
            prev.map((it) =>
                it.id === dismissTaskId && it._streamState !== 'gone'
                    ? { ...it, _streamState: 'gone' as StreamItemState }
                    : it
            )
        );
    }, [dismissTaskId]);

    useEffect(() => {
        if (!items.some((it) => it._streamState === 'gone')) return;
        const id = setTimeout(() => {
            setItems((prev) => prev.filter((it) => it._streamState !== 'gone'));
        }, GONE_LINGER_MS);
        return () => clearTimeout(id);
    }, [items]);

    const sortedItems = [...items].sort((a, b) => {
        if (a.id === offeredTaskId) return -1;
        if (b.id === offeredTaskId) return 1;
        return 0;
    });

    const visibleCount = items.filter((it) => it._streamState !== 'gone' && it.id !== offeredTaskId).length;
    const tickerItems  = sortedItems.filter((it) => it.id !== offeredTaskId);
    const offeredItem  = sortedItems.find((it) => it.id === offeredTaskId);

    return (
        <div className="rounded-2xl border overflow-hidden flex flex-col w-full"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>

            <div className="flex items-center gap-2.5 px-4 py-3 border-b shrink-0"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                        style={{ backgroundColor: 'var(--green)' }} />
                    <span className="relative inline-flex rounded-full h-2 w-2"
                        style={{ backgroundColor: 'var(--green)' }} />
                </span>
                <p className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-secondary)' }}>
                    Live task stream
                </p>
                <span className="ml-auto font-mono text-xs px-1.5 py-0.5 rounded"
                    style={{ color: 'var(--green)', backgroundColor: 'rgba(34,197,94,0.1)' }}>
                    {visibleCount} open
                </span>
            </div>

            {active && offeredItem && (
                <div className="px-3 pt-3 pb-1 shrink-0">
                    <StreamItem task={offeredItem} isOffered={true} offerExpiresAt={offerExpiresAt} />
                </div>
            )}

            {active && offeredItem && tickerItems.length > 0 && (
                <div className="mx-3 my-1 border-t" style={{ borderColor: 'var(--border-dim)' }} />
            )}

            <div className="relative" style={{ height: '16rem' }}>
                <Ticker sourceTasks={tickerItems} />
            </div>

            <div className="px-4 py-2.5 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Tasks are routed to you — you cannot claim directly.
                </p>
            </div>
        </div>
    );
}

// ─── ActiveTasksPanel ─────────────────────────────────────────────────────────

function ActiveTaskExpandableRow({
    task,
    expanded,
    onToggle,
    onTaskUpdate,
}: {
    task: Task;
    expanded: boolean;
    onToggle: () => void;
    onTaskUpdate: (updated: Task) => void;
}) {
    const deadline = task.completionDeadline ?? task.claimExpiresAt;
    const secsLeft = useSecondsLeft(deadline);
    const totalSecs = task.completionMins
        ? task.completionMins * 60
        : task.claimTimeoutMins * 60;
    const pct = deadline ? Math.max(0, Math.min(100, (secsLeft / totalSecs) * 100)) : 100;
    const urgent = secsLeft > 0 && secsLeft < 120;
    const barColor = secsLeft === 0 ? 'var(--text-muted)' : urgent ? 'var(--red)' : 'var(--green)';
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    const timeStr = secsLeft > 0 ? `${mins}:${String(secs).padStart(2, '0')} left` : 'Expired';

    const [graceSecsLeft, setGraceSecsLeft] = useState<number | null>(null);
    useEffect(() => {
        if (!task.claimedAt) { setGraceSecsLeft(null); return; }
        const graceEndsMs = new Date(task.claimedAt).getTime() + RELEASE_GRACE_SECS * 1000;
        function tick() { setGraceSecsLeft(Math.max(0, Math.ceil((graceEndsMs - Date.now()) / 1000))); }
        tick();
        const id = setInterval(tick, 500);
        return () => clearInterval(id);
    }, [task.claimedAt]);

    const [result, setResult]                     = useState('');
    const [submitting, setSubmitting]             = useState(false);
    const [releasing, setReleasing]               = useState(false);
    const [releaseReason, setReleaseReason]       = useState<ReleaseReason | ''>('');
    const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);

    const deadlineCountdown = useCountdown(deadline ?? undefined);

    async function handleSubmitResult() {
        if (!result.trim()) return;
        setSubmitting(true);
        const res = await fetch(`/api/tasks/${task.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending_verification', result }),
        });
        if (res.ok) onTaskUpdate(await res.json());
        setSubmitting(false);
    }

    async function handleRelease() {
        setReleasing(true);
        setShowReleaseConfirm(false);
        try {
            const res = await fetch(`/api/tasks/${task.id}/release`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(releaseReason ? { reason: releaseReason } : {}),
            });
            if (res.ok) {
                window.location.reload();
            } else {
                const data = await res.json();
                alert(data.error ?? 'Could not release task.');
                setReleasing(false);
            }
        } catch {
            alert('Network error — could not release task.');
            setReleasing(false);
        }
    }

    const isActionable = task.status === 'claimed';

    return (
        <div className="rounded-xl overflow-hidden border transition-colors"
            style={{
                borderColor: expanded ? 'var(--accent)' : 'var(--border)',
                backgroundColor: 'var(--bg-elevated)',
            }}>

            <button
                onClick={onToggle}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                style={{ backgroundColor: 'transparent' }}
            >
                <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {task.title}
                    </p>
                    {deadline && (
                        <div className="mt-1 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
                                <div className="h-full rounded-full transition-all duration-1000"
                                    style={{ width: `${pct}%`, backgroundColor: barColor }} />
                            </div>
                            <span className="text-xs font-mono flex-shrink-0"
                                style={{ color: urgent ? 'var(--red)' : 'var(--text-muted)' }}>
                                {timeStr}
                            </span>
                        </div>
                    )}
                </div>
                {task.reward && (
                    <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--green)' }}>
                        {task.reward.currency}{task.reward.amount.toFixed(2)}
                    </span>
                )}
                <span className="text-xs flex-shrink-0 transition-transform duration-200"
                    style={{ color: 'var(--text-muted)', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    ›
                </span>
            </button>

            {expanded && (
                <div className="px-4 pb-4 pt-1 space-y-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    {task.description && (
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                            {task.description}
                        </p>
                    )}
                    {task.context && (
                        <div className="rounded-lg border p-3 space-y-1"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                                style={{ color: 'var(--text-muted)' }}>
                                Context from agent
                            </p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                                {task.context}
                            </p>
                        </div>
                    )}
                    {isActionable && deadlineCountdown && (
                        <div className="flex items-center gap-2 text-sm rounded-lg border px-3 py-2"
                            style={{
                                borderColor: deadlineCountdown === 'Expired' ? 'rgba(248,113,113,0.3)' : 'rgba(251,191,36,0.3)',
                                backgroundColor: deadlineCountdown === 'Expired' ? 'rgba(248,113,113,0.05)' : 'rgba(251,191,36,0.05)',
                                color: deadlineCountdown === 'Expired' ? 'var(--red)' : 'var(--amber)',
                            }}>
                            <span>⚡</span>
                            <span>Submit within <strong>{deadlineCountdown}</strong> or this task will be reassigned</span>
                        </div>
                    )}
                    {isActionable && (
                        <div className="space-y-2">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Submit your result</p>
                            <textarea
                                value={result}
                                onChange={(e) => setResult(e.target.value)}
                                placeholder="Enter your response or findings here…"
                                rows={4}
                                className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm focus:outline-none focus:ring-1 resize-y"
                                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                            />
                            <button
                                onClick={handleSubmitResult}
                                disabled={submitting || !result.trim()}
                                className="w-full py-2.5 text-sm font-semibold rounded-lg border transition-colors hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                                style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                            >
                                {submitting ? 'Submitting…' : 'Submit for verification'}
                            </button>
                        </div>
                    )}
                    {isActionable && (
                        <div className="pt-2 border-t space-y-2" style={{ borderColor: 'var(--border-dim)' }}>
                            {graceSecsLeft !== null && graceSecsLeft > 0 && (
                                <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
                                    style={{ borderColor: 'rgba(52,211,153,0.25)', backgroundColor: 'rgba(52,211,153,0.05)' }}>
                                    <p className="text-xs" style={{ color: 'var(--green)' }}>
                                        ✓ No penalty release available for the next <strong>{graceSecsLeft}s</strong>.
                                    </p>
                                </div>
                            )}
                            {graceSecsLeft === 0 && (
                                <div className="flex items-center gap-2 rounded-lg border px-3 py-2"
                                    style={{ borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(251,191,36,0.05)' }}>
                                    <span>⚠️</span>
                                    <p className="text-xs" style={{ color: 'var(--amber)' }}>
                                        Releasing now will affect your reliability score.
                                    </p>
                                </div>
                            )}
                            {showReleaseConfirm ? (
                                <div className="rounded-lg border p-3 space-y-3"
                                    style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.04)' }}>
                                    <p className="text-sm font-semibold" style={{ color: 'var(--red)' }}>Release this task?</p>
                                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                        The task will return to the queue and your reliability score will be reduced.
                                    </p>
                                    <select
                                        value={releaseReason}
                                        onChange={(e) => setReleaseReason(e.target.value as ReleaseReason | '')}
                                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', backgroundColor: 'var(--bg-elevated)' }}
                                    >
                                        <option value="">Reason (optional)</option>
                                        {(Object.entries(RELEASE_REASON_LABELS) as [ReleaseReason, string][]).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                    <div className="flex gap-2">
                                        <button onClick={handleRelease} disabled={releasing}
                                            className="flex-1 py-2 text-sm font-semibold rounded-lg disabled:opacity-50"
                                            style={{ backgroundColor: 'var(--red)', color: '#fff' }}>
                                            {releasing ? 'Releasing…' : 'Confirm release'}
                                        </button>
                                        <button onClick={() => setShowReleaseConfirm(false)} disabled={releasing}
                                            className="flex-1 py-2 text-sm rounded-lg border hover:bg-white/5 disabled:opacity-50"
                                            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                                            Keep task
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (graceSecsLeft && graceSecsLeft > 0) {
                                            handleRelease();
                                        } else {
                                            setShowReleaseConfirm(true);
                                        }
                                    }}
                                    disabled={releasing}
                                    className="w-full py-2 text-sm rounded-lg border transition-colors hover:bg-white/5 disabled:opacity-50"
                                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                                >
                                    {releasing ? 'Releasing…' : 'Release back to queue'}
                                </button>
                            )}
                        </div>
                    )}
                    {task.status === 'pending_verification' && (
                        <div className="rounded-lg border p-3 space-y-1"
                            style={{ borderColor: 'rgba(129,140,248,0.3)', backgroundColor: 'rgba(129,140,248,0.05)' }}>
                            <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--accent)' }}>
                                <span>⏳</span><span>Awaiting agent verification</span>
                            </div>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Your result has been submitted. The AI agent will review it shortly.
                            </p>
                            {task.result && (
                                <div className="rounded border p-2 text-sm mt-1"
                                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}>
                                    <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Your submission:</p>
                                    <p className="whitespace-pre-wrap">{task.result}</p>
                                </div>
                            )}
                        </div>
                    )}
                    {task.status === 'approved' && (
                        <div className="rounded-lg border p-3 space-y-1"
                            style={{ borderColor: 'rgba(52,211,153,0.3)', backgroundColor: 'rgba(52,211,153,0.05)' }}>
                            <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--green)' }}>
                                <span>✓</span>
                                <span>Approved!{task.reward && ` ${new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)} added to your balance.`}</span>
                            </div>
                            {task.verificationNote && (
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Note: </span>
                                    {task.verificationNote}
                                </p>
                            )}
                            <a href="/earnings" className="inline-block mt-1 px-3 py-1.5 text-xs font-semibold rounded-lg"
                                style={{ backgroundColor: 'var(--green)', color: '#000' }}>
                                View earnings →
                            </a>
                        </div>
                    )}
                    {task.status === 'rejected' && (
                        <div className="rounded-lg border p-3 space-y-1"
                            style={{ borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.05)' }}>
                            <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--red)' }}>
                                <span>✕</span><span>Result not accepted</span>
                            </div>
                            {task.verificationNote && (
                                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Feedback: </span>
                                    {task.verificationNote}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function ActiveTasksPanel({ tasks, onTaskUpdate }: { tasks: Task[]; onTaskUpdate: (updated: Task) => void }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    if (tasks.length === 0) return null;
    const atCapacity = tasks.length >= CONCURRENCY_LIMIT;
    return (
        <div className="rounded-2xl border overflow-hidden"
            style={{
                borderColor: atCapacity ? 'var(--yellow, #eab308)' : 'var(--accent)',
                backgroundColor: 'var(--bg-surface)',
            }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b"
                style={{
                    borderColor: atCapacity ? 'var(--yellow, #eab308)' : 'var(--accent)',
                    backgroundColor: atCapacity ? 'rgba(234,179,8,0.07)' : 'rgba(99,102,241,0.06)',
                }}>
                <span className="text-sm">{atCapacity ? '⚠️' : '📋'}</span>
                <p className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: atCapacity ? 'var(--yellow, #eab308)' : 'var(--accent)' }}>
                    {atCapacity ? 'Queue full' : 'Your active tasks'}
                </p>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                        backgroundColor: atCapacity ? 'var(--yellow, #eab308)' : 'var(--accent)',
                        color: atCapacity ? '#000' : '#fff',
                    }}>
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
            <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: atCapacity ? 'var(--yellow, #eab308)' : 'var(--text-muted)' }}>
                    {atCapacity
                        ? 'Complete or submit a task above to unlock your next offer.'
                        : `Click a task to expand it and submit your result. You can hold up to ${CONCURRENCY_LIMIT} tasks at once.`}
                </p>
            </div>
        </div>
    );
}

// ─── SessionHistoryPanel ──────────────────────────────────────────────────────

interface HistoryTask {
    id: string;
    title: string;
    status: string;
    reward: { amount: number; currency: string } | null;
    claimedAt: string | null;
    updatedAt: string;
    paidOut: boolean;
}

const HISTORY_STATUS_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    completed:            { label: 'Completed',     icon: '✓', color: 'var(--green)',      bg: 'rgba(34,197,94,0.12)'  },
    approved:             { label: 'Approved',      icon: '✓', color: 'var(--green)',      bg: 'rgba(34,197,94,0.12)'  },
    pending_verification: { label: 'Under review',  icon: '⏳', color: 'var(--accent)',    bg: 'rgba(99,102,241,0.12)' },
    rejected:             { label: 'Rejected',      icon: '✕', color: 'var(--red)',        bg: 'rgba(239,68,68,0.12)'  },
    expired:              { label: 'Missed',        icon: '⏱', color: 'var(--text-muted)', bg: 'rgba(71,85,105,0.15)' },
};

function HistoryRow({ task }: { task: HistoryTask }) {
    const cfg = HISTORY_STATUS_CFG[task.status] ?? HISTORY_STATUS_CFG['expired'];
    const date = new Date(task.updatedAt).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.icon}
            </span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{task.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {cfg.label} · {date}
                </p>
            </div>
            {task.reward && (
                <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-xs font-semibold" style={{ color: 'var(--green)' }}>
                        {task.reward.currency}{task.reward.amount.toFixed(2)}
                    </span>
                    {task.paidOut && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full mt-0.5"
                            style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: 'var(--green)' }}>
                            Paid
                        </span>
                    )}
                </div>
            )}
            <span className="text-xs opacity-40 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>·</span>
        </div>
    );
}

type HistoryTab = 'done' | 'missed';

function SessionHistoryPanel() {
    const [tab, setTab]         = useState<HistoryTab>('done');
    const [tasks, setTasks]     = useState<HistoryTask[]>([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [offset, setOffset]   = useState(0);
    const PAGE_SIZE = 10;

    useEffect(() => {
        setLoading(true);
        setTasks([]);
        setOffset(0);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        fetch(`/api/tasks/history?tab=${tab}&limit=${PAGE_SIZE}&offset=0`, { signal: controller.signal })
            .then((r) => r.json())
            .then((data) => {
                setTasks(data.tasks ?? []);
                setTotal(data.total ?? 0);
            })
            .catch(() => {/* ignore */})
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
        <div className="rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                <span className="text-sm">🗂️</span>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                    Task history
                </p>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {total}
                </span>
            </div>
            <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
                {(['done', 'missed'] as HistoryTab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                        className="flex-1 py-2 text-xs font-semibold transition-colors"
                        style={{
                            color:           tab === t ? 'var(--accent)'           : 'var(--text-muted)',
                            borderBottom:    tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                            backgroundColor: tab === t ? 'rgba(99,102,241,0.05)'   : 'transparent',
                        }}>
                        {t === 'done' ? '✓ Completed' : '⏱ Missed'}
                    </button>
                ))}
            </div>
            <div className="p-2 space-y-1 min-h-[6rem]">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 rounded-full border-2 animate-spin"
                            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                    </div>
                )}
                {!loading && tasks.length === 0 && (
                    <p className="text-center text-xs py-8" style={{ color: 'var(--text-muted)' }}>
                        {tab === 'done' ? 'No completed tasks yet.' : 'No missed tasks — great work!'}
                    </p>
                )}
                {!loading && tasks.map((t) => <HistoryRow key={t.id} task={t} />)}
            </div>
            {hasMore && !loading && (
                <div className="px-4 pb-3">
                    <button onClick={loadMore}
                        className="w-full py-2 text-xs rounded-xl border transition-colors"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                        Load more
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
    const { data: session, status } = useSession();

    // ── Feed state (signed-out) ───────────────────────────────────────────────

    const [tasks, setTasks] = useState<Task[]>([]);
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const knownIds = useRef<Set<string>>(new Set());
    const initialized = useRef(false);

    // ── Work session state (signed-in) ────────────────────────────────────────

    const [workerSession, setWorkerSession] = useState<WorkerSession | null>(null);
    const [offer, setOffer] = useState<TaskOffer | null>(null);
    const [activeTasks, setActiveTasks] = useState<Task[]>([]);
    const [statusLabel, setStatusLabel] = useState('Start earning to receive tasks');
    const [actionLoading, setActionLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [dismissTaskId, setDismissTaskId] = useState<string | undefined>(undefined);

    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Feed logic ────────────────────────────────────────────────────────────

    async function fetchFeed(isInitial = false) {
        try {
            const res = await fetch(
                `/api/tasks?status=open&sort=createdAt&order=desc&limit=${FEED_LIMIT}`
            );
            if (!res.ok) return;
            const data: { tasks: Task[] } = await res.json();
            const incoming = data.tasks;

            if (isInitial) {
                setTasks(incoming);
                knownIds.current = new Set(incoming.map((t) => t.id));
                setFeedLoading(false);
                initialized.current = true;
                return;
            }

            const fresh = incoming.filter((t) => !knownIds.current.has(t.id));
            if (fresh.length === 0) return;

            setPendingTasks((prev) => [...fresh, ...prev]);
            setPendingCount((n) => n + fresh.length);
            fresh.forEach((t) => knownIds.current.add(t.id));
        } catch {
            // network error — retry on next tick
        }
    }

    function flushPending() {
        if (pendingTasks.length === 0) return;
        const freshIds = new Set(pendingTasks.map((t) => t.id));
        setNewIds(freshIds);
        setTasks((prev) => {
            const merged = [...pendingTasks, ...prev];
            return merged.slice(0, FEED_LIMIT);
        });
        setPendingTasks([]);
        setPendingCount(0);
        setTimeout(() => setNewIds(new Set()), 3000);
    }

    useEffect(() => {
        if (session) return; // don't poll the feed when signed in
        fetchFeed(true);
        const interval = setInterval(() => fetchFeed(false), POLL_MS);
        return () => clearInterval(interval);
    }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Work session logic ────────────────────────────────────────────────────

    const stopTimers = useCallback(() => {
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (pollTimerRef.current)      clearInterval(pollTimerRef.current);
    }, []);

    const fetchCurrentOffer = useCallback(async () => {
        try {
            const res = await fetch('/api/offers/current');
            if (!res.ok) return;
            const data = await res.json();
            setOffer(data.offer ?? null);
            setStatusLabel(data.offer ? 'Task offered — accept within the time limit' : 'Waiting for next task…');
        } catch { /* retry on next poll */ }
    }, []);

    const fetchNextOfferAfterExpiry = useCallback(async () => {
        try {
            const res = await fetch('/api/offers/current');
            if (!res.ok) return;
            const data = await res.json();
            if (data.offer) {
                setOffer(data.offer);
                setStatusLabel('Task offered — accept within the time limit');
            } else {
                setOffer(null);
                setStatusLabel('Offer expired — waiting for next task…');
            }
        } catch { /* retry on next poll */ }
    }, []);

    const fetchActiveTasks = useCallback(async () => {
        try {
            const res = await fetch('/api/tasks/active');
            if (!res.ok) return;
            const data = await res.json();
            const fetchedTasks: Task[] = data.tasks ?? [];
            setActiveTasks(fetchedTasks);
            if (fetchedTasks.length >= CONCURRENCY_LIMIT) {
                setWorkerSession((prev) => {
                    if (prev?.status === 'active') {
                        fetch(`/api/sessions/${prev.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'pause' }),
                        }).catch(() => {/* ignore */});
                        return { ...prev, status: 'paused' };
                    }
                    return prev;
                });
                setOffer(null);
                stopTimers();
                setStatusLabel('Queue full — complete a task then resume to continue');
            }
        } catch { /* ignore */ }
    }, [stopTimers]);

    const sendHeartbeat = useCallback(async (sessionId: string) => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'heartbeat' }),
            });
            if (!res.ok) return;
            const data = await res.json();
            setWorkerSession(data.session);
            if (data.offer) {
                setOffer(data.offer);
                setStatusLabel('Task offered — accept within the time limit');
            }
        } catch { /* ignore */ }
    }, []);

    const startTimers = useCallback((ws: WorkerSession) => {
        stopTimers();
        pollTimerRef.current      = setInterval(() => { fetchCurrentOffer(); fetchActiveTasks(); }, POLL_INTERVAL_MS);
        heartbeatTimerRef.current = setInterval(() => sendHeartbeat(ws.id), HEARTBEAT_INTERVAL_MS);
    }, [fetchCurrentOffer, fetchActiveTasks, sendHeartbeat, stopTimers]);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user) { setInitialLoading(false); return; }
        fetch('/api/sessions')
            .then((r) => (r.ok ? r.json() : Promise.resolve({})))
            .then((data) => {
                setWorkerSession(data.session ?? null);
                if (data.session?.status === 'active') {
                    setStatusLabel('Waiting for next task…');
                    fetchCurrentOffer();
                    startTimers(data.session);
                } else if (data.session?.status === 'paused') {
                    setStatusLabel('Resume to start receiving tasks');
                } else {
                    setStatusLabel('Start a session to receive tasks');
                }
                fetchActiveTasks();
            })
            .finally(() => setInitialLoading(false));
    }, [session, status, fetchCurrentOffer, fetchActiveTasks, startTimers]);

    useEffect(() => () => stopTimers(), [stopTimers]);

    // ── Session actions ───────────────────────────────────────────────────────

    async function patchSession(action: string) {
        if (!workerSession) return null;
        const res = await fetch(`/api/sessions/${workerSession.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        });
        return res.json();
    }

    async function handlePauseSession() {
        setActionLoading(true);
        const data = await patchSession('pause');
        if (data) { setWorkerSession(data.session); setOffer(null); setStatusLabel('Session paused'); stopTimers(); }
        setActionLoading(false);
    }

    async function handleResumeSession() {
        setActionLoading(true);
        const data = await patchSession('resume');
        if (data) {
            setWorkerSession(data.session);
            await fetchActiveTasks();
            const stillFull = activeTasks.length >= CONCURRENCY_LIMIT;
            if (!stillFull) {
                setStatusLabel('Waiting for next task…');
                await fetchCurrentOffer();
                startTimers(data.session);
            }
        }
        setActionLoading(false);
    }

    async function handleAcceptOffer() {
        if (!offer) return;
        setActionLoading(true);
        setDismissTaskId(offer.taskId);
        const res = await fetch(`/api/offers/${offer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' }),
        });
        if (res.ok) {
            setOffer(null);
            setStatusLabel('Task accepted — waiting for next offer…');
            await fetchActiveTasks();
            if (workerSession) startTimers(workerSession);
        } else {
            const data = await res.json();
            setStatusLabel(data.error ?? 'Could not accept offer — finding another task');
            setOffer(null);
            if (workerSession) startTimers(workerSession);
        }
        setActionLoading(false);
    }

    async function handleSkipOffer() {
        if (!offer) return;
        setActionLoading(true);
        setDismissTaskId(offer.taskId);
        const res = await fetch(`/api/offers/${offer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'skip' }),
        });
        const data = res.ok ? await res.json() : null;
        const next = data?.nextOffer ?? null;
        setOffer(next);
        setStatusLabel(next ? 'Task offered — accept within the time limit' : 'Skipped — waiting for next task…');
        if (workerSession && !next) startTimers(workerSession);
        setActionLoading(false);
    }

    const handleExpireOffer = useCallback(async () => {
        setDismissTaskId(offer?.taskId);
        setStatusLabel('Offer expired — finding next task…');
        await fetchNextOfferAfterExpiry();
    }, [offer?.taskId, fetchNextOfferAfterExpiry]);

    async function handleStartSession() {
        setActionLoading(true);
        setStatusLabel('Starting session…');
        try {
            const res = await fetch('/api/sessions', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                const ws: WorkerSession = data.session;
                if (ws) {
                    setWorkerSession(ws);
                    setStatusLabel('Waiting for next task…');
                    fetchCurrentOffer();
                    fetchActiveTasks();
                    startTimers(ws);
                }
            } else {
                const data = await res.json().catch(() => ({})) as { error?: string };
                setStatusLabel(data.error ?? `Server error (${res.status}) — try again`);
            }
        } catch {
            setStatusLabel('Network error — could not start session');
        }
        setActionLoading(false);
    }

    // ── Render ────────────────────────────────────────────────────────────────

    const showHero   = !session;
    const isSignedIn = !!session?.user;
    const isActive   = workerSession?.status === 'active';
    const isPaused   = workerSession?.status === 'paused';

    if (isSignedIn && initialLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    return (
        <>
            <style>{`
                @keyframes feedSlideIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .feed-row-enter { animation: feedSlideIn 0.35s ease forwards; }
            `}</style>

            <div className="space-y-10">

                {/* ── Hero — only when signed out ── */}
                {showHero && (
                    <div
                        className="rounded-2xl border overflow-hidden"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2">

                            {/* Left — copy */}
                            <div
                                className="flex flex-col justify-center gap-8 px-10 py-14 md:py-16"
                                style={{ backgroundColor: 'var(--bg-surface)' }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--green)' }} />
                                        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--green)' }} />
                                    </span>
                                    <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                                        Tasks paying out right now
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <h1 className="text-5xl md:text-6xl font-extrabold leading-none tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                        Get paid<br />
                                        <span style={{ color: 'var(--accent)' }}>for helping<br />AI.</span>
                                    </h1>
                                    <div className="space-y-1 max-w-xs">
                                        {[
                                            "AI agents post tasks they can't finish alone.",
                                            'You solve them in minutes.',
                                            'You get paid.',
                                        ].map((line, i) => (
                                            <p key={i} className="text-sm font-medium leading-relaxed"
                                                style={{ color: i === 2 ? 'var(--accent)' : 'var(--text-secondary)' }}>
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        href="/auth/signin"
                                        className="cursor-pointer px-6 py-3 text-sm font-semibold rounded-lg transition-all"
                                        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                    >
                                        ⚡ Start earning now
                                    </Link>
                                </div>

                                <div className="flex gap-0 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                                    {[
                                        { value: '$2–$10', label: 'avg. per task' },
                                        { value: '~5 min', label: 'avg. completion' },
                                        { value: '100%',   label: 'fully remote' },
                                    ].map(({ value, label }, i) => (
                                        <div
                                            key={label}
                                            className="flex-1 flex flex-col gap-1 pr-4"
                                            style={i > 0 ? { borderLeft: '1px solid var(--border)', paddingLeft: '1rem' } : {}}
                                        >
                                            <p className="text-xl md:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
                                            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right — how it works */}
                            <div
                                className="hidden md:flex flex-col justify-center gap-12 px-12 py-16 border-l"
                                style={{
                                    borderColor: 'var(--border)',
                                    background: `
                                        radial-gradient(ellipse at 15% 85%, rgba(251,191,36,0.09) 0%, transparent 50%),
                                        radial-gradient(ellipse at 85% 15%, rgba(99,102,241,0.13) 0%, transparent 50%),
                                        var(--bg-elevated)
                                    `,
                                }}
                            >
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="h-px flex-1" style={{ backgroundColor: 'var(--text-muted)' }} />
                                        <p className="font-mono text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                            How it works
                                        </p>
                                        <span className="h-px flex-1" style={{ backgroundColor: 'var(--text-muted)' }} />
                                    </div>
                                    <p className="text-center text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                                        Easy as{' '}
                                        <span style={{ color: 'var(--accent)' }}>1</span>
                                        <span style={{ color: 'var(--amber)' }}>2</span>
                                        <span style={{ color: 'var(--green)' }}>3</span>
                                    </p>
                                </div>

                                <div className="flex flex-col gap-10">
                                    {[
                                        {
                                            step: '01', icon: '⚡', title: 'Start a session',
                                            desc: 'Click "Start earning" and tasks are routed directly to you — no racing, no bots.',
                                            color: 'var(--accent)', border: 'rgba(129,140,248,0.5)', glow: 'rgba(129,140,248,0.12)',
                                        },
                                        {
                                            step: '02', icon: '✅', title: 'Accept & complete',
                                            desc: 'Apply your human judgement to solve it — usually under 5 minutes.',
                                            color: 'var(--amber)', border: 'rgba(251,191,36,0.5)', glow: 'rgba(251,191,36,0.1)',
                                        },
                                        {
                                            step: '03', icon: '🎉', title: 'Get paid',
                                            desc: 'Earnings hit your account the moment your work is accepted.',
                                            color: 'var(--green)', border: 'rgba(52,211,153,0.5)', glow: 'rgba(52,211,153,0.1)',
                                        },
                                    ].map(({ step, icon, title, desc, color, border, glow }, i, arr) => (
                                        <div key={step} className="relative flex gap-6 items-start">
                                            {i < arr.length - 1 && (
                                                <span
                                                    className="absolute left-6 top-12 w-0.5 rounded-full"
                                                    style={{ height: 'calc(100% + 2.5rem)', background: `linear-gradient(to bottom, ${color}, var(--border))` }}
                                                />
                                            )}
                                            <div
                                                className="relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg"
                                                style={{ background: `linear-gradient(${glow}, ${glow}), var(--bg-elevated)`, border: `1px solid ${border}`, zIndex: 1 }}
                                            >
                                                {icon}
                                            </div>
                                            <div className="flex flex-col gap-2 pt-1.5">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-mono text-lg font-extrabold tabular-nums" style={{ color, textShadow: `0 0 12px ${color}` }}>{step}</span>
                                                    <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                                                </div>
                                                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Work section ── */}
                <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Work Session</h1>
                                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    Tasks are routed fairly to you — no racing, no bots.
                                </p>
                            </div>
                            {workerSession && <StatusBadge status={workerSession.status} />}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

                            {/* LEFT — controls + offer */}
                            <div className="space-y-5">

                                {/* Session card */}
                                <div className="rounded-2xl border overflow-hidden"
                                    style={{
                                        borderColor: isActive ? 'var(--green)' : 'var(--border)',
                                        backgroundColor: 'var(--bg-surface)',
                                    }}>

                                    <div className="flex items-center gap-2.5 px-5 py-3 border-b"
                                        style={{
                                            borderColor: isActive ? 'rgba(34,197,94,0.25)' : 'var(--border)',
                                            backgroundColor: isActive
                                                ? 'rgba(34,197,94,0.06)'
                                                : isPaused
                                                ? 'rgba(251,191,36,0.04)'
                                                : 'var(--bg-elevated)',
                                        }}>
                                        {isActive ? (
                                            <span className="relative flex h-2.5 w-2.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50"
                                                    style={{ backgroundColor: 'var(--accent)' }} />
                                                <span className="relative inline-flex rounded-full h-2.5 w-2.5"
                                                    style={{ backgroundColor: 'var(--accent)' }} />
                                            </span>
                                        ) : isPaused ? (
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--amber)' }} />
                                        ) : (
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--text-muted)' }} />
                                        )}
                                        <p className="text-sm font-semibold"
                                            style={{ color: isActive ? 'var(--accent)' : isPaused ? 'var(--amber)' : 'var(--text-muted)' }}>
                                            {isActive ? 'Receiving tasks' : isPaused ? 'Not receiving tasks' : 'No active session'}
                                        </p>
                                    </div>

                                    <div className="px-5 py-4 space-y-4">
                                        {workerSession && (
                                            <div className="grid grid-cols-3 gap-3">
                                                <StatCard icon="✓" label="Accepted" value={workerSession.acceptedCount} color="var(--green)" bg="rgba(34,197,94,0.07)" />
                                                <StatCard icon="›" label="Skipped"  value={workerSession.skippedCount}  color="var(--amber)" bg="rgba(251,191,36,0.07)" />
                                                <StatCard icon="⏱" label="Expired"  value={workerSession.expiredOfferCount} color="var(--red)" bg="rgba(248,113,113,0.07)" />
                                            </div>
                                        )}

                                        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                                            style={{ backgroundColor: 'var(--bg-elevated)' }}>
                                            {isActive && offer ? (
                                                <>
                                                    <span className="text-base">📬</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>New task offered</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Review and accept before the timer runs out</p>
                                                    </div>
                                                </>
                                            ) : isActive && activeTasks.length >= CONCURRENCY_LIMIT ? (
                                                <>
                                                    <span className="text-base">⚠️</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--amber)' }}>Queue full ({activeTasks.length}/{CONCURRENCY_LIMIT})</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Submit or release a task to receive new offers</p>
                                                    </div>
                                                </>
                                            ) : isActive ? (
                                                <>
                                                    <div className="flex gap-1">
                                                        {[0, 150, 300].map((delay) => (
                                                            <div key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                                                                style={{ backgroundColor: 'var(--accent)', animationDelay: `${delay}ms` }} />
                                                        ))}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Scanning for tasks…</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>You'll be notified as soon as one is routed to you</p>
                                                    </div>
                                                </>
                                            ) : isPaused ? (
                                                <>
                                                    <span className="text-base">⏸</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Not receiving tasks</p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Hit "Send me tasks" when you're ready to pick up more work</p>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="text-base">💤</span>
                                                    <div className="flex-1">
                                                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                            {statusLabel.startsWith('Could not') || statusLabel.startsWith('Network error')
                                                                ? statusLabel
                                                                : 'No active session'}
                                                        </p>
                                                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                            Click "Start a session" below to begin receiving tasks
                                                        </p>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="px-5 pb-5">
                                        {!isSignedIn ? (
                                            <Link href="/auth/signin"
                                                className="block w-full py-3 rounded-xl font-semibold text-sm transition-all text-center"
                                                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                                                Sign in to start earning
                                            </Link>
                                        ) : isActive ? (
                                            <button onClick={handlePauseSession} disabled={actionLoading}
                                                className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                                                style={{ backgroundColor: 'rgba(248,113,113,0.12)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.3)' }}>
                                                Stop sending me tasks
                                            </button>
                                        ) : isPaused ? (
                                            <button onClick={handleResumeSession} disabled={actionLoading}
                                                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                                                {actionLoading ? 'Starting…' : 'Send me tasks'}
                                            </button>
                                        ) : (
                                            <button onClick={handleStartSession} disabled={actionLoading}
                                                className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                                                {actionLoading ? 'Starting…' : 'Start a session'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Offer card */}
                                {isActive && offer && (
                                    <OfferCard
                                        offer={offer}
                                        onAccept={handleAcceptOffer}
                                        onSkip={handleSkipOffer}
                                        onExpire={handleExpireOffer}
                                        loading={actionLoading}
                                    />
                                )}

                                {/* Active tasks panel */}
                                <ActiveTasksPanel
                                    tasks={activeTasks}
                                    onTaskUpdate={(updated) =>
                                        setActiveTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t))
                                    }
                                />

                                {/* Session history */}
                                {isSignedIn && <SessionHistoryPanel />}

                                {/* How it works */}
                                <div className="rounded-2xl border overflow-hidden"
                                    style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                                    <div className="flex items-center gap-2 px-4 py-3 border-b"
                                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                                        <span className="text-sm">💡</span>
                                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                                            How it works
                                        </p>
                                    </div>
                                    <div className="p-4 space-y-4">
                                        {[
                                            { step: '1', title: 'Start a work session', desc: "Click \"Start earning\" to join the active worker pool. You'll stay in the queue while your session is open." },
                                            { step: '2', title: 'Receive a task offer',  desc: "When a task matches your session, you'll get an offer with a short countdown. Accept it before the timer runs out." },
                                            { step: '3', title: 'Complete the task',     desc: 'Work through your active tasks and mark each one complete. You can hold multiple tasks at once.' },
                                            { step: '4', title: 'Earn rewards',          desc: 'Completed tasks add to your balance. Request a payout any time from the Earnings page.' },
                                        ].map(({ step, title, desc }) => (
                                            <div key={step} className="flex gap-3">
                                                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                                                    style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                                                    {step}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{desc}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — live task stream */}
                            <div className="lg:sticky lg:top-20 self-start">
                                <TaskStream
                                    active={isActive}
                                    offeredTask={offer?.task}
                                    offerExpiresAt={offer?.expiresAt}
                                    dismissTaskId={dismissTaskId}
                                />
                            </div>
                        </div>
                </div>
            </div>
        </>
    );
}
