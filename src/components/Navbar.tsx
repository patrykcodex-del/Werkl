'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

const Navbar: React.FC = () => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [visible, setVisible] = useState(true);
    const lastScrollY = useRef(0);
    const dropdownRef = useRef<HTMLDivElement>(null);
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
                setDropdownOpen(false);
            }
            lastScrollY.current = current;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setDropdownOpen(false);
            }
        }
        if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

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

                {/* Right controls */}
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    {session ? (
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setDropdownOpen((v) => !v)}
                                className="flex items-center justify-center rounded-full ring-2 transition-all focus:outline-none"
                                style={{
                                    ['--tw-ring-color' as string]: dropdownOpen ? 'var(--accent)' : 'var(--border)',
                                }}
                                aria-label="User menu"
                            >
                                {session.user?.image ? (
                                    <Image
                                        src={session.user.image}
                                        alt={session.user.name ?? 'User'}
                                        width={32}
                                        height={32}
                                        className="rounded-full"
                                    />
                                ) : (
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                                        style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
                                    >
                                        {session.user?.name?.[0] ?? '?'}
                                    </div>
                                )}
                            </button>

                            {dropdownOpen && (
                                <div
                                    className="absolute right-0 mt-2 w-56 rounded-xl border shadow-xl py-1 z-50"
                                    style={{
                                        backgroundColor: 'var(--bg-surface)',
                                        borderColor: 'var(--border)',
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                                    }}
                                >
                                    {/* User info */}
                                    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                            {session.user?.name}
                                        </p>
                                        {session.user?.email && (
                                            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                {session.user.email}
                                            </p>
                                        )}
                                    </div>

                                    {/* Menu items */}
                                    <div className="py-1">
                                        <Link
                                            href="/earnings"
                                            onClick={() => setDropdownOpen(false)}
                                            className="flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-white/5"
                                            style={{ color: 'var(--text-secondary)' }}
                                        >
                                            <span>💰</span>
                                            Earnings
                                        </Link>
                                    </div>

                                    <div className="border-t py-1" style={{ borderColor: 'var(--border)' }}>
                                        <button
                                            onClick={() => { setDropdownOpen(false); signOut(); }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors hover:bg-red-500/10 text-left"
                                            style={{ color: 'var(--red)' }}
                                        >
                                            <span>↩</span>
                                            Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <Link
                            href="/auth/signin"
                            className="px-4 py-1.5 text-sm font-medium rounded-md border transition-colors hover:bg-white/5"
                            style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                        >
                            Sign in
                        </Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
