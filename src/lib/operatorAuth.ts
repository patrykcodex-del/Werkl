import { Buffer } from 'buffer';
import { timingSafeEqual } from 'crypto';

type OperatorAuthResult =
    | { success: true }
    | { success: false; status: 401; error: string };

function constantTimeEqual(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
}

export async function authenticateOperatorFromRequest(headers: Headers): Promise<OperatorAuthResult> {
    const supplied = headers.get('x-operator-key');
    if (!supplied) return { success: false, status: 401, error: 'Operator key required' };

    const expected = process.env.OPERATOR_API_KEY;
    if (!expected) throw new Error('OPERATOR_API_KEY env var is required');

    if (!constantTimeEqual(supplied, expected)) {
        return { success: false, status: 401, error: 'Invalid operator key' };
    }
    return { success: true };
}
