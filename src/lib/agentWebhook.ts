import type { TaskStatus } from '../types';
import { signWebhookPayload } from './webhookAuth';

interface WebhookPayload {
    taskId: string;
    status: TaskStatus;
    title: string;
}

/**
 * Fire-and-forget POST to the Agent's callbackUrl when a Task transitions.
 * Does not await, does not fail the caller, logs a warning on error.
 *
 * If `webhookSecret` is provided, the request is signed with HMAC-SHA-256
 * over `${timestamp}.${body}` and the signature is sent in `X-Werkl-Signature`
 * alongside `X-Werkl-Timestamp`. Agents whose secret is null (pre-rollout)
 * receive an unsigned POST and a deprecation warning is logged server-side.
 */
export function fireAgentWebhook(
    callbackUrl: string | null,
    payload: WebhookPayload,
    webhookSecret?: string | null,
): void {
    if (!callbackUrl) return;

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (webhookSecret) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        headers['X-Werkl-Timestamp'] = timestamp;
        headers['X-Werkl-Signature'] = signWebhookPayload(webhookSecret, timestamp, body);
    } else {
        console.warn(
            `[agentWebhook] sending unsigned webhook to ${callbackUrl} (deprecated; Agent has no webhookSecretEncrypted — rotate via /reset-webhook-secret)`,
            { callbackUrl },
        );
    }

    fetch(callbackUrl, { method: 'POST', headers, body })
        .then(res => {
            if (!res.ok) {
                console.warn(`[agentWebhook] webhook to ${callbackUrl} returned ${res.status}`, new Error(`HTTP ${res.status}`));
            }
        })
        .catch(err => {
            console.warn(`[agentWebhook] webhook to ${callbackUrl} failed`, err);
        });
}
