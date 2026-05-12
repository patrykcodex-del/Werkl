import { useState, useEffect, useRef } from 'react';
import type { Task } from '../types';
import { POLL_MS, FEED_LIMIT } from '../lib/constants';

export interface UseFeedReturn {
    tasks: Task[];
    newIds: Set<string>;
    pendingCount: number;
    feedLoading: boolean;
    flushPending: () => void;
}

export function useFeed(enabled: boolean): UseFeedReturn {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newIds, setNewIds] = useState<Set<string>>(new Set());
    const [pendingCount, setPendingCount] = useState(0);
    const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
    const [feedLoading, setFeedLoading] = useState(true);
    const knownIds = useRef<Set<string>>(new Set());

    async function fetchFeed(isInitial = false) {
        try {
            const res = await fetch(`/api/tasks?status=open&sort=createdAt&order=desc&limit=${FEED_LIMIT}`);
            if (!res.ok) return;
            const data: { tasks: Task[] } = await res.json();
            const incoming = data.tasks;

            if (isInitial) {
                setTasks(incoming);
                knownIds.current = new Set(incoming.map((t) => t.id));
                setFeedLoading(false);
                return;
            }

            const fresh = incoming.filter((t) => !knownIds.current.has(t.id));
            if (fresh.length === 0) return;
            setPendingTasks((prev) => [...fresh, ...prev]);
            setPendingCount((n) => n + fresh.length);
            fresh.forEach((t) => knownIds.current.add(t.id));
        } catch { /* network error — retry on next tick */ }
    }

    function flushPending() {
        if (pendingTasks.length === 0) return;
        const freshIds = new Set(pendingTasks.map((t) => t.id));
        setNewIds(freshIds);
        setTasks((prev) => [...pendingTasks, ...prev].slice(0, FEED_LIMIT));
        setPendingTasks([]);
        setPendingCount(0);
        setTimeout(() => setNewIds(new Set()), 3_000);
    }

    useEffect(() => {
        if (!enabled) return;
        fetchFeed(true);
        const interval = setInterval(() => fetchFeed(false), POLL_MS);
        return () => clearInterval(interval);
    }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    return { tasks, newIds, pendingCount, feedLoading, flushPending };
}
