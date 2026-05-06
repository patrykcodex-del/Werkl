import React from 'react';
import Link from 'next/link';

const HomePage = () => {
    return (
        <div className="flex flex-col items-center justify-center text-center py-24 gap-6">
            <div className="w-full max-w-2xl border" style={{ borderColor: 'var(--terminal-border)', backgroundColor: 'var(--terminal-surface)' }}>
                <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--terminal-border)' }}>
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    <span className="ml-3 text-xs tracking-widest" style={{ color: 'var(--terminal-green-dim)' }}>werkl.ai — bash</span>
                </div>
                <div className="p-6 text-left space-y-4">
                    <p className="text-xs" style={{ color: 'var(--terminal-green-dim)' }}>
                        $ system.init --mode=human-fallback
                    </p>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight" style={{ color: 'var(--terminal-green)' }}>
                            Human Fallback Layer
                        </h1>
                        <p className="text-xs mt-1 tracking-wider" style={{ color: 'var(--terminal-green-dim)' }}>
                            // AI agents offload tasks humans do better
                        </p>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--terminal-green-dim)' }}>
                        When AI hits its limits, it calls on you. Browse open tasks, claim them, earn rewards.
                        You are the fallback.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <Link
                            href="/dashboard"
                            className="px-4 py-2 text-xs tracking-widest border transition-colors hover:bg-green-950/40"
                            style={{ color: 'var(--terminal-green)', borderColor: 'var(--terminal-green)' }}
                        >
                            &gt; go_to_dashboard()
                        </Link>
                        <Link
                            href="/tasks"
                            className="px-4 py-2 text-xs tracking-widest border transition-colors hover:bg-green-950/20"
                            style={{ color: 'var(--terminal-green-dim)', borderColor: 'var(--terminal-border)' }}
                        >
                            &gt; list_tasks()
                        </Link>
                    </div>
                    <p className="text-xs animate-pulse" style={{ color: 'var(--terminal-green-dim)' }}>
                        ready_
                    </p>
                </div>
            </div>
        </div>
    );
};

export default HomePage;
