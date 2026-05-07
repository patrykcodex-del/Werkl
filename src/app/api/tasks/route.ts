import { NextRequest, NextResponse } from 'next/server';
import { listTasksPaged, createTask, type ListTasksOptions, type TaskSortField, type TaskSortOrder } from '../../../lib/taskStore';
import type { TaskStatus, TaskType } from '../../../types';

function isAuthorized(req: NextRequest): boolean {
    const key = req.headers.get('x-api-key');
    return key === process.env.WERKL_API_KEY;
}

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
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
        title, description, context, taskType, reward, postedBy,
        estimatedMins, claimTimeoutMins, completionMins, expiresAt, autoReassign,
    } = body;

    if (!title || !description || !postedBy) {
        return NextResponse.json(
            { error: 'title, description and postedBy are required' },
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
        postedBy,
    });
    return NextResponse.json(task, { status: 201 });
}

