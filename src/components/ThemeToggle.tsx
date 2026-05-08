'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

const themes = [
    {
        value: 'light',
        label: 'Light',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
        ),
    },
    {
        value: 'dark',
        label: 'Dark',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
            </svg>
        ),
    },
    {
        value: 'system',
        label: 'System',
        icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
        ),
    },
];

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return <div className="w-8 h-8 rounded-md animate-pulse" style={{ backgroundColor: 'var(--border)' }} />;
    }

    const current = themes.find((t) => t.value === theme) ?? themes[2];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle theme"
                className="flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}
                title={`Theme: ${current.label}`}
            >
                {current.icon}
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className="absolute right-0 mt-2 w-36 rounded-lg border shadow-lg z-50 py-1 overflow-hidden"
                        style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)' }}
                    >
                        {themes.map((t) => (
                            <button
                                key={t.value}
                                onClick={() => { setTheme(t.value); setOpen(false); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors"
                                style={{
                                    color: theme === t.value ? 'var(--accent)' : 'var(--text-secondary)',
                                    backgroundColor: theme === t.value ? 'var(--accent-glow)' : 'transparent',
                                }}
                            >
                                {t.icon}
                                {t.label}
                                {theme === t.value && (
                                    <svg className="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
