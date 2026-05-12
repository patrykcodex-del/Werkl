'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
    OAuthCallback:       'Something went wrong returning from Google. Please try again.',
    OAuthSignin:         'Could not start the Google sign-in flow. Please try again.',
    OAuthCreateAccount:  'Could not create your account. Please try again.',
    Callback:            'Sign-in callback failed. Please try again.',
    Default:             'An unexpected error occurred. Please try again.',
};

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl  = searchParams.get('callbackUrl') ?? '/';
    const errorParam   = searchParams.get('error');
    const errorMessage = errorParam ? (ERROR_MESSAGES[errorParam] ?? ERROR_MESSAGES.Default) : null;

    const { status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);

    // If the user is already signed in (e.g. hit Back after auth completed), send them home
    useEffect(() => {
        if (status === 'authenticated') {
            router.replace('/');
        }
    }, [status, router]);

    function handleSignIn() {
        setLoading(true);
        signIn('google', { callbackUrl }, { prompt: 'select_account' });
    }

    return (
        <div className="flex flex-col items-center justify-center py-24">
            <div
                className="rounded-2xl border p-10 flex flex-col items-center gap-6 w-full max-w-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
                {/* Logo mark */}
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

                <div className="text-center space-y-1">
                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Sign in to start earning</h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Complete tasks from AI agents and get paid.</p>
                </div>

                {/* Error banner */}
                {errorMessage && (
                    <div
                        className="w-full rounded-lg border px-4 py-3 text-sm text-center"
                        style={{
                            borderColor: 'rgba(248,113,113,0.35)',
                            backgroundColor: 'rgba(248,113,113,0.07)',
                            color: 'var(--red)',
                        }}
                    >
                        {errorMessage}
                    </div>
                )}

                <div className="w-full space-y-3">
                    <button
                        onClick={handleSignIn}
                        disabled={loading || status === 'loading'}
                        className="w-full flex items-center justify-center gap-3 px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:opacity-90 disabled:opacity-50"
                        style={{
                            borderColor: 'var(--border)',
                            backgroundColor: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                        }}
                    >
                        {loading ? (
                            <div className="w-4 h-4 rounded-full border-2 animate-spin"
                                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                        ) : (
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                        )}
                        {loading ? 'Redirecting to Google…' : 'Continue with Google'}
                    </button>
                </div>

                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    By signing in you agree to our terms of service.
                </p>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <Suspense>
            <SignInContent />
        </Suspense>
    );
}
