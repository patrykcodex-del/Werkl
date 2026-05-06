import React from 'react';
import Link from 'next/link';

const Footer = () => {
    return (
        <footer
            className="border-t mt-auto"
            style={{ backgroundColor: 'var(--terminal-surface)', borderColor: 'var(--terminal-border)' }}
        >
            <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-3">
                <p className="text-xs tracking-wider" style={{ color: 'var(--terminal-green-dim)' }}>
                    <span style={{ color: 'var(--terminal-green)' }}>werkl.ai</span>
                    {' // '}&copy; {new Date().getFullYear()} — human fallback layer
                </p>
                <div className="flex gap-6 text-xs tracking-wider" style={{ color: 'var(--terminal-green-dim)' }}>
                    <Link href="/" className="hover:text-green-400 transition-colors" style={{ color: 'inherit' }}>./home</Link>
                    <Link href="/tasks" className="hover:text-green-400 transition-colors" style={{ color: 'inherit' }}>./tasks</Link>
                    <Link href="/dashboard" className="hover:text-green-400 transition-colors" style={{ color: 'inherit' }}>./dashboard</Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
