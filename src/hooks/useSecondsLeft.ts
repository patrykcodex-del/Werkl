import { useState, useEffect } from 'react';

export function useSecondsLeft(expiresAt: string | undefined): number {
    const compute = (exp: string | undefined) =>
        exp ? Math.max(0, Math.floor((new Date(exp).getTime() - Date.now()) / 1000)) : 0;
    const [secs, setSecs] = useState(() => compute(expiresAt));
    useEffect(() => {
        if (!expiresAt) return;
        setSecs(compute(expiresAt));
        const id = setInterval(() => setSecs(compute(expiresAt)), 500);
        return () => clearInterval(id);
    }, [expiresAt]);
    return secs;
}
