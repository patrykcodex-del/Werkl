import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';

/**
 * Generate a random webhook signing secret (64-char hex).
 * Returned once at Agent Registration; only the encrypted form is persisted.
 */
export function generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Sign an outbound webhook. The signed string is `${timestamp}.${body}`
 * so that replaying an old request with the same body fails verification.
 * Returns the value to place in the `X-Werkl-Signature` header.
 */
export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
    const mac = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `sha256=${mac}`;
}

function getPepperKey(): Buffer {
    const pepper = process.env.WEBHOOK_SECRET_PEPPER;
    if (!pepper) throw new Error('WEBHOOK_SECRET_PEPPER env var is required');
    const key = Buffer.from(pepper, 'hex');
    if (key.length !== 32) {
        throw new Error('WEBHOOK_SECRET_PEPPER must be 32 bytes (64 hex chars)');
    }
    return key;
}

/**
 * Encrypt a webhook secret for at-rest storage on the Agent record.
 * Uses AES-256-GCM keyed by WEBHOOK_SECRET_PEPPER; the server can decrypt
 * to sign outbound webhooks, but a DB-only exfiltration is unusable without
 * the pepper. Format: `<iv-hex>:<authTag-hex>:<ciphertext-hex>`.
 */
export function encryptWebhookSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getPepperKey(), iv);
    const ct = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

export function decryptWebhookSecret(encrypted: string): string {
    const [ivHex, tagHex, ctHex] = encrypted.split(':');
    if (!ivHex || !tagHex || !ctHex) {
        throw new Error('Invalid encrypted webhook secret format');
    }
    const decipher = createDecipheriv('aes-256-gcm', getPepperKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
    return pt.toString('utf8');
}
