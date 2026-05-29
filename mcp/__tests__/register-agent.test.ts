import { describe, it, expect } from 'vitest';
import { registerAgentInputSchema } from '../schemas.js';

describe('register_agent tool schema', () => {
    it('requires name', () => {
        expect(registerAgentInputSchema.safeParse({}).success).toBe(false);
    });

    it('accepts name alone', () => {
        expect(registerAgentInputSchema.safeParse({ name: 'my-agent' }).success).toBe(true);
    });

    it('accepts name with a valid callbackUrl', () => {
        expect(
            registerAgentInputSchema.safeParse({
                name: 'my-agent',
                callbackUrl: 'https://example.com/cb',
            }).success
        ).toBe(true);
    });

    it('rejects an invalid callbackUrl', () => {
        expect(
            registerAgentInputSchema.safeParse({
                name: 'my-agent',
                callbackUrl: 'not-a-url',
            }).success
        ).toBe(false);
    });
});
