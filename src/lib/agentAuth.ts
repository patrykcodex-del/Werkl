import { createHmac, randomBytes } from 'crypto';
import { prisma } from './prisma';
import type { Agent } from '../generated/prisma/client';

export function generateApiKey(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Hash an API key using HMAC-SHA256 with a server-side pepper (API_KEY_PEPPER).
 * The pepper means DB exfiltration alone cannot validate guesses — the env var
 * must also be known. Rotate keys by updating the pepper and re-issuing keys.
 */
export function hashApiKey(apiKey: string): string {
    const pepper = process.env.API_KEY_PEPPER;
    if (!pepper) throw new Error('API_KEY_PEPPER env var is required');
    return createHmac('sha256', pepper).update(apiKey).digest('hex');
}

export async function authenticateAgent(apiKey: string): Promise<Agent | null> {
    if (!apiKey) return null;
    const hash = hashApiKey(apiKey);
    return prisma.agent.findUnique({ where: { apiKeyHash: hash } });
}
