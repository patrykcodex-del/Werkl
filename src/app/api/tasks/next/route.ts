import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getNextTask } from '../../../../lib/taskStore';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const task = await getNextTask();
    if (!task) {
        return NextResponse.json({ error: 'No tasks available' }, { status: 404 });
    }

    return NextResponse.json(task);
}
