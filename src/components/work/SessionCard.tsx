import React from 'react';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { Card, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { StatCard } from './StatCard';
import { PingDot } from '../icons/PingDot';
import { CONCURRENCY_LIMIT } from '../../lib/constants';
import type { WorkerSession, TaskOffer, Task } from '../../types';

interface SessionCardProps {
    workerSession: WorkerSession | null;
    offer: TaskOffer | null;
    activeTasks: Task[];
    statusLabel: string;
    actionLoading: boolean;
    isSignedIn: boolean;
    isActive: boolean;
    isPaused: boolean;
    onStart: () => void;
    onPause: () => void;
    onResume: () => void;
}

function SessionStatusRow({
    isActive,
    isPaused,
    offer,
    activeTasks,
    statusLabel,
}: Pick<SessionCardProps, 'isActive' | 'isPaused' | 'offer' | 'activeTasks' | 'statusLabel'>) {
    return (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 bg-elevated">
            {isActive && offer ? (
                <>
                    <span className="text-base">📬</span>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-primary">New task offered</p>
                        <p className="text-xs mt-0.5 text-muted">Review and accept before the timer runs out</p>
                    </div>
                </>
            ) : isActive && activeTasks.length >= CONCURRENCY_LIMIT ? (
                <>
                    <span className="text-base">⚠️</span>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-warning">Queue full ({activeTasks.length}/{CONCURRENCY_LIMIT})</p>
                        <p className="text-xs mt-0.5 text-muted">Submit or release a task to receive new offers</p>
                    </div>
                </>
            ) : isActive ? (
                <>
                    <div className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                            <div
                                key={delay}
                                className="w-1.5 h-1.5 rounded-full animate-bounce bg-accent"
                                style={{ animationDelay: `${delay}ms` }}
                            />
                        ))}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-primary">Scanning for tasks…</p>
                        <p className="text-xs mt-0.5 text-muted">You'll be notified as soon as one is routed to you</p>
                    </div>
                </>
            ) : isPaused ? (
                <>
                    <span className="text-base">⏸</span>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-primary">Not receiving tasks</p>
                        <p className="text-xs mt-0.5 text-muted">Hit "Send me tasks" when you're ready to pick up more work</p>
                    </div>
                </>
            ) : (
                <>
                    <span className="text-base">💤</span>
                    <div className="flex-1">
                        <p className="text-sm font-semibold text-primary">
                            {statusLabel.startsWith('Could not') || statusLabel.startsWith('Network error')
                                ? statusLabel
                                : 'No active session'}
                        </p>
                        <p className="text-xs mt-0.5 text-muted">
                            Click "Start a session" below to begin receiving tasks
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}

export function SessionCard({
    workerSession,
    offer,
    activeTasks,
    statusLabel,
    actionLoading,
    isSignedIn,
    isActive,
    isPaused,
    onStart,
    onPause,
    onResume,
}: SessionCardProps) {
    return (
        <Card className={cn(isActive ? 'border-success' : 'border-border')}>
            {/* Header */}
            <div
                className={cn(
                    'flex items-center gap-2.5 px-5 py-3 border-b',
                    isActive
                        ? 'border-success/25 bg-success/[0.06]'
                        : isPaused
                        ? 'border-border bg-warning/[0.04]'
                        : 'border-border bg-elevated',
                )}
            >
                {isActive ? (
                    <PingDot colorClass="bg-accent" size="md" />
                ) : (
                    <span className={cn('w-2.5 h-2.5 rounded-full', isPaused ? 'bg-warning' : 'bg-muted')} />
                )}
                <p className={cn('text-sm font-semibold', isActive ? 'text-accent' : isPaused ? 'text-warning' : 'text-muted')}>
                    {isActive ? 'Receiving tasks' : isPaused ? 'Not receiving tasks' : 'No active session'}
                </p>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4">
                {workerSession && (
                    <div className="grid grid-cols-3 gap-3">
                        <StatCard icon="✓" label="Accepted" value={workerSession.acceptedCount}       variant="success" />
                        <StatCard icon="›" label="Skipped"  value={workerSession.skippedCount}        variant="warning" />
                        <StatCard icon="⏱" label="Expired"  value={workerSession.expiredOfferCount}   variant="danger"  />
                    </div>
                )}
                <SessionStatusRow
                    isActive={isActive}
                    isPaused={isPaused}
                    offer={offer}
                    activeTasks={activeTasks}
                    statusLabel={statusLabel}
                />
            </div>

            {/* CTA */}
            <CardFooter className="px-5 pb-5 border-none">
                {!isSignedIn ? (
                    <Link
                        href="/auth/signin"
                        className="block w-full py-3 rounded-xl font-semibold text-sm text-center bg-accent text-white hover:opacity-90 transition-all"
                    >
                        Sign in to start earning
                    </Link>
                ) : isActive ? (
                    <Button variant="danger-outline" size="full" onClick={onPause} disabled={actionLoading}>
                        Stop sending me tasks
                    </Button>
                ) : isPaused ? (
                    <Button variant="accent" size="full" onClick={onResume} disabled={actionLoading}>
                        {actionLoading ? 'Starting…' : 'Send me tasks'}
                    </Button>
                ) : (
                    <Button variant="accent" size="full" onClick={onStart} disabled={actionLoading}>
                        {actionLoading ? 'Starting…' : 'Start a session'}
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
