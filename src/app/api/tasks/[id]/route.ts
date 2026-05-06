import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask } from '../../../../lib/taskStore';
import { creditEarning } from '../../../../lib/earningsStore';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    return NextResponse.json(task);
}

export async function PATCH(req: NextRequest, { params }: Params) {
    const { id } = await params;
    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const { status, result, verificationNote, approved } = body;

    const apiKey = req.headers.get('x-api-key');
    if (apiKey && apiKey === process.env.WERKL_API_KEY) {
        if (task.status !== 'pending_verification') {
            return NextResponse.json({ error: 'Task is not awaiting verification' }, { status: 409 });
        }
        if (typeof approved !== 'boolean') {
            return NextResponse.json({ error: 'approved (boolean) is required' }, { status: 400 });
        }
        const newStatus = approved ? 'approved' : 'rejected';
        const updated = await updateTask(id, { status: newStatus, verificationNote });
        if (approved && task.reward && task.assignedTo) {
            await creditEarning(task.assignedTo, {
                taskId: task.id,
                taskTitle: task.title,
                amount: task.reward.amount,
                currency: task.reward.currency,
                earnedAt: new Date().toISOString(),
            });
        }
        return NextResponse.json(updated);
    }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as typeof session.user & { id?: string }).id ?? session.user.email!;

    if (status === 'claimed') {
        if (task.status !== 'open') {
            return NextResponse.json({ error: 'Task is no longer available' }, { status: 409 });
        }
        return NextResponse.json(await updateTask(id, { status: 'claimed', assignedTo: userId }));
    }

    if (status === 'pending_verification') {
        if (task.assignedTo !== userId) {
            return NextResponse.json({ error: 'You are not assigned to this task' }, { status: 403 });
        }
        if (!result?.trim()) {
            return NextResponse.json({ error: 'result is required' }, { status: 400 });
        }
        return NextResponse.json(await updateTask(id, { status: 'pending_verification', result }));
    }

    return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
}
