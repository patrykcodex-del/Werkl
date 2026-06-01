'use client';

import { getProviders, signIn } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { resolveAuthErrorMessage } from '../lib/authErrorMessages';

type ProviderRecord = Record<
    string,
    { id: string; name: string; type: string; signinUrl: string; callbackUrl: string }
>;

export interface AuthDialogProps {
    /** Whether the dialog/card is open / rendered. In "page" variant this is always true. */
    open: boolean;
    /** Called when the user dismisses the dialog (N/A for "page" variant). */
    onClose?: () => void;
    callbackUrl?: string;
    /** NextAuth error code passed via ?error= query param. */
    error?: string | null;
    /**
     * "dialog" – renders as a modal overlay (default).
     * "page"   – renders as a standalone centered card (no backdrop).
     */
    variant?: 'dialog' | 'page';
}


/* ── Provider icons ───────────────────────────────────────────────────────── */

function GoogleIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

function GitHubIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
    );
}

function DiscordIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.102.127 18.118c2.057 1.508 4.053 2.423 6.017 3.028a.077.077 0 0 0 .084-.028c.463-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.12 13.12 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.028.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
    );
}

function TwitterXIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
        </svg>
    );
}

function MicrosoftIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 21 21" aria-hidden="true">
            <path fill="#F25022" d="M0 0h10v10H0z" />
            <path fill="#00A4EF" d="M11 0h10v10H11z" />
            <path fill="#7FBA00" d="M0 11h10v10H0z" />
            <path fill="#FFB900" d="M11 11h10v10H11z" />
        </svg>
    );
}

function AppleIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
            <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.8 0 282.4 0 192.5 0 85.4 61.1 30 120 30c57.1 0 99.7 37.9 133.7 37.9 31.5 0 81.8-40.8 143.4-40.8 22.3 0 108.2 2.6 172.2 80.3zm-170.5-117c-10.3 46.7-54.6 95.9-100.9 95.9-2.6 0-5.2-.3-7.8-.9-1.9-46.7 32.8-99.7 73-125.4 21.7-13.6 56.4-25.2 74.4-25.2 2.6 0 5.2.3 7.7.9-1.9 18.1-17.5 48.5-46.4 54.7z" />
        </svg>
    );
}

function LinkedInIcon() {
    return (
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
    );
}

const PROVIDER_META: Record<string, { icon: React.ReactNode; shortName: string }> = {
    google:     { icon: <GoogleIcon />,    shortName: 'Google' },
    github:     { icon: <GitHubIcon />,    shortName: 'GitHub' },
    discord:    { icon: <DiscordIcon />,   shortName: 'Discord' },
    twitter:    { icon: <TwitterXIcon />,  shortName: 'X' },
    'azure-ad': { icon: <MicrosoftIcon />, shortName: 'Microsoft' },
    apple:      { icon: <AppleIcon />,     shortName: 'Apple' },
    linkedin:   { icon: <LinkedInIcon />,  shortName: 'LinkedIn' },
};

/* ── Card content (shared between dialog and page variants) ───────────────── */

interface CardProps {
    providers: ProviderRecord | null;
    loadingId: string | null;
    errorMsg: string | null;
    onSignIn: (id: string) => void;
    onClose?: () => void;
    showClose: boolean;
}

function AuthCard({ providers, loadingId, errorMsg, onSignIn, onClose, showClose }: CardProps) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-dialog-title"
            className="relative rounded-2xl border w-full max-w-sm p-8 flex flex-col gap-6"
            style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
        >
            {/* Close button */}
            {showClose && onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1 rounded-md opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                    aria-label="Close sign-in dialog"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}

            {/* Brand */}
            <div className="flex items-center gap-2">
                <span
                    className="font-mono text-xs px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: 'var(--accent-glow)', color: 'var(--accent)' }}
                >
                    AI
                </span>
                <span className="font-semibold text-sm tracking-wide" style={{ color: 'var(--text-primary)' }}>
                    Werkl.ai
                </span>
            </div>

            {/* Heading */}
            <div className="space-y-1">
                <h2 id="auth-dialog-title" className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    Sign in to start earning
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Complete tasks from AI agents and get paid.
                </p>
            </div>

            {/* Error banner */}
            {errorMsg && (
                <div
                    className="rounded-lg border px-4 py-3 text-sm"
                    style={{
                        borderColor: 'rgba(248,113,113,0.35)',
                        backgroundColor: 'rgba(248,113,113,0.07)',
                        color: 'var(--red)',
                    }}
                >
                    {errorMsg}
                </div>
            )}

            {/* Provider buttons */}
            <div className="flex flex-col gap-2.5">
                {providers === null ? (
                    // Loading skeleton
                    [1, 2].map(i => (
                        <div
                            key={i}
                            className="h-10 w-full rounded-lg animate-pulse"
                            style={{ backgroundColor: 'var(--bg-elevated)' }}
                        />
                    ))
                ) : Object.values(providers).map(provider => {
                    const meta = PROVIDER_META[provider.id];
                    const isLoading = loadingId === provider.id;
                    return (
                        <button
                            key={provider.id}
                            onClick={() => onSignIn(provider.id)}
                            disabled={loadingId !== null}
                            className="w-full flex items-center justify-center gap-3 px-5 py-2.5 rounded-lg border text-sm font-medium transition-all hover:opacity-90 disabled:opacity-50"
                            style={{
                                borderColor: 'var(--border)',
                                backgroundColor: 'var(--bg-elevated)',
                                color: 'var(--text-primary)',
                            }}
                        >
                            {isLoading ? (
                                <div
                                    className="w-4 h-4 rounded-full border-2 animate-spin"
                                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                                />
                            ) : (
                                meta?.icon ?? null
                            )}
                            {isLoading
                                ? `Redirecting to ${meta?.shortName ?? provider.name}…`
                                : `Continue with ${meta?.shortName ?? provider.name}`}
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                By signing in you agree to our{' '}
                <a href="/terms" className="underline hover:opacity-80" style={{ color: 'var(--accent)' }}>Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="underline hover:opacity-80" style={{ color: 'var(--accent)' }}>Privacy Policy</a>.
            </p>
        </div>
    );
}

/* ── AuthDialog ───────────────────────────────────────────────────────────── */

export function AuthDialog({
    open,
    onClose,
    callbackUrl = '/',
    error,
    variant = 'dialog',
}: AuthDialogProps) {
    const [providers, setProviders] = useState<ProviderRecord | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Fetch providers once on first open
    useEffect(() => {
        if ((open || variant === 'page') && providers === null) {
            getProviders().then(setProviders);
        }
    }, [open, variant, providers]);

    // ESC key to close (dialog variant only)
    useEffect(() => {
        if (variant !== 'dialog' || !open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open, onClose, variant]);

    // Lock body scroll while dialog is open
    useEffect(() => {
        if (variant !== 'dialog') return;
        document.body.style.overflow = open ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [open, variant]);

    async function handleSignIn(providerId: string) {
        setLoadingId(providerId);
        const extra: Record<string, string> = providerId === 'google' ? { prompt: 'select_account' } : {};
        await signIn(providerId, { callbackUrl }, extra);
        // signIn redirects the browser; this line is a safety fallback
        setLoadingId(null);
    }

    const errorMsg = resolveAuthErrorMessage(error);

    // ── Page variant ──────────────────────────────────────────────────────────
    if (variant === 'page') {
        return (
            <div className="flex items-center justify-center py-24 px-4">
                <AuthCard
                    providers={providers}
                    loadingId={loadingId}
                    errorMsg={errorMsg}
                    onSignIn={handleSignIn}
                    showClose={false}
                />
            </div>
        );
    }

    // ── Dialog / modal variant ────────────────────────────────────────────────
    if (!open) return null;

    return (
        <div
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) onClose?.(); }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
            <AuthCard
                providers={providers}
                loadingId={loadingId}
                errorMsg={errorMsg}
                onSignIn={handleSignIn}
                onClose={onClose}
                showClose={true}
            />
        </div>
    );
}
