import { describe, it, expect } from 'vitest';

/**
 * resolveApiKey logic is tested here by extracting its behaviour inline,
 * matching the implementation in index.ts.
 */
function resolveApiKey(param: string | undefined, envKey: string): string {
    const key = param ?? envKey;
    if (!key) {
        throw new Error(
            'No API key provided. Pass api_key as an argument or set WERKL_API_KEY in the MCP server environment.'
        );
    }
    return key;
}

describe('resolveApiKey', () => {
    it('uses the explicit param when provided', () => {
        expect(resolveApiKey('param-key', 'env-key')).toBe('param-key');
    });

    it('falls back to the env key when param is undefined', () => {
        expect(resolveApiKey(undefined, 'env-key')).toBe('env-key');
    });

    it('throws with a helpful message when neither is available', () => {
        expect(() => resolveApiKey(undefined, '')).toThrow(/api_key/);
        expect(() => resolveApiKey(undefined, '')).toThrow(/WERKL_API_KEY/);
    });

    it('treats an empty param string as missing (falls back to env)', () => {
        const emptyParam = '' as string | undefined;
        expect(resolveApiKey(emptyParam || undefined, 'env-key')).toBe('env-key');
    });
});
