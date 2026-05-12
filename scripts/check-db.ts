import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

async function main() {
    const tasks = await p.task.findMany({
        select: { id: true, title: true, status: true, assignedTo: true, claimedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
    });
    console.log('Recent tasks:\n', JSON.stringify(tasks, null, 2));

    const offers = await p.taskOffer.findMany({
        select: { id: true, taskId: true, status: true, workerId: true, offeredAt: true },
        orderBy: { offeredAt: 'desc' },
        take: 10,
    });
    console.log('\nRecent offers:\n', JSON.stringify(offers, null, 2));
}

main().finally(() => p.$disconnect());
