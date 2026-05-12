import type { TaskPriority } from '../types';

/** Tailwind bg-* class per priority — used for coloured dots */
export const PRIORITY_DOT_CLASS: Record<TaskPriority, string> = {
    urgent: 'bg-danger',
    high:   'bg-warning',
    medium: 'bg-accent',
    low:    'bg-muted',
};

/** Tailwind text-* class per priority */
export const PRIORITY_TEXT_CLASS: Record<TaskPriority, string> = {
    urgent: 'text-danger',
    high:   'text-warning',
    medium: 'text-accent',
    low:    'text-muted',
};
