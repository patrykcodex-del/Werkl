'use client';

import React, { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import type { TaskSortField, TaskSortOrder } from '../lib/taskStore';
import type { TaskPriority } from '../types';

const SORT_OPTIONS: { label: string; value: TaskSortField; order: TaskSortOrder }[] = [
    { label: 'Newest', value: 'createdAt', order: 'desc' },
    { label: 'Oldest', value: 'createdAt', order: 'asc' },
    { label: 'Reward ↓', value: 'reward', order: 'desc' },
    { label: 'Reward ↑', value: 'reward', order: 'asc' },
    { label: 'Priority', value: 'priority', order: 'asc' },
];

const PRIORITY_OPTIONS: { label: string; value: TaskPriority | 'all' }[] = [
    { label: 'All priorities', value: 'all' },
    { label: 'Urgent', value: 'urgent' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
];

interface TaskFiltersProps {
    currentSort: string;
    currentOrder: string;
    currentPriority: string;
}

export default function TaskFilters({ currentSort, currentOrder, currentPriority }: TaskFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const update = useCallback(
        (key: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === '' || value === 'all') {
                params.delete(key);
            } else {
                params.set(key, value);
            }
            router.push(`${pathname}?${params.toString()}`);
        },
        [router, pathname, searchParams],
    );

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [field, order] = e.target.value.split(':');
        const params = new URLSearchParams(searchParams.toString());
        params.set('sort', field);
        params.set('order', order);
        router.push(`${pathname}?${params.toString()}`);
    };

    const sortValue = `${currentSort}:${currentOrder}`;

    const selectStyle: React.CSSProperties = {
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-primary)',
        borderColor: 'var(--border)',
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: '0.5rem',
        padding: '0.25rem 2rem 0.25rem 0.75rem',
        fontSize: '0.875rem',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.5rem center',
        cursor: 'pointer',
        outline: 'none',
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Sort
                </label>
                <select value={sortValue} onChange={handleSortChange} style={selectStyle}>
                    {SORT_OPTIONS.map((o) => (
                        <option key={`${o.value}:${o.order}`} value={`${o.value}:${o.order}`}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Priority
                </label>
                <select
                    value={currentPriority || 'all'}
                    onChange={(e) => update('priority', e.target.value)}
                    style={selectStyle}
                >
                    {PRIORITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
