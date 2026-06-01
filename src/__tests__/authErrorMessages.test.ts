import { describe, it, expect } from 'vitest';
import { resolveAuthErrorMessage } from '../lib/authErrorMessages';

describe('resolveAuthErrorMessage', () => {
    it('returns the not-invited message for AccessDenied', () => {
        const msg = resolveAuthErrorMessage('AccessDenied');
        expect(msg).toMatch(/not.*invited/i);
    });

    it('returns null when no error code is supplied', () => {
        expect(resolveAuthErrorMessage(null)).toBeNull();
        expect(resolveAuthErrorMessage(undefined)).toBeNull();
    });

    it('falls back to the default message for unknown codes', () => {
        const msg = resolveAuthErrorMessage('SomethingNew');
        expect(msg).toBeTruthy();
        expect(msg).not.toMatch(/not.*invited/i);
    });
});
