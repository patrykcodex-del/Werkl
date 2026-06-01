import { NextRequest, NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { prisma } from '../../../../../lib/prisma';
import { hashMagicToken } from '../../../../../lib/agentOwnerMagicLink';

const isSecure = process.env.NODE_ENV === 'production';
const SESSION_COOKIE = isSecure
    ? '__Secure-next-auth.session-token'
    : 'next-auth.session-token';

function invalid() {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });
}

export async function GET(req: NextRequest) {
    const rawToken = req.nextUrl.searchParams.get('token');
    const agentId = req.nextUrl.searchParams.get('agentId');
    if (!rawToken || !agentId) return invalid();

    const tokenHash = hashMagicToken(rawToken);
    const row = await prisma.agentOwnerToken.findUnique({ where: { tokenHash } });
    if (!row) return invalid();
    if (row.agentId !== agentId) return invalid();
    if (row.consumedAt) return invalid();
    if (row.expiresAt.getTime() <= Date.now()) return invalid();

    await prisma.agentOwnerToken.update({
        where: { id: row.id },
        data: { consumedAt: new Date() },
    });

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required');

    const sessionToken = await encode({
        token: {
            sub: row.email,
            email: row.email,
            agentId: row.agentId,
        },
        secret,
    });

    const res = NextResponse.json({ ok: true, agentId: row.agentId });
    res.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: isSecure,
    });
    return res;
}
