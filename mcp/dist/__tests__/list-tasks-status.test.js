import { describe, it, expect } from 'vitest';
import { taskStatusSchema } from '../schemas.js';
describe('list_tasks status schema', () => {
    it('accepts all current TaskStatus values', () => {
        const valid = ['open', 'offered', 'claimed', 'in-progress', 'pending_verification', 'approved', 'rejected', 'expired', 'cancelled'];
        for (const status of valid) {
            expect(taskStatusSchema.safeParse(status).success, `expected "${status}" to be valid`).toBe(true);
        }
    });
    it('rejects the stale "completed" status', () => {
        expect(taskStatusSchema.safeParse('completed').success).toBe(false);
    });
    it('rejects unknown values', () => {
        expect(taskStatusSchema.safeParse('done').success).toBe(false);
        expect(taskStatusSchema.safeParse('').success).toBe(false);
    });
});
