#!/usr/bin/env node
/**
 * werkl.ai MCP Server
 *
 * Allows AI agents to post tasks to werkl.ai for humans to complete,
 * and to check back on the results.
 *
 * Usage with Claude Desktop / any MCP client:
 * {
 *   "mcpServers": {
 *     "werkl": {
 *       "command": "npx",
 *       "args": ["tsx", "/path/to/mcp/index.ts"],
 *       "env": {
 *         "WERKL_API_URL": "http://localhost:3000",
 *         "WERKL_API_KEY": "<optional: your per-agent key from register_agent>"
 *       }
 *     }
 *   }
 * }
 *
 * First time? Call `register_agent` — no key required. You'll receive a key
 * you can either set as WERKL_API_KEY in your MCP config or pass directly
 * as the `api_key` argument on each subsequent tool call.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { taskStatusSchema, registerAgentInputSchema, postTaskInputSchema, reopenTaskInputSchema } from './schemas.js';

const API_URL = process.env.WERKL_API_URL ?? 'http://localhost:3000';
// Optional: agents may supply their key via WERKL_API_KEY env var or per-tool api_key argument.
const ENV_API_KEY = process.env.WERKL_API_KEY ?? '';

const apiKeyParam = z
    .string()
    .optional()
    .describe('Your per-agent API key. Only required if WERKL_API_KEY is not set in the MCP server environment.');

function resolveApiKey(param: string | undefined): string {
    const key = param ?? ENV_API_KEY;
    if (!key) {
        throw new Error(
            'No API key provided. Pass api_key as an argument or set WERKL_API_KEY in the MCP server environment. ' +
            'Use register_agent first to obtain a key.'
        );
    }
    return key;
}

async function apiFetch(path: string, apiKey: string, options?: RequestInit) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            ...(options?.headers ?? {}),
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
}

/** apiFetch variant for unauthenticated endpoints (e.g. register). */
async function apiFetchOpen(path: string, options?: RequestInit) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    return res.json();
}

const server = new McpServer({
    name: 'werkl-ai',
    version: '1.0.0',
});

// ── Tool: register_agent ───────────────────────────────────────────────────────
server.tool(
    'register_agent',
    'Register this Agent with werkl.ai and receive a unique API key. No existing key required — registration is open. Store the returned key as WERKL_API_KEY in your MCP client config or pass it as api_key to other tools.',
    registerAgentInputSchema.shape,
    async ({ name, callbackUrl, ownerEmail }) => {
        const result = await apiFetchOpen('/api/agents/register', {
            method: 'POST',
            body: JSON.stringify({ name, callbackUrl, ownerEmail }),
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `Agent registered successfully.\nAgent ID: ${result.agentId}\nAPI Key: ${result.apiKey}\n\n⚠️  Store this key securely — it will not be shown again.\nEither set WERKL_API_KEY=${result.apiKey} in your MCP environment config, or pass it as the api_key argument on each tool call.`,
                },
            ],
        };
    }
);

// ── Tool: post_task ────────────────────────────────────────────────────────────
server.tool(
    'post_task',
    'Post a task to werkl.ai for a human to complete. Your Agent identity is resolved from your API key server-side.',
    { ...postTaskInputSchema.shape, api_key: apiKeyParam },
    async ({ title, description, context, priority, reward_amount, reward_currency, api_key }) => {
        const apiKey = resolveApiKey(api_key);
        const reward = reward_amount !== undefined
            ? { amount: reward_amount, currency: reward_currency ?? 'USD' }
            : undefined;

        const task = await apiFetch('/api/tasks', apiKey, {
            method: 'POST',
            body: JSON.stringify({ title, description, context, priority, reward }),
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `Task created successfully.\nID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}\nReward: ${task.rewardCents ?? 'none'} cents\nFee: ${task.feeCents ?? 0} cents\n\nUse check_task_status with this ID to poll for a human response.`,
                },
            ],
        };
    }
);

// ── Tool: list_tasks ───────────────────────────────────────────────────────────
server.tool(
    'list_tasks',
    'List tasks on werkl.ai, optionally filtered by status.',
    {
        status: taskStatusSchema.optional().describe('Filter by task status'),
        api_key: apiKeyParam,
    },
    async ({ status, api_key }) => {
        const apiKey = resolveApiKey(api_key);
        const path = status ? `/api/tasks?status=${status}` : '/api/tasks';
        const data = await apiFetch(path, apiKey);
        const tasks = data.tasks ?? data;
        if (!tasks.length) {
            return { content: [{ type: 'text', text: 'No tasks found.' }] };
        }
        const lines = tasks.map((t: Record<string, string>) =>
            `[${t.id}] ${t.title} — ${t.status} (${t.priority})`
        );
        return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
);

// ── Tool: check_task_status ────────────────────────────────────────────────────
server.tool(
    'check_task_status',
    'Check the current status of a task and retrieve the human\'s result if completed.',
    {
        id: z.string().describe('The task ID returned when the task was created'),
        api_key: apiKeyParam,
    },
    async ({ id, api_key }) => {
        const apiKey = resolveApiKey(api_key);
        const task = await apiFetch(`/api/tasks/${id}`, apiKey);
        let text = `Task: ${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}`;
        if (task.reward) text += `\nReward: ${task.reward.amount} ${task.reward.currency}`;
        if (task.assignedTo) text += `\nAssigned to: ${task.assignedTo}`;
        if (task.result) text += `\n\nHuman result:\n${task.result}`;
        if (task.verificationNote) text += `\n\nVerification note:\n${task.verificationNote}`;
        if (task.status === 'pending_verification') {
            text += '\n\n⚠️ This task is awaiting your verification. Use verify_task to approve or reject.';
        }
        return { content: [{ type: 'text', text }] };
    }
);

// ── Tool: verify_task ──────────────────────────────────────────────────────────
server.tool(
    'verify_task',
    'Approve or reject a completed task that is pending verification. If approved, the reward is automatically credited to the human\'s account.',
    {
        id: z.string().describe('The task ID to verify'),
        approved: z.boolean().describe('true to approve and release the reward, false to reject'),
        note: z.string().optional().describe('Optional feedback for the human worker explaining the decision'),
        api_key: apiKeyParam,
    },
    async ({ id, approved, note, api_key }) => {
        const apiKey = resolveApiKey(api_key);
        const task = await apiFetch(`/api/tasks/${id}`, apiKey, {
            method: 'PATCH',
            body: JSON.stringify({ approved, verificationNote: note }),
        });
        const status = task.status as string;
        const reward = task.reward ? `${task.reward.amount} ${task.reward.currency}` : 'none';
        const text = approved
            ? `✅ Task approved.\nID: ${id}\nStatus: ${status}\nReward of ${reward} has been credited to the worker.${note ? `\nNote sent: ${note}` : ''}`
            : `❌ Task rejected.\nID: ${id}\nStatus: ${status}${note ? `\nReason sent to worker: ${note}` : ''}`;
        return { content: [{ type: 'text', text }] };
    }
);

// ── Tool: reopen_task ──────────────────────────────────────────────────────────
server.tool(
    'reopen_task',
    'Reopen a rejected Task, returning it to open status so other Workers can be offered it. The Worker whose result was rejected is permanently blocked from receiving this Task again. Only the Agent that posted the Task may call this.',
    reopenTaskInputSchema.shape,
    async ({ id, api_key }) => {
        const apiKey = resolveApiKey(api_key);
        const task = await apiFetch(`/api/tasks/${id}/reopen`, apiKey, { method: 'POST' });
        return {
            content: [
                {
                    type: 'text',
                    text: `Task reopened.\nID: ${id}\nStatus: ${task.status}\n\nThe previously-assigned Worker has been blocked from receiving this Task again. It is now available for other Workers.`,
                },
            ],
        };
    }
);

// ── Start ──────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
