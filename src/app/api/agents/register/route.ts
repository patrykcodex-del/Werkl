import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../lib/prisma';
import { generateApiKey, hashApiKey } from '../../../../lib/agentAuth';

const registerBodySchema = z.object({
    name: z.string().min(1, 'name is required').transform((s: string) => s.trim()),
    callbackUrl: z.string().url('callbackUrl must be a valid URL').optional(),
});

export async function POST(req: NextRequest) {
    const raw = await req.json().catch(() => null);
    const parsed = registerBodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request body';
        return NextResponse.json({ error: message }, { status: 400 });
    }
    const { name, callbackUrl } = parsed.data;

    const existing = await prisma.agent.findFirst({ where: { name } });
    if (existing) {
        return NextResponse.json(
            { error: `Agent name "${name}" is already registered` },
            { status: 409 }
        );
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const agent = await prisma.agent.create({
        data: {
            name,
            apiKeyHash,
            callbackUrl: callbackUrl ?? null,
        },
    });

    return NextResponse.json({ agentId: agent.id, apiKey }, { status: 201 });
}
