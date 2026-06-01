import { prisma } from './prisma';

export async function gateWorkerSignIn({
    email,
}: {
    email: string | null | undefined;
}): Promise<boolean> {
    if (!email) return false;
    try {
        const invite = await prisma.workerInvite.findUnique({ where: { email } });
        if (!invite) return false;
        if (!invite.usedAt) {
            await prisma.workerInvite.update({
                where: { email },
                data: { usedAt: new Date() },
            });
        }
        return true;
    } catch (err) {
        // Never surface the raw error — NextAuth would echo it into the
        // redirect URL, leaking schema/ORM details. Log server-side and
        // fail closed.
        console.error('gateWorkerSignIn: Invite lookup failed', err);
        return false;
    }
}

export async function inviteWorker({
    email,
    invitedBy,
}: {
    email: string;
    invitedBy?: string;
}): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) throw new Error('email is required');
    await prisma.workerInvite.upsert({
        where: { email: normalized },
        create: { email: normalized, invitedBy },
        update: {},
    });
}
