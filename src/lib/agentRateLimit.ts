import { prisma } from './prisma';

export type RateLimitResult =
    | { allowed: true }
    | { allowed: false; retryAfterSec: number };

const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_LIMIT = 60;

function getLimit(): number {
    const raw = process.env.AGENT_TASK_POST_LIMIT_PER_HOUR;
    if (!raw) return DEFAULT_LIMIT;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_LIMIT;
}

export async function checkAgentTaskPostRateLimit(agentId: string): Promise<RateLimitResult> {
    const limit = getLimit();
    const now = Date.now();
    const windowStart = new Date(now - WINDOW_MS);

    const count = await prisma.task.count({
        where: { postedBy: agentId, createdAt: { gte: windowStart } },
    });

    if (count < limit) return { allowed: true };

    const oldest = await prisma.task.findFirst({
        where: { postedBy: agentId, createdAt: { gte: windowStart } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
    });

    const resetAtMs = (oldest?.createdAt.getTime() ?? now) + WINDOW_MS;
    const retryAfterSec = Math.max(1, Math.ceil((resetAtMs - now) / 1000));
    return { allowed: false, retryAfterSec };
}
