import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '../../../../../lib/prisma';
import {
    generateMagicToken,
    hashMagicToken,
    magicLinkUrl,
    sendMagicLink,
    MAGIC_LINK_TTL_MS,
} from '../../../../../lib/agentOwnerMagicLink';

const bodySchema = z.object({
    agentId: z.string().min(1),
    email: z.string().email(),
});

// Neutral response — same shape whether or not the (email, agentId) match,
// to avoid leaking which Agents have an ownerEmail set.
function neutral() {
    return NextResponse.json({ ok: true }, { status: 200 });
}

export async function POST(req: NextRequest) {
    const raw = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { agentId, email } = parsed.data;

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent || !agent.ownerEmail || agent.ownerEmail.toLowerCase() !== email.toLowerCase()) {
        return neutral();
    }

    const token = generateMagicToken();
    const tokenHash = hashMagicToken(token);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS);

    await prisma.agentOwnerToken.create({
        data: { agentId: agent.id, email: agent.ownerEmail, tokenHash, expiresAt },
    });

    await sendMagicLink(agent.ownerEmail, magicLinkUrl(token, agent.id));

    return neutral();
}
