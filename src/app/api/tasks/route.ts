import { NextRequest, NextResponse } from 'next/server';
import { listTasksPaged, createTask, type ListTasksOptions, type TaskSortField, type TaskSortOrder } from '../../../lib/taskStore';
import { authenticateAgent } from '../../../lib/agentAuth';
import { checkAgentTaskPostRateLimit } from '../../../lib/agentRateLimit';
import type { TaskStatus, TaskType } from '../../../types';

export async function GET(req: NextRequest) {
    const sp = req.nextUrl.searchParams;
    const status = sp.get('status') as TaskStatus | null;
    const sort = sp.get('sort') as TaskSortField | null;
    const order = sp.get('order') as TaskSortOrder | null;
    const limit = sp.get('limit') ? parseInt(sp.get('limit')!) : 24;
    const offset = sp.get('offset') ? parseInt(sp.get('offset')!) : 0;

    const opts: ListTasksOptions = {
        ...(status ? { status } : {}),
        ...(sort ? { sort } : {}),
        ...(order ? { order } : {}),
        limit,
        offset,
    };

    const page = await listTasksPaged(opts);
    return NextResponse.json({
        tasks: page.tasks,
        total: page.total,
        hasMore: page.offset + page.tasks.length < page.total,
    });
}

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get('x-api-key') ?? '';
    const agent = await authenticateAgent(apiKey);
    if (!agent) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (agent.suspended) {
        return NextResponse.json({ error: 'Agent is suspended' }, { status: 403 });
    }

    const rateLimit = await checkAgentTaskPostRateLimit(agent.id);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            { error: 'Rate limit exceeded' },
            { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
        );
    }

    const body = await req.json();
    const {
        title, description, context, taskType, reward,
        estimatedMins, claimTimeoutMins, completionMins, expiresAt, autoReassign,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        priority: _priority, // accepted for API compatibility but intentionally ignored —
                             // priority is platform-computed from reward and deadline urgency
    } = body;

    if (!title || !description) {
        return NextResponse.json(
            { error: 'title and description are required' },
            { status: 400 }
        );
    }

    if (reward && (typeof reward.amount !== 'number' || !reward.currency)) {
        return NextResponse.json(
            { error: 'reward must have a numeric amount and a currency string' },
            { status: 400 }
        );
    }

    if (estimatedMins !== undefined && (typeof estimatedMins !== 'number' || estimatedMins <= 0)) {
        return NextResponse.json({ error: 'estimatedMins must be a positive number' }, { status: 400 });
    }

    if (completionMins !== undefined && (typeof completionMins !== 'number' || completionMins <= 0)) {
        return NextResponse.json({ error: 'completionMins must be a positive number' }, { status: 400 });
    }

    if (expiresAt !== undefined && isNaN(Date.parse(expiresAt))) {
        return NextResponse.json({ error: 'expiresAt must be a valid ISO date string' }, { status: 400 });
    }

    const task = await createTask({
        title, description, context,
        taskType: (taskType ?? 'async') as TaskType,
        reward,
        estimatedMins,
        claimTimeoutMins: claimTimeoutMins ?? 5,
        completionMins,
        expiresAt,
        autoReassign: autoReassign ?? true,
        postedBy: agent.id,
    });
    return NextResponse.json(task, { status: 201 });
}

