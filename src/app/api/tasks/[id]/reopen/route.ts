import { NextRequest, NextResponse } from 'next/server';
import { getTask, updateTask } from '../../../../../lib/taskStore';
import { prisma } from '../../../../../lib/prisma';
import { authenticateAgentFromRequest } from '../../../../../lib/agentAuth';

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
    const { id } = await params;

    const authResult = await authenticateAgentFromRequest(req.headers);
    if (!authResult.success) {
        return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const task = await getTask(id);
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const { agent } = authResult;
    if (agent.id !== task.postedBy) {
        return NextResponse.json(
            { error: 'Forbidden: only the posting Agent may reopen this Task' },
            { status: 403 }
        );
    }

    if (task.status !== 'rejected') {
        return NextResponse.json(
            { error: 'Task is not in rejected status' },
            { status: 409 }
        );
    }

    if (task.assignedTo) {
        await prisma.taskWorkerBlock.create({
            data: { taskId: task.id, workerId: task.assignedTo },
        });
    }

    const updated = await updateTask(id, { status: 'open', assignedTo: null });
    return NextResponse.json(updated);
}
