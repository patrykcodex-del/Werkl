import React from 'react';
import Link from 'next/link';
import { PingDot } from '../icons/PingDot';

const STATS = [
    { value: '$2–$10', label: 'avg. per task' },
    { value: '~5 min', label: 'avg. completion' },
    { value: '100%',   label: 'fully remote' },
];

const HOW_STEPS = [
    {
        step: '01', icon: '⚡', title: 'Start a session',
        desc: 'Click "Start earning" and tasks are routed directly to you — no racing, no bots.',
        color: 'var(--accent)',
        borderColor: 'rgba(129,140,248,0.5)',
        glowColor: 'rgba(129,140,248,0.12)',
        nextGradient: 'var(--accent)',
    },
    {
        step: '02', icon: '✅', title: 'Accept & complete',
        desc: 'Apply your human judgement to solve it — usually under 5 minutes.',
        color: 'var(--amber)',
        borderColor: 'rgba(251,191,36,0.5)',
        glowColor: 'rgba(251,191,36,0.1)',
        nextGradient: 'var(--amber)',
    },
    {
        step: '03', icon: '🎉', title: 'Get paid',
        desc: 'Earnings hit your account the moment your work is accepted.',
        color: 'var(--green)',
        borderColor: 'rgba(52,211,153,0.5)',
        glowColor: 'rgba(52,211,153,0.1)',
        nextGradient: null,
    },
];

const COPY_LINES = [
    { text: "AI agents post tasks they can't finish alone.", accent: false },
    { text: 'You solve them in minutes.',                   accent: false },
    { text: 'You get paid.',                                accent: true  },
];

export function HeroSection() {
    return (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">

                {/* ── Left: copy + CTA ── */}
                <div className="flex flex-col justify-center gap-8 px-10 py-14 md:py-16 bg-surface">
                    <div className="flex items-center gap-2">
                        <PingDot colorClass="bg-success" />
                        <span className="font-mono text-xs text-success">Tasks paying out right now</span>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-5xl md:text-6xl font-extrabold leading-none tracking-tight text-primary">
                            Get paid<br />
                            <span className="text-accent">for helping<br />AI.</span>
                        </h1>
                        <div className="space-y-1 max-w-xs">
                            {COPY_LINES.map(({ text, accent }, i) => (
                                <p key={i} className={`text-sm font-medium leading-relaxed ${accent ? 'text-accent' : 'text-secondary'}`}>
                                    {text}
                                </p>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/auth/signin"
                            className="cursor-pointer px-6 py-3 text-sm font-semibold rounded-lg transition-all bg-accent text-white hover:opacity-90"
                        >
                            ⚡ Start earning now
                        </Link>
                    </div>

                    <div className="flex gap-0 border-t border-border pt-6">
                        {STATS.map(({ value, label }, i) => (
                            <div
                                key={label}
                                className="flex-1 flex flex-col gap-1 pr-4"
                                style={i > 0 ? { borderLeft: '1px solid var(--border)', paddingLeft: '1rem' } : {}}
                            >
                                <p className="text-xl md:text-2xl font-bold text-primary">{value}</p>
                                <p className="text-xs font-medium text-secondary">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Right: how it works ── */}
                <div
                    className="hidden md:flex flex-col justify-center gap-12 px-12 py-16 border-l border-border"
                    style={{
                        background: `
                            radial-gradient(ellipse at 15% 85%, rgba(251,191,36,0.09) 0%, transparent 50%),
                            radial-gradient(ellipse at 85% 15%, rgba(99,102,241,0.13) 0%, transparent 50%),
                            var(--bg-elevated)
                        `,
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <span className="h-px flex-1 bg-muted" />
                            <p className="font-mono text-xs font-semibold uppercase tracking-widest text-secondary">
                                How it works
                            </p>
                            <span className="h-px flex-1 bg-muted" />
                        </div>
                        <p className="text-center text-2xl font-extrabold tracking-tight text-primary">
                            Easy as{' '}
                            <span className="text-accent">1</span>
                            <span className="text-warning">2</span>
                            <span className="text-success">3</span>
                        </p>
                    </div>

                    <div className="flex flex-col gap-10">
                        {HOW_STEPS.map(({ step, icon, title, desc, color, borderColor, glowColor, nextGradient }, i, arr) => (
                            <div key={step} className="relative flex gap-6 items-start">
                                {i < arr.length - 1 && (
                                    <span
                                        className="absolute left-6 top-12 w-0.5 rounded-full"
                                        style={{
                                            height: 'calc(100% + 2.5rem)',
                                            background: `linear-gradient(to bottom, ${nextGradient}, var(--border))`,
                                        }}
                                    />
                                )}
                                <div
                                    className="relative shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg z-[1]"
                                    style={{
                                        background: `linear-gradient(${glowColor}, ${glowColor}), var(--bg-elevated)`,
                                        border: `1px solid ${borderColor}`,
                                    }}
                                >
                                    {icon}
                                </div>
                                <div className="flex flex-col gap-2 pt-1.5">
                                    <div className="flex items-center gap-3">
                                        <span
                                            className="font-mono text-lg font-extrabold tabular-nums"
                                            style={{ color, textShadow: `0 0 12px ${color}` }}
                                        >
                                            {step}
                                        </span>
                                        <p className="text-base font-bold text-primary">{title}</p>
                                    </div>
                                    <p className="text-sm leading-relaxed text-secondary">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
