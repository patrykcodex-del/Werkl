import { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkerSession, TaskOffer, Task } from '../types';
import { POLL_INTERVAL_MS, HEARTBEAT_INTERVAL_MS, CONCURRENCY_LIMIT } from '../lib/constants';

export interface UseWorkSessionReturn {
    workerSession: WorkerSession | null;
    offer: TaskOffer | null;
    activeTasks: Task[];
    statusLabel: string;
    actionLoading: boolean;
    initialLoading: boolean;
    dismissTaskId: string | undefined;
    setActiveTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    handleStartSession: () => Promise<void>;
    handlePauseSession: () => Promise<void>;
    handleResumeSession: () => Promise<void>;
    handleAcceptOffer: () => Promise<void>;
    handleSkipOffer: () => Promise<void>;
    handleExpireOffer: () => Promise<void>;
}

export function useWorkSession(
    userId: string | null | undefined,
    sessionReady: boolean,
): UseWorkSessionReturn {
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
                        }).catch(() => {});
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
        pollTimerRef.current = setInterval(() => {
            fetchCurrentOffer();
            fetchActiveTasks();
        }, POLL_INTERVAL_MS);
        heartbeatTimerRef.current = setInterval(() => sendHeartbeat(ws.id), HEARTBEAT_INTERVAL_MS);
    }, [fetchCurrentOffer, fetchActiveTasks, sendHeartbeat, stopTimers]);

    // Initial load
    useEffect(() => {
        if (!sessionReady) return;
        if (!userId) { setInitialLoading(false); return; }
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
    }, [userId, sessionReady, fetchCurrentOffer, fetchActiveTasks, startTimers]);

    useEffect(() => () => stopTimers(), [stopTimers]);

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
        if (data) {
            setWorkerSession(data.session);
            setOffer(null);
            setStatusLabel('Session paused');
            stopTimers();
        }
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

    return {
        workerSession,
        offer,
        activeTasks,
        statusLabel,
        actionLoading,
        initialLoading,
        dismissTaskId,
        setActiveTasks,
        handleStartSession,
        handlePauseSession,
        handleResumeSession,
        handleAcceptOffer,
        handleSkipOffer,
        handleExpireOffer,
    };
}
