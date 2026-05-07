import { useState, useEffect } from 'react';

/**
 * Returns a human-readable countdown string for a given ISO deadline.
 * Updates every second. Returns null if deadline is not set.
 * Returns "Expired" if past the deadline.
 */
export function useCountdown(deadline: string | undefined): string | null {
    const [label, setLabel] = useState<string | null>(null);

    useEffect(() => {
        if (!deadline) { setLabel(null); return; }

        function compute() {
            const diff = new Date(deadline!).getTime() - Date.now();
            if (diff <= 0) { setLabel('Expired'); return; }

            const totalSecs = Math.floor(diff / 1000);
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;

            if (h > 0) setLabel(`${h}h ${m}m`);
            else if (m > 0) setLabel(`${m}m ${s}s`);
            else setLabel(`${s}s`);
        }

        compute();
        const id = setInterval(compute, 1000);
        return () => clearInterval(id);
    }, [deadline]);

    return label;
}
