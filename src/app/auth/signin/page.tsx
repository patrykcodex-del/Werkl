'use client';

import { AuthDialog } from '../../../components/AuthDialog';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

function SignInContent() {
    const searchParams = useSearchParams();
    const callbackUrl  = searchParams.get('callbackUrl') ?? '/';
    const errorParam   = searchParams.get('error');

    const { status } = useSession();
    const router = useRouter();

    // If already signed in, redirect home
    useEffect(() => {
        if (status === 'authenticated') {
            router.replace('/');
        }
    }, [status, router]);

    return (
        <AuthDialog
            open={true}
            variant="page"
            callbackUrl={callbackUrl}
            error={errorParam}
        />
    );
}

export default function SignInPage() {
    return (
        <Suspense>
            <SignInContent />
        </Suspense>
    );
}
