import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getActiveTasksForWorker } from '../../../../lib/sessionStore';

function getUserId(session: Awaited<ReturnType<typeof getServerSession>>): string | null {
    const user = (session as { user?: { id?: string; email?: string | null } } | null)?.user;
    return user?.id ?? user?.email ?? null;
}

export async function GET() {
    const session = await getServerSession(authOptions);
    const workerId = getUserId(session);
    if (!workerId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const tasks = await getActiveTasksForWorker(workerId);
    return NextResponse.json({ tasks });
}