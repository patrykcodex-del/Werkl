import { prisma } from './prisma';

export async function gateWorkerSignIn({
    email,
}: {
    email: string | null | undefined;
}): Promise<boolean> {
    if (!email) return false;
    const invite = await prisma.workerInvite.findUnique({ where: { email } });
    if (!invite) return false;
    if (!invite.usedAt) {
        await prisma.workerInvite.update({
            where: { email },
            data: { usedAt: new Date() },
        });
    }
    return true;
}
