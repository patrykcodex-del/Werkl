import { describe, it, expect, vi, beforeEach } from 'vitest';

// Set pepper before importing module under test
process.env.API_KEY_PEPPER = 'test-pepper';

// Mock prisma before importing agentAuth
vi.mock('../lib/prisma', () => ({
    prisma: {
        agent: {
            findUnique: vi.fn(),
        },
    },
}));

import { generateApiKey, hashApiKey, authenticateAgent } from '../lib/agentAuth';
import { prisma } from '../lib/prisma';

const mockFindUnique = vi.mocked(prisma.agent.findUnique);

beforeEach(() => {
    vi.clearAllMocks();
});

describe('generateApiKey', () => {
    it('returns a 64-character hex string', () => {
        const key = generateApiKey();
        expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns a different key each time', () => {
        expect(generateApiKey()).not.toBe(generateApiKey());
    });
});

describe('hashApiKey', () => {
    it('is deterministic for the same input and pepper', () => {
        expect(hashApiKey('abc')).toBe(hashApiKey('abc'));
    });

    it('produces different hashes for different inputs', () => {
        expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'));
    });

    it('throws if API_KEY_PEPPER is not set', () => {
        const original = process.env.API_KEY_PEPPER;
        delete process.env.API_KEY_PEPPER;
        expect(() => hashApiKey('any')).toThrow('API_KEY_PEPPER env var is required');
        process.env.API_KEY_PEPPER = original;
    });
});

describe('authenticateAgent', () => {
    const fakeAgent = {
        id: 'agent-1',
        name: 'test-agent',
        apiKeyHash: hashApiKey('valid-key'),
        callbackUrl: null,
        suspended: false,
        tasksPostedCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    it('returns null for an empty key', async () => {
        expect(await authenticateAgent('')).toBeNull();
        expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it('returns null when the key hash is not found (invalid key)', async () => {
        mockFindUnique.mockResolvedValueOnce(null);
        expect(await authenticateAgent('bad-key')).toBeNull();
    });

    it('returns the Agent for a valid key', async () => {
        mockFindUnique.mockResolvedValueOnce(fakeAgent);
        const agent = await authenticateAgent('valid-key');
        expect(agent).toEqual(fakeAgent);
        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { apiKeyHash: hashApiKey('valid-key') },
        });
    });

    it('returns a suspended Agent (caller decides whether to reject)', async () => {
        mockFindUnique.mockResolvedValueOnce({ ...fakeAgent, suspended: true });
        const agent = await authenticateAgent('valid-key');
        expect(agent?.suspended).toBe(true);
    });
});
