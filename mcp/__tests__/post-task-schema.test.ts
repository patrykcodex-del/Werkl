import { describe, it, expect } from 'vitest';
import { postTaskInputSchema } from '../schemas.js';

describe('post_task tool schema', () => {
    it('does not expose a postedBy field — identity is resolved from the API key server-side', () => {
        expect('postedBy' in postTaskInputSchema.shape).toBe(false);
    });

    it('requires title and description', () => {
        expect(postTaskInputSchema.safeParse({}).success).toBe(false);
        expect(postTaskInputSchema.safeParse({ title: 'T' }).success).toBe(false);
        expect(
            postTaskInputSchema.safeParse({ title: 'T', description: 'D' }).success
        ).toBe(true);
    });

    it('accepts all optional fields', () => {
        expect(
            postTaskInputSchema.safeParse({
                title: 'T',
                description: 'D',
                context: 'ctx',
                priority: 'high',
                reward_amount: 5.0,
                reward_currency: 'USD',
            }).success
        ).toBe(true);
    });

    it('rejects an unknown priority value', () => {
        expect(
            postTaskInputSchema.safeParse({
                title: 'T',
                description: 'D',
                priority: 'extreme',
            }).success
        ).toBe(false);
    });
});
