'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import { useWorkSession } from '../hooks/useWorkSession';
import { HeroSection }          from '../components/work/HeroSection';
import { StatusBadge }          from '../components/work/StatusBadge';
import { SessionCard }          from '../components/work/SessionCard';
import { OfferCard }            from '../components/work/OfferCard';
import { ActiveTasksPanel }     from '../components/work/ActiveTasksPanel';
import { SessionHistoryPanel }  from '../components/work/SessionHistoryPanel';
import { HowItWorksPanel }      from '../components/work/HowItWorksPanel';
import { TaskStream }           from '../components/work/TaskStream';

export default function HomePage() {
    const { data: session, status } = useSession();

    const {
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
    } = useWorkSession(session?.user?.email, status !== 'loading');

    const isSignedIn = !!session?.user;
    const isActive   = workerSession?.status === 'active';
    const isPaused   = workerSession?.status === 'paused';

    if (isSignedIn && initialLoading) {
        return (
            <div className="flex items-center justify-center py-32">
                <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
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
                {/* Hero — signed-out only */}
                {!session && <HeroSection />}

                {/* Work section */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-primary">Work Session</h1>
                            <p className="text-sm mt-0.5 text-secondary">
                                Tasks are routed fairly to you — no racing, no bots.
                            </p>
                        </div>
                        {workerSession && <StatusBadge status={workerSession.status} />}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                        {/* LEFT — controls */}
                        <div className="space-y-5">
                            <SessionCard
                                workerSession={workerSession}
                                offer={offer}
                                activeTasks={activeTasks}
                                statusLabel={statusLabel}
                                actionLoading={actionLoading}
                                isSignedIn={isSignedIn}
                                isActive={isActive}
                                isPaused={isPaused}
                                onStart={handleStartSession}
                                onPause={handlePauseSession}
                                onResume={handleResumeSession}
                            />

                            {isActive && offer && (
                                <OfferCard
                                    offer={offer}
                                    onAccept={handleAcceptOffer}
                                    onSkip={handleSkipOffer}
                                    onExpire={handleExpireOffer}
                                    loading={actionLoading}
                                />
                            )}

                            <ActiveTasksPanel
                                tasks={activeTasks}
                                onTaskUpdate={(updated) =>
                                    setActiveTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
                                }
                            />

                            {isSignedIn && <SessionHistoryPanel />}

                            <HowItWorksPanel />
                        </div>

                        {/* RIGHT — live stream */}
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

