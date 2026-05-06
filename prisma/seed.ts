import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('🌱 Seeding database...');

    // Upsert demo tasks so seed is idempotent
    await prisma.task.upsert({
        where: { id: 'demo-1' },
        update: {},
        create: {
            id: 'demo-1',
            title: 'Transcribe a 2-minute audio clip',
            description:
                'An AI agent recorded a voice memo but cannot reliably transcribe it. Please listen and provide an accurate transcription.',
            context: 'Audio URL: https://example.com/audio/demo-clip.mp3',
            status: 'open',
            priority: 'medium',
            rewardAmount: 5,
            rewardCurrency: 'USD',
            postedBy: 'demo-agent',
        },
    });

    await prisma.task.upsert({
        where: { id: 'demo-2' },
        update: {},
        create: {
            id: 'demo-2',
            title: 'Verify contact details for a business',
            description:
                'Please check the current phone number and opening hours for "The Corner Bakery, Portland OR" and return the details.',
            status: 'open',
            priority: 'low',
            rewardAmount: 2.5,
            rewardCurrency: 'USD',
            postedBy: 'demo-agent',
        },
    });

    await prisma.task.upsert({
        where: { id: 'demo-3' },
        update: {},
        create: {
            id: 'demo-3',
            title: 'Review and rate product descriptions',
            description:
                'An AI drafted product descriptions for 5 items. Please review them for tone, accuracy, and clarity, and rate each out of 10.',
            status: 'open',
            priority: 'high',
            rewardAmount: 10,
            rewardCurrency: 'USD',
            postedBy: 'demo-agent',
        },
    });

    const count = await prisma.task.count();
    console.log(`✅ Seed complete — ${count} tasks in database.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
