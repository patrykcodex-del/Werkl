import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { authenticateOperatorFromRequest } from '../lib/operatorAuth';

const OPERATOR_KEY = 'operator-secret-key';

beforeEach(() => {
    process.env.OPERATOR_API_KEY = OPERATOR_KEY;
});

afterEach(() => {
    delete process.env.OPERATOR_API_KEY;
});

function makeHeaders(operatorKey?: string) {
    const headers = new Headers();
    if (operatorKey !== undefined) headers.set('x-operator-key', operatorKey);
    return headers;
}

describe('authenticateOperatorFromRequest', () => {
    it('returns 401 when x-operator-key header is missing', async () => {
        const result = await authenticateOperatorFromRequest(makeHeaders());
        expect(result).toEqual({ success: false, status: 401, error: 'Operator key required' });
    });

    it('returns 401 when the operator key does not match', async () => {
        const result = await authenticateOperatorFromRequest(makeHeaders('wrong-key'));
        expect(result).toEqual({ success: false, status: 401, error: 'Invalid operator key' });
    });

    it('returns success when the operator key matches', async () => {
        const result = await authenticateOperatorFromRequest(makeHeaders(OPERATOR_KEY));
        expect(result).toEqual({ success: true });
    });

    it('throws if OPERATOR_API_KEY env var is not set', async () => {
        delete process.env.OPERATOR_API_KEY;
        await expect(authenticateOperatorFromRequest(makeHeaders('any'))).rejects.toThrow(
            'OPERATOR_API_KEY env var is required'
        );
    });
});
