import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { generateWebhookSecret, encryptWebhookSecret } from '../../../../../lib/webhookAuth';
import { authenticateOperatorFromRequest } from '../../../../../lib/operatorAuth';

type Params = { params: Promise<{ agentId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
    const auth = await authenticateOperatorFromRequest(req.headers);
    if (!auth.success) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { agentId } = await params;
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
        return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const webhookSecret = generateWebhookSecret();
    const webhookSecretEncrypted = encryptWebhookSecret(webhookSecret);
    await prisma.agent.update({
        where: { id: agentId },
        data: { webhookSecretEncrypted },
    });

    return NextResponse.json({ agentId, webhookSecret }, { status: 200 });
}
