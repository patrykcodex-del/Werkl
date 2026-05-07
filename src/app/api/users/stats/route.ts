import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '../../../../lib/prisma';

/**
 * GET /api/users/stats
 * Returns the current user's worker reliability stats.
 */
export async function GET(_req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = (session.user as { id?: string; email?: string | null }).id ?? session.user.email!;

    const stat = await prisma.workerStat.findUnique({ where: { userId } });
    if (!stat) {
        return NextResponse.json({
            userId,
            totalClaimed: 0,
            totalCompleted: 0,
            totalApproved: 0,
            totalRejected: 0,
            totalExpired: 0,
            avgCompletionSecs: null,
            reliabilityScore: 1.0,
        });
    }
    return NextResponse.json(stat);
}
