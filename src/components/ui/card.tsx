import * as React from 'react';
import { cn } from '../../lib/utils';

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('rounded-2xl border border-border bg-surface overflow-hidden', className)}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('flex items-center gap-2 px-4 py-3 border-b border-border bg-elevated', className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return <div className={cn('p-4', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn('px-4 py-2.5 border-t border-border', className)}
            {...props}
        />
    );
}

export { Card, CardHeader, CardContent, CardFooter };
