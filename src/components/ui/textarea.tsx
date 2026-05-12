import * as React from 'react';
import { cn } from '../../lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => (
        <textarea
            className={cn(
                'w-full rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm text-primary',
                'placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-y',
                className,
            )}
            ref={ref}
            {...props}
        />
    ),
);
Textarea.displayName = 'Textarea';

export { Textarea };
