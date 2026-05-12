'use client';

import { useTheme } from 'next-themes';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
);

const MoonIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
    </svg>
);

const SystemIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
    </svg>
);

const CheckIcon = () => (
    <svg className="w-3 h-3 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const themes = [
    { value: 'light',  label: 'Light',  icon: <SunIcon /> },
    { value: 'dark',   label: 'Dark',   icon: <MoonIcon /> },
    { value: 'system', label: 'System', icon: <MoonIcon /> },
] as const;

function CurrentIcon({ theme }: { theme: string | undefined }) {
    if (theme === 'light') return <SunIcon />;
    if (theme === 'dark')  return <MoonIcon />;
    return <MoonIcon />;
}

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Theme: ${theme ?? 'system'}. Click to change.`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '44px',
                        height: '44px',
                        borderRadius: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        padding: 0,
                        flexShrink: 0,
                        WebkitTapHighlightColor: 'transparent' as string,
                        touchAction: 'manipulation' as string,
                    }}
                >
                    <CurrentIcon theme={theme} />
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" style={{ minWidth: '9rem' }}>
                {themes.map((t) => (
                    <DropdownMenuItem
                        key={t.value}
                        onSelect={() => setTheme(t.value)}
                        style={{
                            color: theme === t.value ? 'var(--accent)' : 'var(--text-secondary)',
                            backgroundColor: theme === t.value ? 'var(--accent-glow)' : 'transparent',
                        }}
                    >
                        {t.icon}
                        {t.label}
                        {theme === t.value && <CheckIcon />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

