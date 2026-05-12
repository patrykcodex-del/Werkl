import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center font-semibold', {
    variants: {
        variant: {
            default: 'text-xs px-2.5 py-1 rounded-full text-muted bg-elevated',
            success: 'text-xs px-2.5 py-1 rounded-full text-success bg-success/10',
            warning: 'text-xs px-2.5 py-1 rounded-full text-warning bg-warning/10',
            danger:  'text-xs px-2.5 py-1 rounded-full text-danger bg-danger/10',
            accent:  'text-xs px-2.5 py-1 rounded-full text-accent bg-accent/10',
            counter: 'text-xs font-bold px-2 py-0.5 rounded-full bg-surface text-muted border border-border',
            mono:    'font-mono text-xs px-2 py-0.5 rounded text-success bg-success/10',
        },
    },
    defaultVariants: { variant: 'default' },
});

export interface BadgeProps
    extends React.HTMLAttributes<HTMLSpanElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
