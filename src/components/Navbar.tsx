'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/earnings', label: 'Earnings' },
];

const Navbar: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [visible, setVisible] = useState(true);
    const lastScrollY = useRef(0);
    const { data: session, status } = useSession();

    useEffect(() => {
        const handleScroll = () => {
            const current = window.scrollY;
            // Always show when near the top
            if (current < 10) {
                setVisible(true);
            } else if (current < lastScrollY.current) {
                // Scrolling up → show
                setVisible(true);
            } else if (current > lastScrollY.current + 4) {
                // Scrolling down (with a small dead-zone) → hide
                setVisible(false);
                setOpen(false);
            }
            lastScrollY.current = current;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav
            className="fixed top-0 inset-x-0 z-50 border-b transition-transform duration-300"
            style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                transform: visible ? 'translateY(0)' : 'translateY(-100%)',
            }}
        >
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2 group">
                    <span
                        className="font-mono text-sm px-2 py-1 rounded"
                        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
                    >
                        AI
                    </span>
                    <span className="font-semibold text-lg tracking-wide" style={{ color: 'var(--text-primary)' }}>
                        Werkl.ai
                    </span>
                </Link>

                {/* Desktop links */}
                {session && (
                <ul className="hidden md:flex items-center gap-1">
                    {navLinks.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className="px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-white/5"
                                style={{ color: 'var(--text-secondary)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                            >
                                {label}
                            </Link>
                        </li>
                    ))}
                </ul>
                )}

                {/* Desktop auth */}
                <div className="hidden md:flex items-center gap-3">
                    <ThemeToggle />
                    {status === 'loading' ? (
                        <div className="w-6 h-6 rounded-full animate-pulse" style={{ backgroundColor: 'var(--border)' }} />
                    ) : session ? (
                        <div className="flex items-center gap-3">
                            {session.user?.image && (
                                <Image
                                    src={session.user.image}
                                    alt={session.user.name ?? 'User'}
                                    width={28}
                                    height={28}
                                    className="rounded-full ring-1"
                                    style={{ ['--tw-ring-color' as string]: 'var(--border)' }}
                                />
                            )}
                            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                {session.user?.name}
                            </span>
                            <button
                                onClick={() => signOut()}
                                className="text-sm px-3 py-1.5 rounded-md transition-colors hover:bg-red-500/10"
                                style={{ color: 'var(--red)' }}
                            >
                                Sign out
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => signIn('google', {}, { prompt: 'select_account' })}
                            className="px-4 py-1.5 text-sm font-medium rounded-md border transition-colors hover:bg-white/5"
                            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                        >
                            Sign in
                        </button>
                    )}
                </div>

                {/* Mobile controls */}
                <div className="flex md:hidden items-center gap-2">
                    <ThemeToggle />
                    <button
                        className="p-2 rounded-md transition-colors hover:bg-white/5"
                        style={{ color: 'var(--text-secondary)' }}
                        onClick={() => setOpen(!open)}
                        aria-label="Toggle menu"
                    >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {open ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        )}
                    </svg>
                    </button>
                </div>
            </div>

            {/* Mobile menu */}
            {open && (
                <div className="md:hidden border-t" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
                    <ul className="flex flex-col px-4 py-3 gap-1">
                        {session && navLinks.map(({ href, label }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    className="block py-2 text-sm transition-colors"
                                    style={{ color: 'var(--text-secondary)' }}
                                    onClick={() => setOpen(false)}
                                >
                                    {label}
                                </Link>
                            </li>
                        ))}
                        <li className="pt-3 border-t mt-1" style={{ borderColor: 'var(--border)' }}>
                            {session ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{session.user?.name}</span>
                                    <button onClick={() => signOut()} className="text-sm" style={{ color: 'var(--red)' }}>Sign out</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => signIn('google', {}, { prompt: 'select_account' })}
                                    className="w-full px-4 py-2 text-sm font-medium rounded-md border transition-colors hover:bg-white/5"
                                    style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                                >
                                    Sign in with Google
                                </button>
                            )}
                        </li>
                    </ul>
                </div>
            )}
        </nav>
    );
};

export default Navbar;
