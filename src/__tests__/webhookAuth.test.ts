import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

const originalApiPepper = process.env.API_KEY_PEPPER;
const originalWebhookPepper = process.env.WEBHOOK_SECRET_PEPPER;
process.env.API_KEY_PEPPER = 'test-pepper';
// 32 bytes of hex = 64 chars, used as AES-256 key
process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);

import {
    signWebhookPayload,
    generateWebhookSecret,
    encryptWebhookSecret,
    decryptWebhookSecret,
} from '../lib/webhookAuth';

afterEach(() => {
    process.env.API_KEY_PEPPER = originalApiPepper ?? 'test-pepper';
    process.env.WEBHOOK_SECRET_PEPPER = originalWebhookPepper ?? '0'.repeat(64);
});

describe('signWebhookPayload', () => {
    it('returns sha256=<hex> where hex is HMAC-SHA256 of `${timestamp}.${body}`', () => {
        const secret = 'shared-secret';
        const timestamp = '1700000000';
        const body = '{"taskId":"t1"}';

        const expected =
            'sha256=' +
            createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

        expect(signWebhookPayload(secret, timestamp, body)).toBe(expected);
    });

    it('produces a different signature when the body changes', () => {
        expect(signWebhookPayload('s', '1', 'a')).not.toBe(signWebhookPayload('s', '1', 'b'));
    });

    it('produces a different signature when the timestamp changes (replay defence)', () => {
        expect(signWebhookPayload('s', '1', 'body')).not.toBe(signWebhookPayload('s', '2', 'body'));
    });
});

describe('generateWebhookSecret', () => {
    it('returns a 64-character hex string', () => {
        expect(generateWebhookSecret()).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different secret each call', () => {
        expect(generateWebhookSecret()).not.toBe(generateWebhookSecret());
    });
});

describe('encryptWebhookSecret / decryptWebhookSecret', () => {
    beforeEach(() => {
        process.env.WEBHOOK_SECRET_PEPPER = '0'.repeat(64);
    });

    it('round-trips: decrypt(encrypt(s)) === s', () => {
        const secret = generateWebhookSecret();
        expect(decryptWebhookSecret(encryptWebhookSecret(secret))).toBe(secret);
    });

    it('produces a non-deterministic ciphertext (fresh IV per encryption)', () => {
        const secret = 'same-input';
        expect(encryptWebhookSecret(secret)).not.toBe(encryptWebhookSecret(secret));
    });

    it('encrypted form never contains the plaintext secret', () => {
        const secret = generateWebhookSecret();
        expect(encryptWebhookSecret(secret).includes(secret)).toBe(false);
    });

    it('throws on decryption if WEBHOOK_SECRET_PEPPER changes (auth tag mismatch)', () => {
        const encrypted = encryptWebhookSecret('s');
        process.env.WEBHOOK_SECRET_PEPPER = '1'.repeat(64);
        expect(() => decryptWebhookSecret(encrypted)).toThrow();
    });

    it('throws if WEBHOOK_SECRET_PEPPER is not set', () => {
        delete process.env.WEBHOOK_SECRET_PEPPER;
        expect(() => encryptWebhookSecret('any')).toThrow('WEBHOOK_SECRET_PEPPER env var is required');
    });
});
