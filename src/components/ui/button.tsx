import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
    {
        variants: {
            variant: {
                accent:          'bg-accent text-white hover:opacity-90',
                outline:         'border border-border bg-transparent text-secondary hover:bg-white/5',
                ghost:           'bg-transparent text-muted border border-border hover:bg-white/5',
                destructive:     'bg-danger text-white hover:opacity-90',
                'danger-outline':'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/15',
                'accent-outline':'border border-accent text-accent bg-transparent hover:bg-white/5',
            },
            size: {
                sm:   'px-3 py-2 text-xs rounded-lg',
                md:   'px-5 py-3 text-sm rounded-xl',
                full: 'w-full py-3 text-sm rounded-xl',
            },
        },
        defaultVariants: {
            variant: 'accent',
            size: 'md',
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => (
        <button
            className={cn(buttonVariants({ variant, size }), className)}
            ref={ref}
            {...props}
        />
    ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };
