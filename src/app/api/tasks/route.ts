import { NextRequest, NextResponse } from 'next/server';
import { listTasks, createTask } from '../../../lib/taskStore';
import type { TaskPriority, TaskStatus } from '../../../types';

function isAuthorized(req: NextRequest): boolean {
    const key = req.headers.get('x-api-key');
    return key === process.env.WERKL_API_KEY;
}

export async function GET(req: NextRequest) {
    const status = req.nextUrl.searchParams.get('status') as TaskStatus | null;
    const tasks = await listTasks(status ?? undefined);
    return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { title, description, context, priority, reward, postedBy } = body;

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

    const task = await createTask({ title, description, context, priority: priority as TaskPriority, reward, postedBy });
    return NextResponse.json(task, { status: 201 });
}
