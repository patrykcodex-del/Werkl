'use client';

/**
 * /work — Active Work Session page
 *
 * Layout (active session):
 *   Left col  — session controls + current offer card (or waiting state)
 *   Right col — ambient task stream: tasks float in as they arrive,
 *               show live countdowns, fade/strikethrough when claimed/expired
 *
 * The stream is read-only context — workers can only accept via the routed offer.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { Task, TaskPriority, WorkerSession, TaskOffer } from '../../types';
import { useCountdown } from '../../hooks/useCountdown';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS      = 3_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const STREAM_POLL_MS        = 4_000;
const STREAM_MAX            = 10;
const CONCURRENCY_LIMIT     = 3;
/** How long (ms) a "gone" task lingers with a fade-out before being removed */
const GONE_LINGER_MS        = 2_200;

const PRIORITY_COLOR: Record<TaskPriority, string> = {
    urgent: 'var(--red)',
    high:   'var(--amber)',
    medium: 'var(--accent)',
    low:    'var(--text-muted)',
};

// ─── Seconds-left hook ────────────────────────────────────────────────────────

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

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: WorkerSession['status'] }) {
    const cfg: Record<WorkerSession['status'], { label: string; color: string; bg: string }> = {
        active: { label: '● Active', color: 'var(--green)',      bg: 'rgba(34,197,94,0.1)'  },
        paused: { label: '⏸ Paused', color: 'var(--amber)',      bg: 'rgba(251,191,36,0.1)' },
        ended:  { label: '◼ Ended',  color: 'var(--text-muted)', bg: 'rgba(71,85,105,0.15)' },
    };
    const c = cfg[status];
    return (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ color: c.color, backgroundColor: c.bg }}>
            {c.label}
        </span>
    );
}

function StatPill({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <span className="font-mono text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
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

    // Fire onExpire exactly once when the countdown first reaches zero.
    // The ref guards against repeated calls on subsequent re-renders.
    const expiredFired = useRef(false);
    useEffect(() => {
        if (isExpired && !expiredFired.current) {
            expiredFired.current = true;
            onExpire();
        }
    }, [isExpired, onExpire]);

    const task = offer.task;

    // Progress bar — offer TTL matches OFFER_TTL_SECS in sessionStore (30 s)
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
            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                        width: `${progress}%`,
                        backgroundColor: isExpiring ? 'var(--red)' : 'var(--accent)',
                    }}
                />
            </div>

            {/* Header */}
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

            {/* Description */}
            {task?.description && (
                <p className="text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {task.description}
                </p>
            )}

            {/* Meta */}
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

            {/* Actions */}
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
    /** When this task is the current offer, pass the offer's expiresAt so the countdown mirrors the left card */
    offerExpiresAt?: string;
}

function StreamItem({ task, isOffered, offerExpiresAt }: StreamItemProps) {
    const taskSecsLeft  = useSecondsLeft(task.expiresAt);
    const offerSecsLeft = useSecondsLeft(offerExpiresAt);
    const isGone = task._streamState === 'gone';

    // For the offered row, show the offer TTL draining; otherwise show task expiry if set
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
            {/* Offer TTL drain bar — only on the offered row */}
            {isOffered && offerProgress !== null && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    <div
                        className="h-full transition-all duration-500"
                        style={{
                            width: `${offerProgress}%`,
                            backgroundColor: isExpiring ? 'var(--red)' : 'var(--accent)',
                        }}
                    />
                </div>
            )}

            <div className="flex items-center gap-3">
                {/* Priority dot */}
                <span className="shrink-0 w-2 h-2 rounded-full"
                    style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />

                {/* Title */}
                <p className="flex-1 text-xs font-medium truncate"
                    style={{
                        color: isGone ? 'var(--text-muted)' : isOffered ? 'var(--text-primary)' : 'var(--text-primary)',
                        textDecoration: isGone ? 'line-through' : 'none',
                        fontWeight: isOffered ? 600 : 500,
                    }}>
                    {task.title}
                </p>

                {/* Reward */}
                {task.reward && (
                    <span className="shrink-0 font-mono text-xs font-semibold"
                        style={{ color: 'var(--green)' }}>
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)}
                    </span>
                )}

                {/* Right-side indicator */}
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

            {/* "Offered to you" label row */}
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

const TICKER_ROW_H = 44; // px — must match the rendered row height
const TICKER_STEP_MS = 1800; // how long each row stays before scrolling up
const TICKER_SLIDE_MS = 420; // transition duration

/** Non-interactive row for the scrolling ticker. */
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

/**
 * Continuous upward ticker.
 * Slides the list up by TICKER_ROW_H every TICKER_STEP_MS, then shifts the
 * top item off and snaps back — creating a seamless infinite scroll effect.
 */
function Ticker({ sourceTasks }: { sourceTasks: StreamTask[] }) {
    const [list, setList] = useState<Task[]>([]);
    const [translateY, setTranslateY] = useState(0);
    const [sliding, setSliding] = useState(false);
    const seenIds = useRef(new Set<string>());

    // Sync incoming tasks — append new ones to the bottom
    useEffect(() => {
        const fresh = sourceTasks.filter(
            (t) => t._streamState !== 'gone' && !seenIds.current.has(t.id)
        );
        if (fresh.length === 0) return;
        fresh.forEach((t) => seenIds.current.add(t.id));
        setList((prev) => [...prev, ...fresh].slice(-30));
    }, [sourceTasks]);

    // Scroll loop — only runs when there are enough rows to scroll
    useEffect(() => {
        if (list.length < 2) return;
        const id = setInterval(() => {
            // 1. Slide up
            setSliding(true);
            setTranslateY(-TICKER_ROW_H);
            // 2. After slide completes, snap: remove top item, reset position
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
            {/* Top fade */}
            <div className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none"
                style={{ background: 'linear-gradient(to bottom, var(--bg-surface), transparent)' }} />
            {/* Bottom fade */}
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
    /** Full task object currently being offered — pinned at top and highlighted */
    offeredTask?: Task;
    /** Offer's own expiresAt — used to sync the TTL drain bar with the left card */
    offerExpiresAt?: string;
    /** Task ID to immediately eject (after skip or accept) */
    dismissTaskId?: string;
}

function TaskStream({ active, offeredTask, offerExpiresAt, dismissTaskId }: TaskStreamProps) {
    const offeredTaskId = offeredTask?.id;
    const offeredTaskIdRef = useRef<string | undefined>(undefined);
    offeredTaskIdRef.current = offeredTaskId;

    const [items, setItems] = useState<StreamTask[]>([]);
    const knownIds = useRef<Set<string>>(new Set());

    // Inject the offered task into the stream as soon as we receive it
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

                    // Transition entering → visible
                    setTimeout(() => {
                        setItems((prev) =>
                            prev.map((it) => it._streamState === 'entering' ? { ...it, _streamState: 'visible' } : it)
                        );
                    }, 550);
                }

                // Mark tasks no longer open as "gone" — but NOT the currently offered task
                // (it's in 'offered' status server-side so it won't appear in the open list,
                //  but we want to keep it visible in the stream until it's accepted/skipped)
                const openIds = new Set(data.tasks.map((t) => t.id));
                setItems((prev) =>
                    prev.map((it) => {
                        if (it._streamState === 'gone') return it;
                        if (it.id === offeredTaskIdRef.current) return it; // keep offered task visible
                        if (!openIds.has(it.id)) return { ...it, _streamState: 'gone' as StreamItemState };
                        return it;
                    })
                );
            } catch { /* ignore */ }
        }

        poll();
        const id = setInterval(poll, STREAM_POLL_MS);
        return () => clearInterval(id);
    }, [active]); // offeredTaskId intentionally excluded — accessed via ref to avoid restarting the interval

    // Immediately eject a task when dismissed (skip or accept)
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

    // Remove "gone" items after they finish their exit animation
    useEffect(() => {
        if (!items.some((it) => it._streamState === 'gone')) return;
        const id = setTimeout(() => {
            setItems((prev) => prev.filter((it) => it._streamState !== 'gone'));
        }, GONE_LINGER_MS);
        return () => clearTimeout(id);
    }, [items]);

    // Sort: offered task always floats to top
    const sortedItems = [...items].sort((a, b) => {
        if (a.id === offeredTaskId) return -1;
        if (b.id === offeredTaskId) return 1;
        return 0;
    });

    const visibleCount = items.filter((it) => it._streamState !== 'gone' && it.id !== offeredTaskId).length;
    const tickerItems  = sortedItems.filter((it) => it.id !== offeredTaskId);
    const offeredItem  = sortedItems.find((it) => it.id === offeredTaskId);

    return (
        <>            <div className="rounded-2xl border overflow-hidden flex flex-col"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)', width: '18rem' }}>

                {/* Header */}
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

                {/* Offered task — pinned at top, full card */}
                {active && offeredItem && (
                    <div className="px-3 pt-3 pb-1 shrink-0">
                        <StreamItem
                            task={offeredItem}
                            isOffered={true}
                            offerExpiresAt={offerExpiresAt}
                        />
                    </div>
                )}

                {/* Divider when offered task is showing */}
                {active && offeredItem && tickerItems.length > 0 && (
                    <div className="mx-3 my-1 border-t" style={{ borderColor: 'var(--border-dim)' }} />
                )}

                {/* Ticker — continuous upward scroll of other open tasks */}
                <div className="relative" style={{ height: '16rem' }}>
                    <Ticker sourceTasks={tickerItems} />
                </div>

                {/* Footer note */}
                <div className="px-4 py-2.5 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Tasks are routed to you — you cannot claim directly.
                    </p>
                </div>
            </div>
        </>
    );
}

// ─── ActiveTasksPanel ─────────────────────────────────────────────────────────

function ActiveTaskRow({ task }: { task: Task }) {
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
    const timeStr = secsLeft > 0
        ? `${mins}:${String(secs).padStart(2, '0')} left`
        : 'Expired';

    return (
        <a href={`/tasks/${task.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
            style={{ backgroundColor: 'var(--bg-elevated)' }}>
            {/* Priority dot */}
            <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }} />

            {/* Title + deadline bar */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:underline"
                    style={{ color: 'var(--text-primary)' }}>
                    {task.title}
                </p>
                {deadline && (
                    <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden"
                            style={{ backgroundColor: 'var(--border)' }}>
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

            {/* Reward */}
            {task.reward && (
                <span className="text-xs font-semibold flex-shrink-0"
                    style={{ color: 'var(--green)' }}>
                    {task.reward.currency}{task.reward.amount.toFixed(2)}
                </span>
            )}

            {/* Arrow */}
            <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: 'var(--text-primary)' }}>→</span>
        </a>
    );
}

function ActiveTasksPanel({ tasks }: { tasks: Task[] }) {
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
                {tasks.map((t) => <ActiveTaskRow key={t.id} task={t} />)}
            </div>
            <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs" style={{ color: atCapacity ? 'var(--yellow, #eab308)' : 'var(--text-muted)' }}>
                    {atCapacity
                        ? 'Complete or submit a task above to unlock your next offer.'
                        : `Click any task to continue working on it. You can hold up to ${CONCURRENCY_LIMIT} tasks at once.`}
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
        <a href={`/tasks/${task.id}`}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors group"
            style={{ backgroundColor: 'var(--bg-elevated)' }}>

            {/* Status icon */}
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.icon}
            </span>

            {/* Title + date */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate group-hover:underline"
                    style={{ color: 'var(--text-primary)' }}>
                    {task.title}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {cfg.label} · {date}
                </p>
            </div>

            {/* Reward / paid badge */}
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

            <span className="text-xs opacity-40 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: 'var(--text-primary)' }}>→</span>
        </a>
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

        fetch(`/api/tasks/history?tab=${tab}&limit=${PAGE_SIZE}&offset=0`)
            .then((r) => r.json())
            .then((data) => {
                setTasks(data.tasks ?? []);
                setTotal(data.total ?? 0);
            })
            .catch(() => {/* ignore */})
            .finally(() => setLoading(false));
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

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                <span className="text-sm">🗂️</span>
                <p className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-secondary)' }}>
                    Task history
                </p>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                    {total}
                </span>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
                {(['done', 'missed'] as HistoryTab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                        className="flex-1 py-2 text-xs font-semibold transition-colors"
                        style={{
                            color:           tab === t ? 'var(--accent)'       : 'var(--text-muted)',
                            borderBottom:    tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                            backgroundColor: tab === t ? 'rgba(99,102,241,0.05)' : 'transparent',
                        }}>
                        {t === 'done' ? '✓ Completed' : '⏱ Missed'}
                    </button>
                ))}
            </div>

            {/* Body */}
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

            {/* Load more */}
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

export default function WorkPage() {
    const { data: authSession, status: authStatus } = useSession();
    const router = useRouter();

    const [workerSession, setWorkerSession] = useState<WorkerSession | null>(null);
    const [offer, setOffer] = useState<TaskOffer | null>(null);
    const [activeTasks, setActiveTasks] = useState<Task[]>([]);
    const [statusLabel, setStatusLabel] = useState('Start earning to receive tasks');
    const [actionLoading, setActionLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [dismissTaskId, setDismissTaskId] = useState<string | undefined>(undefined);

    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);

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

    /**
     * Like fetchCurrentOffer but only SETS the offer — never clears it.
     * Used after an expiry so the expired card stays visible until the new
     * offer is ready, avoiding a blank flash.
     */
    const fetchNextOfferAfterExpiry = useCallback(async () => {
        try {
            const res = await fetch('/api/offers/current');
            if (!res.ok) return;
            const data = await res.json();
            if (data.offer) {
                setOffer(data.offer);
                setStatusLabel('Task offered — accept within the time limit');
            } else {
                // No immediate offer — now it's safe to clear the expired card
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
            const tasks: Task[] = data.tasks ?? [];
            setActiveTasks(tasks);
            if (tasks.length >= CONCURRENCY_LIMIT) {
                // Auto-pause the session so the UI is honest — nothing is coming in anyway.
                setWorkerSession((prev) => {
                    if (prev?.status === 'active') {
                        // Fire-and-forget the pause API; we optimistically update UI immediately.
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

    const startTimers = useCallback((session: WorkerSession) => {
        stopTimers();
        pollTimerRef.current      = setInterval(() => { fetchCurrentOffer(); fetchActiveTasks(); }, POLL_INTERVAL_MS);
        heartbeatTimerRef.current = setInterval(() => sendHeartbeat(session.id), HEARTBEAT_INTERVAL_MS);
    }, [fetchCurrentOffer, fetchActiveTasks, sendHeartbeat, stopTimers]);

    useEffect(() => {
        if (authStatus === 'loading') return;
        if (!authSession?.user) { setInitialLoading(false); return; }
        fetch('/api/sessions')
            .then((r) => r.json())
            .then((data) => {
                setWorkerSession(data.session);
                if (data.session?.status === 'active') {
                    setStatusLabel('Waiting for next task…');
                    fetchCurrentOffer();
                    startTimers(data.session);
                } else {
                    setStatusLabel('Resume to start receiving tasks');
                }
                // Always fetch active tasks on mount — catches tasks from paused sessions
                fetchActiveTasks();
            })
            .finally(() => setInitialLoading(false));
    }, [authSession, authStatus, fetchCurrentOffer, fetchActiveTasks, startTimers]);

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
            await fetchActiveTasks(); // will auto-pause again immediately if still at capacity
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
        setDismissTaskId(offer.taskId); // eject from stream immediately
        const res = await fetch(`/api/offers/${offer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'accept' }),
        });
        if (res.ok) {
            setOffer(null);
            setStatusLabel('Task accepted — waiting for next offer…');
            await fetchActiveTasks();
            // Keep the session running so the next offer can come through
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
        setDismissTaskId(offer.taskId); // eject from stream immediately
        const res = await fetch(`/api/offers/${offer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'skip' }),
        });
        const data = res.ok ? await res.json() : null;
        const next = data?.nextOffer ?? null;
        setOffer(next);
        setStatusLabel(next ? 'Task offered — accept within the time limit' : 'Skipped — waiting for next task…');
        if (workerSession && !next) startTimers(workerSession); // keep polling if no immediate offer
        setActionLoading(false);
    }

    const handleExpireOffer = useCallback(async () => {
        // Dismiss the expired task from the stream, but keep the offer card
        // visible until the replacement arrives — avoids a blank flash.
        setDismissTaskId(offer?.taskId);
        setStatusLabel('Offer expired — finding next task…');
        await fetchNextOfferAfterExpiry();
    }, [offer?.taskId, fetchNextOfferAfterExpiry]);

    // ── Render ────────────────────────────────────────────────────────────────

    if (authStatus === 'loading' || initialLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="w-6 h-6 rounded-full border-2 animate-spin"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            </div>
        );
    }

    if (!authSession?.user) {
        return (
            <div className="flex flex-col items-center justify-center py-32 gap-5 text-center">
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Sign in to start working
                </h1>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    You need to be signed in to receive and complete tasks.
                </p>
                <button
                    onClick={() => signIn('google', {}, { prompt: 'select_account' })}
                    className="px-6 py-3 rounded-xl font-semibold text-sm"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                    Sign in with Google
                </button>
            </div>
        );
    }

    const isActive   = workerSession?.status === 'active';
    const isPaused   = workerSession?.status === 'paused';

    return (
        <div className="space-y-6 py-2">
            {/* ── Page header ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Work Session</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                        Tasks are routed fairly to you — no racing, no bots.
                    </p>
                </div>
                {workerSession && <StatusBadge status={workerSession.status} />}
            </div>

            {/* ── Main grid — always two-column ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

                {/* LEFT — controls + offer */}
                <div className="space-y-5">

                    {/* Session card */}
                    <div className="rounded-2xl border p-5 space-y-4"
                        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>

                        <div className="flex items-center justify-between gap-3">
                            {/* Stats */}
                            <div>
                                {workerSession && (
                                    <div className="flex gap-3">
                                        <StatPill label="Accepted" value={workerSession.acceptedCount} />
                                        <StatPill label="Skipped"  value={workerSession.skippedCount} />
                                        <StatPill label="Expired"  value={workerSession.expiredOfferCount} />
                                    </div>
                                )}
                            </div>

                            {/* Session buttons — only Pause / Resume */}
                            <div className="flex gap-2 shrink-0">
                                {isActive ? (
                                    <button onClick={handlePauseSession} disabled={actionLoading}
                                        className="px-3 py-2 rounded-xl text-sm border transition-all disabled:opacity-50"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                                        Pause
                                    </button>
                                ) : isPaused ? (
                                    <button onClick={handleResumeSession} disabled={actionLoading}
                                        className="px-4 py-2 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                                        style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
                                        {actionLoading ? 'Resuming…' : 'Resume'}
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {/* Status label */}
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{statusLabel}</p>

                        {/* Animated waiting dots — only while active and scanning */}
                        {isActive && !offer && activeTasks.length < CONCURRENCY_LIMIT && (
                            <div className="flex items-center gap-2 py-1">
                                {[0, 150, 300].map((delay) => (
                                    <div key={delay} className="w-2 h-2 rounded-full animate-bounce bg-indigo-400"
                                        style={{ animationDelay: `${delay}ms` }} />
                                ))}
                                <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                                    Scanning for the next best task for you…
                                </span>
                            </div>
                        )}
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
                    <ActiveTasksPanel tasks={activeTasks} />

                    {/* Session history — completed and missed tasks */}
                    <SessionHistoryPanel />
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
    );
}
