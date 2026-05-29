import { describe, it, expect } from 'vitest';
import { reopenTaskInputSchema } from '../schemas.js';

describe('reopen_task tool schema', () => {
    it('requires id', () => {
        expect(reopenTaskInputSchema.safeParse({}).success).toBe(false);
    });

    it('accepts id alone', () => {
        expect(reopenTaskInputSchema.safeParse({ id: 'task-abc' }).success).toBe(true);
    });

    it('accepts id with an api_key', () => {
        expect(
            reopenTaskInputSchema.safeParse({ id: 'task-abc', api_key: 'my-key' }).success
        ).toBe(true);
    });

    it('strips unknown extra fields (permissive schema)', () => {
        const result = reopenTaskInputSchema.safeParse({ id: 'task-abc', unknown: 'field' });
        expect(result.success).toBe(true);
        expect(result.data?.id).toBe('task-abc');
        expect((result.data as Record<string, unknown>).unknown).toBeUndefined();
    });
});
