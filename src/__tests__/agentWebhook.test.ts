import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
});
