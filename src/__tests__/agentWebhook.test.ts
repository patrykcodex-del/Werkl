import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { fireAgentWebhook } from '../lib/agentWebhook';

beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('fireAgentWebhook', () => {
    it('fires a POST to callbackUrl with the correct payload when callbackUrl is set', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200 });

        fireAgentWebhook('https://agent.example.com/webhook', {
            taskId: 'task-1',
            status: 'pending_verification',
            title: 'Test Task',
        });

        // Allow the microtask queue to flush
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockFetch).toHaveBeenCalledOnce();
        expect(mockFetch).toHaveBeenCalledWith(
            'https://agent.example.com/webhook',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ taskId: 'task-1', status: 'pending_verification', title: 'Test Task' }),
            })
        );
    });

    it('does not fire any request when callbackUrl is null', async () => {
        fireAgentWebhook(null, {
            taskId: 'task-1',
            status: 'pending_verification',
            title: 'Test Task',
        });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('logs a warning and does not throw when the fetch fails', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        fireAgentWebhook('https://agent.example.com/webhook', {
            taskId: 'task-1',
            status: 'pending_verification',
            title: 'Test Task',
        });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('webhook'),
            expect.any(Error)
        );
    });

    it('logs a warning when the webhook returns a non-2xx status', async () => {
        mockFetch.mockResolvedValue({ ok: false, status: 500 });

        fireAgentWebhook('https://agent.example.com/webhook', {
            taskId: 'task-1',
            status: 'pending_verification',
            title: 'Test Task',
        });

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('webhook'),
            expect.anything()
        );
    });

    it('includes X-Werkl-Signature and X-Werkl-Timestamp headers when a webhookSecret is provided', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200 });
        const secret = 'agent-shared-secret';
        const payload = {
            taskId: 'task-1',
            status: 'pending_verification' as const,
            title: 'Test Task',
        };

        fireAgentWebhook('https://agent.example.com/webhook', payload, secret);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockFetch).toHaveBeenCalledOnce();
        const [, init] = mockFetch.mock.calls[0];
        const headers = init.headers as Record<string, string>;
        const body = init.body as string;

        expect(headers['X-Werkl-Timestamp']).toMatch(/^\d+$/);
        const expectedSig =
            'sha256=' +
            createHmac('sha256', secret)
                .update(`${headers['X-Werkl-Timestamp']}.${body}`)
                .digest('hex');
        expect(headers['X-Werkl-Signature']).toBe(expectedSig);
    });

    it('sends unsigned and logs a deprecation warning when webhookSecret is null (legacy Agent)', async () => {
        mockFetch.mockResolvedValue({ ok: true, status: 200 });

        fireAgentWebhook(
            'https://agent.example.com/webhook',
            { taskId: 'task-1', status: 'pending_verification', title: 'Test Task' },
            null,
        );
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockFetch).toHaveBeenCalledOnce();
        const [, init] = mockFetch.mock.calls[0];
        const headers = init.headers as Record<string, string>;
        expect(headers['X-Werkl-Signature']).toBeUndefined();
        expect(headers['X-Werkl-Timestamp']).toBeUndefined();
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('deprecat'),
            expect.anything(),
        );
    });
});
