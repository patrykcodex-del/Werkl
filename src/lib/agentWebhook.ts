interface WebhookPayload {
    taskId: string;
    status: string;
    title: string;
}

/**
 * Fire-and-forget POST to the Agent's callbackUrl when a Task transitions.
 * Does not await, does not fail the caller, logs a warning on error.
 */
export function fireAgentWebhook(callbackUrl: string | null, payload: WebhookPayload): void {
    if (!callbackUrl) return;

    fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
        .then(res => {
            if (!res.ok) {
                console.warn(`[agentWebhook] webhook to ${callbackUrl} returned ${res.status}`, new Error(`HTTP ${res.status}`));
            }
        })
        .catch(err => {
            console.warn(`[agentWebhook] webhook to ${callbackUrl} failed`, err);
        });
}
