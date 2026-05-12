import React from 'react';
import { cn } from '../../lib/utils';
import type { WorkerSession } from '../../types';

const STATUS_CFG: Record<WorkerSession['status'], { label: string; className: string }> = {
    active: { label: '● Receiving tasks', className: 'text-success bg-success/10' },
    paused: { label: '⏸ Not receiving',   className: 'text-warning bg-warning/10' },
    ended:  { label: '◼ Ended',            className: 'text-muted bg-elevated' },
};

export function StatusBadge({ status }: { status: WorkerSession['status'] }) {
    const cfg = STATUS_CFG[status];
    return (
        <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', cfg.className)}>
            {cfg.label}
        </span>
    );
}
