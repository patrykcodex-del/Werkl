import React from 'react';
import { cn } from '../../lib/utils';

const STAT_VARIANTS = {
    success: { bg: 'bg-success/10', value: 'text-success' },
    warning: { bg: 'bg-warning/10', value: 'text-warning' },
    danger:  { bg: 'bg-danger/10',  value: 'text-danger' },
} as const;

interface StatCardProps {
    icon: string;
    label: string;
    value: number;
    variant: keyof typeof STAT_VARIANTS;
}

export function StatCard({ icon, label, value, variant }: StatCardProps) {
    const { bg, value: valueClass } = STAT_VARIANTS[variant];
    return (
        <div className={cn('flex flex-col gap-1.5 rounded-xl p-3 border border-white/[0.04]', bg)}>
            <div className="flex items-center justify-between">
                <span className="text-sm">{icon}</span>
                <span className={cn('font-mono text-xl font-bold tabular-nums', valueClass)}>
                    {value}
                </span>
            </div>
            <span className="text-xs font-medium text-muted">{label}</span>
        </div>
    );
}
