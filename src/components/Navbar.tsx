'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';

const navLinks = [
    { href: '/', label: 'home' },
    { href: '/dashboard', label: 'dashboard' },
    { href: '/tasks', label: 'tasks' },
    { href: '/earnings', label: 'earnings' },
];

const Navbar: React.FC = () => {
    const [open, setOpen] = useState(false);
    const { data: session, status } = useSession();

    return (
        <nav
            className="sticky top-0 z-50 border-b"
            style={{ backgroundColor: 'var(--terminal-surface)', borderColor: 'var(--terminal-border)' }}
        >
            <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-12">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: 'var(--terminal-green-dim)' }}>$</span>
                    <span className="text-sm font-bold tracking-widest cursor-blink" style={{ color: 'var(--terminal-green)' }}>
                        werkl.ai
                    </span>
                </Link>

                {/* Desktop links */}
                <ul className="hidden md:flex items-center gap-1">
                    {navLinks.map(({ href, label }) => (
                        <li key={href}>
                            <Link
                                href={href}
                                className="px-3 py-1 text-xs tracking-wider border border-transparent transition-colors hover:border-green-900 hover:bg-green-950/30"
                                style={{ color: 'var(--terminal-green-dim)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--terminal-green)')}
                                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--terminal-green-dim)')}
                            >
                                ./{label}
                            </Link>
                        </li>
                    ))}
                </ul>

                {/* Desktop auth */}
                <div className="hidden md:flex items-center gap-3">
                    {status === 'loading' ? (
                        <span className="text-xs animate-pulse" style={{ color: 'var(--terminal-green-dim)' }}>[authenticating...]</span>
                    ) : session ? (
                        <div className="flex items-center gap-3">
                            {session.user?.image && (
                                <Image
                                    src={session.user.image}
                                    alt={session.user.name ?? 'User'}
                                    width={24}
                                    height={24}
                                    className="rounded-sm"
                                    style={{ border: '1px solid var(--terminal-border)' }}
                                />
                            )}
                            <span className="text-xs" style={{ color: 'var(--terminal-green-dim)' }}>
                                [{session.user?.name}]
                            </span>
                            <button
                                onClick={() => signOut()}
                                className="text-xs tracking-wider hover:opacity-70 transition-opacity"
                                style={{ color: 'var(--terminal-red)' }}
                            >
                                logout
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => signIn('google')}
                            className="px-3 py-1 text-xs tracking-wider border transition-colors hover:bg-green-950/30"
                            style={{ color: 'var(--terminal-green)', borderColor: 'var(--terminal-green-dim)' }}
                        >
                            &gt; sign_in()
                        </button>
                    )}
                </div>

                {/* Mobile hamburger */}
                <button
                    className="md:hidden text-xs tracking-wider"
                    style={{ color: 'var(--terminal-green-dim)' }}
                    onClick={() => setOpen(!open)}
                    aria-label="Toggle menu"
                >
                    {open ? '[x]' : '[=]'}
                </button>
            </div>

            {/* Mobile menu */}
            {open && (
                <div className="md:hidden border-t" style={{ backgroundColor: 'var(--terminal-surface)', borderColor: 'var(--terminal-border)' }}>
                    <ul className="flex flex-col px-4 py-2 gap-1">
                        {navLinks.map(({ href, label }) => (
                            <li key={href}>
                                <Link
                                    href={href}
                                    className="block py-2 text-xs tracking-wider border-b"
                                    style={{ color: 'var(--terminal-green)', borderColor: 'var(--terminal-border)' }}
                                    onClick={() => setOpen(false)}
                                >
                                    $ ./{label}
                                </Link>
                            </li>
                        ))}
                        <li className="py-2">
                            {session ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: 'var(--terminal-green-dim)' }}>[{session.user?.name}]</span>
                                    <button onClick={() => signOut()} className="text-xs" style={{ color: 'var(--terminal-red)' }}>
                                        logout
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => signIn('google')}
                                    className="w-full px-3 py-1.5 text-xs tracking-wider border"
                                    style={{ color: 'var(--terminal-green)', borderColor: 'var(--terminal-green-dim)' }}
                                >
                                    &gt; sign_in()
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
