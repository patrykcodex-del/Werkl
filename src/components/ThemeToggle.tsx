'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
);

const SystemIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
);

const themes = [
    { value: 'light',  label: 'Light',  Icon: SunIcon },
    { value: 'dark',   label: 'Dark',   Icon: MoonIcon },
    { value: 'system', label: 'System', Icon: SystemIcon },
] as const;

function TriggerIcon({ theme }: { theme: string | undefined }) {
    if (theme === 'light') return <SunIcon />;
    if (theme === 'dark')  return <MoonIcon />;
    return <SystemIcon />;
}

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const resolvedTheme = mounted ? theme : undefined;

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Theme: ${resolvedTheme ?? 'system'}. Click to change.`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'none',
                        border: '1px solid transparent',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        flexShrink: 0,
                        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
                    }}
                    onMouseEnter={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.color = 'var(--text-primary)';
                        el.style.borderColor = 'var(--border)';
                        el.style.background = 'var(--bg-elevated)';
                    }}
                    onMouseLeave={e => {
                        const el = e.currentTarget as HTMLElement;
                        el.style.color = 'var(--text-secondary)';
                        el.style.borderColor = 'transparent';
                        el.style.background = 'none';
                    }}
                >
                    <TriggerIcon theme={resolvedTheme} />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" style={{ minWidth: '8rem', padding: '3px' }}>
                {themes.map(({ value, label, Icon }) => {
                    const active = resolvedTheme === value;
                    return (
                        <DropdownMenuItem
                            key={value}
                            onSelect={() => setTheme(value)}
                            style={{
                                borderRadius: '5px',
                                padding: '6px 10px',
                                gap: '8px',
                                fontSize: '13px',
                                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                                background: active ? 'var(--accent-glow)' : 'transparent',
                            }}
                        >
                            <Icon />
                            {label}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

