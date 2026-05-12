'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import type { Task, TaskPriority } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** How often the feed polls for new tasks (ms) */
const POLL_MS = 5_000;
/** Max rows shown in the feed */
const FEED_LIMIT = 20;

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

// ─── Feed row ─────────────────────────────────────────────────────────────────

function FeedRow({ task, isNew }: { task: Task; isNew: boolean }) {
    const dot = PRIORITY_DOT[task.priority];
    const [hovered, setHovered] = useState(false);

    return (
        <Link
            href="/work"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 cursor-pointer ${isNew ? 'feed-row-enter' : ''}`}
            style={{
                borderColor: hovered ? 'var(--accent)' : isNew ? 'var(--accent)' : 'var(--border)',
                backgroundColor: hovered
                    ? 'var(--bg-elevated)'
                    : isNew
                    ? 'var(--accent-glow)'
                    : 'var(--bg-surface)',
                transform: hovered ? 'translateX(3px)' : 'translateX(0)',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Priority dot */}
            <span
                className="shrink-0 w-2 h-2 rounded-full transition-transform duration-200"
                style={{
                    backgroundColor: dot.color,
                    transform: hovered ? 'scale(1.4)' : 'scale(1)',
                }}
                title={task.priority}
            />

            {/* Title */}
            <p
                className="flex-1 text-sm font-medium truncate transition-colors duration-200"
                style={{ color: hovered ? 'var(--accent)' : 'var(--text-primary)' }}
            >
                {task.title}
            </p>

            {/* Reward */}
            {task.reward ? (
                <span
                    className="shrink-0 font-mono text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ color: 'var(--green)', backgroundColor: 'rgba(34,197,94,0.1)' }}
                >
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: task.reward.currency }).format(task.reward.amount)}
                </span>
            ) : null}

            {/* Time ago */}
            <span className="shrink-0 font-mono text-xs tabular-nums" style={{ color: 'var(--text-muted)', minWidth: '3.5rem', textAlign: 'right' }}>
                {timeAgo(task.createdAt)}
            </span>

            {/* Arrow hint */}
            <span
                className="shrink-0 text-xs transition-all duration-200"
                style={{
                    color: 'var(--accent)',
                    opacity: hovered ? 1 : 0,
                    transform: hovered ? 'translateX(0)' : 'translateX(-4px)',
                }}
            >
                →
            </span>
        </Link>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
    const { data: session, status } = useSession();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const knownIds = useRef<Set<string>>(new Set());
    const initialized = useRef(false);

    // ── Fetch latest tasks ────────────────────────────────────────────────────

    async function fetchFeed(isInitial = false) {
        try {
            const res = await fetch(
                `/api/tasks?status=open&sort=createdAt&order=desc&limit=${FEED_LIMIT}`
            );
            if (!res.ok) return;
            const data: { tasks: Task[] } = await res.json();
            const incoming = data.tasks;

            if (isInitial) {
                // On first load, just set all tasks with no animations
                setTasks(incoming);
                knownIds.current = new Set(incoming.map((t) => t.id));
                setLoading(false);
                initialized.current = true;
                return;
            }

            // Subsequent polls — find truly new tasks
            const fresh = incoming.filter((t) => !knownIds.current.has(t.id));
            if (fresh.length === 0) return;

            // Queue them as pending (show a "X new" badge instead of auto-scrolling)
            setPendingTasks((prev) => [...fresh, ...prev]);
            setPendingCount((n) => n + fresh.length);
            fresh.forEach((t) => knownIds.current.add(t.id));
        } catch {
            // network error — retry on next tick
        }
    }

    // Flush pending tasks into the visible feed
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
        // Clear "new" highlight after 3 s
        setTimeout(() => setNewIds(new Set()), 3000);
    }

    useEffect(() => {
        fetchFeed(true);
        const interval = setInterval(() => fetchFeed(false), POLL_MS);
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const showHero = status !== 'loading' && !session;

    return (
        <>
            {/* Keyframe for feed row slide-in */}
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
                                {/* Live indicator */}
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--green)' }} />
                                        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--green)' }} />
                                    </span>
                                    <span className="font-mono text-xs" style={{ color: 'var(--green)' }}>
                                        Tasks paying out right now
                                    </span>
                                </div>

                                {/* Headline */}
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
                                            <p
                                                key={i}
                                                className="text-sm font-medium leading-relaxed"
                                                style={{ color: i === 2 ? 'var(--accent)' : 'var(--text-secondary)' }}
                                            >
                                                {line}
                                            </p>
                                        ))}
                                    </div>
                                </div>

                                {/* CTAs */}
                                <div className="flex flex-wrap gap-3">
                                    <Link
                                        href="/auth/signin"
                                        className="cursor-pointer px-5 py-2.5 text-sm font-medium rounded-md border transition-colors"
                                        style={{ color: 'var(--accent)', borderColor: 'var(--accent)', backgroundColor: 'var(--accent-glow)' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-dim)', e.currentTarget.style.color = '#fff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-glow)', e.currentTarget.style.color = 'var(--accent)')}
                                    >
                                        Start earning now →
                                    </Link>
                                    <a
                                        href="#feed"
                                        className="cursor-pointer px-5 py-2.5 text-sm font-semibold rounded-lg border transition-colors"
                                        style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-base)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                        See live tasks
                                    </a>
                                </div>

                                {/* Stats row */}
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

                {/* ── Live task feed ── */}
                <div id="feed" className="space-y-4">

                    {/* Feed header */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            {/* Pulsing live dot */}
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: 'var(--green)' }} />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ backgroundColor: 'var(--green)' }} />
                            </span>
                            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                Live task feed
                            </h2>
                            <span className="font-mono text-xs px-2 py-0.5 rounded-full"
                                style={{ color: 'var(--green)', backgroundColor: 'rgba(34,197,94,0.1)' }}>
                                LIVE
                            </span>
                        </div>

                        {/* CTA */}
                        <Link
                            href={session ? '/work' : '/auth/signin'}
                            className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
                            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                        >
                            <span>⚡</span>
                            Start earning
                        </Link>
                    </div>

                    {/* Sub-label */}
                    <p className="text-sm -mt-1" style={{ color: 'var(--text-secondary)' }}>
                        Tasks are routed fairly to workers in active sessions.{' '}
                        <Link href={session ? '/work' : '/auth/signin'} style={{ color: 'var(--accent)' }}>
                            Start a session →
                        </Link>
                    </p>

                    {/* "New tasks" flush button */}
                    {pendingCount > 0 && (
                        <button
                            onClick={flushPending}
                            className="w-full py-2 rounded-xl text-sm font-semibold border transition-all"
                            style={{
                                color: 'var(--accent)',
                                borderColor: 'var(--accent)',
                                backgroundColor: 'var(--accent-glow)',
                            }}
                        >
                            ↑ {pendingCount} new task{pendingCount !== 1 ? 's' : ''} — click to show
                        </button>
                    )}

                    {/* Feed rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div
                                className="w-5 h-5 rounded-full border-2 animate-spin"
                                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                            />
                        </div>
                    ) : tasks.length === 0 ? (
                        <div
                            className="rounded-xl border py-12 text-center space-y-2"
                            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                        >
                            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                No open tasks right now
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                Check back soon — AI agents are working hard.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {tasks.map((task) => (
                                <FeedRow key={task.id} task={task} isNew={newIds.has(task.id)} />
                            ))}
                        </div>
                    )}

                    {/* Legend */}
                    {!loading && tasks.length > 0 && (
                        <div className="flex items-center gap-4 pt-1">
                            {([['urgent', '🔥 Urgent'], ['high', 'High value'], ['medium', 'Standard'], ['low', 'Low']] as [TaskPriority, string][]).map(([p, label]) => (
                                <div key={p} className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_DOT[p].color }} />
                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
