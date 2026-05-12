import { cn } from '../../lib/utils';

interface PingDotProps {
    /** Tailwind bg-* class for the dot colour, e.g. "bg-success", "bg-accent" */
    colorClass?: string;
    size?: 'sm' | 'md';
    className?: string;
}

/**
 * Animated pulsing dot — used for live / active status indicators.
 */
export function PingDot({
    colorClass = 'bg-success',
    size = 'sm',
    className,
}: PingDotProps) {
    const dim = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5';
    return (
        <span className={cn('relative flex shrink-0', dim, className)}>
            <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', colorClass)} />
            <span className={cn('relative inline-flex rounded-full', dim, colorClass)} />
        </span>
    );
}
