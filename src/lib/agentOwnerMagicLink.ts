import { createHmac, randomBytes } from 'crypto';

export const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

export function generateMagicToken(): string {
    return randomBytes(32).toString('hex');
}

/**
 * HMAC-SHA256 with API_KEY_PEPPER. Same threat model as agent API keys:
 * DB exfiltration alone cannot validate guesses without the env pepper.
 */
export function hashMagicToken(token: string): string {
    const pepper = process.env.API_KEY_PEPPER;
    if (!pepper) throw new Error('API_KEY_PEPPER env var is required');
    return createHmac('sha256', pepper).update(token).digest('hex');
}

export function magicLinkUrl(token: string, agentId: string): string {
    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const u = new URL('/api/auth/agent/verify', base);
    u.searchParams.set('token', token);
    u.searchParams.set('agentId', agentId);
    return u.toString();
}

export type MagicLinkSender = (to: string, url: string) => Promise<void>;

export const sendMagicLink: MagicLinkSender = async (to, url) => {
    // Default dev sender — log the link so it can be clicked from the terminal.
    // Production deployments override this via dependency injection (issue #15).
    console.log(`[agent-owner magic link] to=${to} url=${url}`);
};
