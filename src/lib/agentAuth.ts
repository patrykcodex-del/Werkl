import { createHmac, randomBytes } from 'crypto';
import { prisma } from './prisma';
import type { Agent } from '../generated/prisma/client';
import type { NextRequest } from 'next/server';

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

type AgentAuthResult =
    | { success: true; agent: Agent }
    | { success: false; status: 401 | 403; error: string };

/**
 * Resolve the calling Agent from the `x-api-key` request header.
 * Returns a structured result so callers can return the correct HTTP status
 * without needing to know the auth internals.
 */
export async function authenticateAgentFromRequest(req: NextRequest): Promise<AgentAuthResult> {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) return { success: false, status: 401, error: 'API key required' };

    const agent = await authenticateAgent(apiKey);
    if (!agent) return { success: false, status: 401, error: 'Invalid API key' };

    if (agent.suspended) return { success: false, status: 403, error: 'Agent is suspended' };

    return { success: true, agent };
}
