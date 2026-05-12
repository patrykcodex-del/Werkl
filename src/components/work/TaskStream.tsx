'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Badge } from '../ui/badge';
import { Card, CardHeader, CardFooter } from '../ui/card';
import { PingDot } from '../icons/PingDot';
import { StreamItem, type StreamTask, type StreamItemState } from './StreamItem';
import { Ticker } from './Ticker';
import { STREAM_MAX, STREAM_POLL_MS, GONE_LINGER_MS } from '../../lib/constants';
import type { Task } from '../../types';

interface TaskStreamProps {
    active: boolean;
    offeredTask?: Task;
    offerExpiresAt?: string;
    dismissTaskId?: string;
}

export function TaskStream({ active, offeredTask, offerExpiresAt, dismissTaskId }: TaskStreamProps) {
    const offeredTaskId    = offeredTask?.id;
    const offeredTaskIdRef = useRef<string | undefined>(undefined);
    offeredTaskIdRef.current = offeredTaskId;

    const [items, setItems]   = useState<StreamTask[]>([]);
    const knownIds            = useRef<Set<string>>(new Set());

    // Inject offered task into stream
    useEffect(() => {
        if (!offeredTask) return;
        setItems((prev) => {
            if (prev.some((it) => it.id === offeredTask.id)) return prev;
            knownIds.current.add(offeredTask.id);
            const injected: StreamTask = { ...offeredTask, _streamState: 'entering' };
            const next = [injected, ...prev].slice(0, STREAM_MAX);
            setTimeout(() => {
                setItems((p) =>
                    p.map((it) =>
                        it.id === offeredTask.id && it._streamState === 'entering'
                            ? { ...it, _streamState: 'visible' }
                            : it,
                    ),
                );
            }, 450);
            return next;
        });
    }, [offeredTask?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll for new / gone tasks
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
                            prev.map((it) =>
                                it._streamState === 'entering' ? { ...it, _streamState: 'visible' } : it,
                            ),
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
                    }),
                );
            } catch { /* ignore */ }
        }

        poll();
        const id = setInterval(poll, STREAM_POLL_MS);
        return () => clearInterval(id);
    }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

    // Dismiss offered/accepted task from stream
    useEffect(() => {
        if (!dismissTaskId) return;
        setItems((prev) =>
            prev.map((it) =>
                it.id === dismissTaskId && it._streamState !== 'gone'
                    ? { ...it, _streamState: 'gone' as StreamItemState }
                    : it,
            ),
        );
    }, [dismissTaskId]);

    // Prune gone items after linger delay
    useEffect(() => {
        if (!items.some((it) => it._streamState === 'gone')) return;
        const id = setTimeout(() => {
            setItems((prev) => prev.filter((it) => it._streamState !== 'gone'));
        }, GONE_LINGER_MS);
        return () => clearTimeout(id);
    }, [items]);

    const sortedItems  = [...items].sort((a, b) => {
        if (a.id === offeredTaskId) return -1;
        if (b.id === offeredTaskId) return 1;
        return 0;
    });
    const visibleCount = items.filter((it) => it._streamState !== 'gone' && it.id !== offeredTaskId).length;
    const tickerItems  = sortedItems.filter((it) => it.id !== offeredTaskId);
    const offeredItem  = sortedItems.find((it) => it.id === offeredTaskId);

    return (
        <Card className="flex flex-col w-full">
            <CardHeader>
                <PingDot colorClass="bg-success" />
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                    Live task stream
                </p>
                <Badge variant="mono" className="ml-auto">{visibleCount} open</Badge>
            </CardHeader>

            {active && offeredItem && (
                <div className="px-3 pt-3 pb-1 shrink-0">
                    <StreamItem task={offeredItem} isOffered={true} offerExpiresAt={offerExpiresAt} />
                </div>
            )}

            {active && offeredItem && tickerItems.length > 0 && (
                <div className="mx-3 my-1 border-t border-border-dim" />
            )}

            <div className="relative" style={{ height: '16rem' }}>
                <Ticker sourceTasks={tickerItems} />
            </div>

            <CardFooter>
                <p className="text-xs text-muted">
                    Tasks are routed to you — you cannot claim directly.
                </p>
            </CardFooter>
        </Card>
    );
}
