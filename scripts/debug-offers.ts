import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
    const offeredTasks = await (prisma as any).task.findMany({ where: { status: 'offered' } });
    console.log('Offered tasks:', JSON.stringify(offeredTasks.map((t: any) => ({ id: t.id, assignedTo: t.assignedTo })), null, 2));

    const allPending = await (prisma as any).taskOffer.findMany({ where: { status: 'pending' } });
    console.log('All pending offers:', JSON.stringify(allPending.map((o: any) => ({
        id: o.id, taskId: o.taskId, expiresAt: o.expiresAt, expired: o.expiresAt < new Date(),
    })), null, 2));

    // Fix any stuck tasks whose pending offers have all expired
    for (const task of offeredTasks) {
        const liveOffer = await (prisma as any).taskOffer.findFirst({
            where: { taskId: task.id, status: 'pending', expiresAt: { gt: new Date() } },
        });
        if (!liveOffer) {
            await (prisma as any).taskOffer.updateMany({ where: { taskId: task.id, status: 'pending' }, data: { status: 'expired' } });
            await (prisma as any).task.update({ where: { id: task.id }, data: { status: 'open', assignedTo: null } });
            console.log('Fixed stuck task:', task.id);
        }
    }

    const workerStats = await (prisma as any).workerStat.findMany({ take: 5 });
    console.log('WorkerStats:', JSON.stringify(workerStats.map((s: any) => ({
        userId: s.userId,
        currentCooldownUntil: s.currentCooldownUntil,
        isCoolingDown: s.currentCooldownUntil && s.currentCooldownUntil > new Date(),
    })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
