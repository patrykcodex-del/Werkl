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
 *         "WERKL_API_KEY": "<your key>"
 *       }
 *     }
 *   }
 * }
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { taskStatusSchema } from './schemas.js';

const API_URL = process.env.WERKL_API_URL ?? 'http://localhost:3000';
const API_KEY = process.env.WERKL_API_KEY ?? '';

async function apiFetch(path: string, options?: RequestInit) {
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': API_KEY,
            ...(options?.headers ?? {}),
        },
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

// ── Tool: post_task ────────────────────────────────────────────────────────────
server.tool(
    'post_task',
    'Post a task to werkl.ai for a human to complete. Use this when you need a human to perform an action you cannot do yourself.',
    {
        title: z.string().describe('Short, clear title for the task'),
        description: z.string().describe('Full description of what the human needs to do'),
        context: z.string().optional().describe('Any additional data or context the human will need (URLs, raw text, etc.)'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium').describe('How urgently this task needs to be done'),
        reward_amount: z.number().optional().describe('How much to pay the human for completing this task (e.g. 5.00)'),
        reward_currency: z.string().optional().default('USD').describe('Currency code for the reward (e.g. USD, EUR, GBP)'),
    },
    async ({ title, description, context, priority, reward_amount, reward_currency }) => {
        const reward = reward_amount !== undefined
            ? { amount: reward_amount, currency: reward_currency ?? 'USD' }
            : undefined;

        const task = await apiFetch('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({
                title,
                description,
                context,
                priority,
                reward,
                postedBy: 'mcp-agent',
            }),
        });
        return {
            content: [
                {
                    type: 'text',
                    text: `Task created successfully.\nID: ${task.id}\nTitle: ${task.title}\nStatus: ${task.status}\nReward: ${reward ? `${reward.amount} ${reward.currency}` : 'none'}\n\nUse check_task_status with this ID to poll for a human response.`,
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
    },
    async ({ status }) => {
        const path = status ? `/api/tasks?status=${status}` : '/api/tasks';
        const tasks = await apiFetch(path);
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
    },
    async ({ id }) => {
        const task = await apiFetch(`/api/tasks/${id}`);
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
    },
    async ({ id, approved, note }) => {
        const task = await apiFetch(`/api/tasks/${id}`, {
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

// ── Start ──────────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
