import React from 'react';
import Link from 'next/link';

const Footer = () => {
    return (
        <footer className="border-t mt-auto" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="max-w-6xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span
                        className="font-mono text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
                    >
                        AI
                    </span>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        &copy; {new Date().getFullYear()} werkl.ai
                    </p>
                </div>
                <div className="flex gap-5 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Link href="/" className="transition-colors hover:text-slate-300" style={{ color: 'inherit' }}>Home</Link>
                    <Link href="/" className="transition-colors hover:text-slate-300" style={{ color: 'inherit' }}>Tasks</Link>
                    <Link href="/dashboard" className="transition-colors hover:text-slate-300" style={{ color: 'inherit' }}>Dashboard</Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
