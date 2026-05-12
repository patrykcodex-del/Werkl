import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../lib/formatters';
import { PRIORITY_DOT_CLASS } from '../../lib/priority';
import type { Task, TaskPriority } from '../../types';
import type { StreamTask } from './StreamItem';

// ─── Constants ────────────────────────────────────────────────────────────────

const TICKER_ROW_H  = 44;
const TICKER_STEP_MS  = 1800;
const TICKER_SLIDE_MS = 420;

// ─── TickerRow ────────────────────────────────────────────────────────────────

function TickerRow({ task }: { task: Task }) {
    return (
        <div
            className={cn('flex items-center gap-3 px-3 rounded-lg shrink-0 bg-elevated')}
            style={{ height: TICKER_ROW_H }}
        >
            <span
                className={cn('shrink-0 w-1.5 h-1.5 rounded-full', PRIORITY_DOT_CLASS[task.priority as TaskPriority])}
            />
            <p className="flex-1 text-xs font-medium truncate text-secondary">{task.title}</p>
            {task.reward && (
                <span className="shrink-0 font-mono text-xs font-semibold text-success">
                    {formatCurrency(task.reward.amount, task.reward.currency)}
                </span>
            )}
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded text-muted bg-surface" style={{ fontSize: '0.65rem' }}>
                open
            </span>
        </div>
    );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

interface TickerProps {
    sourceTasks: StreamTask[];
}

export function Ticker({ sourceTasks }: TickerProps) {
    const [list, setList]           = useState<Task[]>([]);
    const [translateY, setTranslateY] = useState(0);
    const [sliding, setSliding]     = useState(false);
    const seenIds                   = useRef(new Set<string>());

    useEffect(() => {
        const fresh = sourceTasks.filter(
            (t) => t._streamState !== 'gone' && !seenIds.current.has(t.id),
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
                <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <p className="text-xs text-muted">Watching for tasks…</p>
            </div>
        );
    }

    return (
        <div className="relative overflow-hidden h-full">
            <div className="absolute top-0 left-0 right-0 h-8 z-10 pointer-events-none bg-gradient-to-b from-surface to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-8 z-10 pointer-events-none bg-gradient-to-t from-surface to-transparent" />
            <div
                className="flex flex-col gap-1 px-2"
                style={{
                    transform:  `translateY(${translateY}px)`,
                    transition: sliding ? `transform ${TICKER_SLIDE_MS}ms cubic-bezier(0.4,0,0.2,1)` : 'none',
                }}
            >
                {list.map((task) => (
                    <TickerRow key={task.id} task={task} />
                ))}
            </div>
        </div>
    );
}
