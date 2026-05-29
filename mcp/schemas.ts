import { z } from 'zod';

export const taskStatusSchema = z.enum([
    'open',
    'offered',
    'claimed',
    'in-progress',
    'pending_verification',
    'approved',
    'rejected',
    'expired',
    'cancelled',
]);

export type McpTaskStatus = z.infer<typeof taskStatusSchema>;

// ── register_agent ─────────────────────────────────────────────────────────────
export const registerAgentInputSchema = z.object({
    name: z.string().describe('Unique name for this Agent'),
    callbackUrl: z
        .string()
        .url()
        .optional()
        .describe('Webhook URL to notify when a Task reaches pending_verification'),
});

// ── post_task ──────────────────────────────────────────────────────────────────
// postedBy is NOT a parameter — it is resolved server-side from the API key.
export const postTaskInputSchema = z.object({
    title: z.string().describe('Short, clear title for the task'),
    description: z.string().describe('Full description of what the human needs to do'),
    context: z.string().optional().describe('Any additional data or context the human will need'),
    priority: z
        .enum(['low', 'medium', 'high', 'urgent'])
        .optional()
        .default('medium')
        .describe('How urgently this task needs to be done'),
    reward_amount: z.number().optional().describe('How much to pay the human (e.g. 5.00)'),
    reward_currency: z.string().optional().default('USD').describe('Currency code (e.g. USD, EUR)'),
});
