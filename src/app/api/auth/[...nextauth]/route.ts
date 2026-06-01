import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import DiscordProvider from 'next-auth/providers/discord';
import TwitterProvider from 'next-auth/providers/twitter';
import AzureADProvider from 'next-auth/providers/azure-ad';
import AppleProvider from 'next-auth/providers/apple';
import LinkedInProvider from 'next-auth/providers/linkedin';
import type { NextAuthOptions } from 'next-auth';
import { gateWorkerSignIn } from '../../../../lib/workerInvite';

function buildProviders(): NextAuthOptions['providers'] {
    const providers: NextAuthOptions['providers'] = [];

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        providers.push(
            GoogleProvider({
                clientId: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            }),
        );
    }

    if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
        providers.push(
            GitHubProvider({
                clientId: process.env.GITHUB_ID,
                clientSecret: process.env.GITHUB_SECRET,
            }),
        );
    }

    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
        providers.push(
            DiscordProvider({
                clientId: process.env.DISCORD_CLIENT_ID,
                clientSecret: process.env.DISCORD_CLIENT_SECRET,
            }),
        );
    }

    if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
        providers.push(
            TwitterProvider({
                clientId: process.env.TWITTER_CLIENT_ID,
                clientSecret: process.env.TWITTER_CLIENT_SECRET,
                version: '2.0',
            }),
        );
    }

    if (
        process.env.AZURE_AD_CLIENT_ID &&
        process.env.AZURE_AD_CLIENT_SECRET &&
        process.env.AZURE_AD_TENANT_ID
    ) {
        providers.push(
            AzureADProvider({
                clientId: process.env.AZURE_AD_CLIENT_ID,
                clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
                tenantId: process.env.AZURE_AD_TENANT_ID,
            }),
        );
    }

    if (
        process.env.APPLE_ID &&
        process.env.APPLE_TEAM_ID &&
        process.env.APPLE_PRIVATE_KEY &&
        process.env.APPLE_KEY_ID
    ) {
        providers.push(
            AppleProvider({
                clientId: process.env.APPLE_ID,
                clientSecret: process.env.APPLE_SECRET ?? '',
            }),
        );
    }

    if (process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
        providers.push(
            LinkedInProvider({
                clientId: process.env.LINKEDIN_CLIENT_ID,
                clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
            }),
        );
    }

    return providers;
}

export const authOptions: NextAuthOptions = {
    providers: buildProviders(),
    pages: {
        signIn: '/auth/signin',
        error: '/auth/signin',
    },
    callbacks: {
        async signIn({ user }) {
            return gateWorkerSignIn({ email: user?.email });
        },
        async session({ session, token }) {
            try {
                if (session.user && token.sub) {
                    (session.user as typeof session.user & { id: string }).id = token.sub;
                }
                if (session.user && typeof (token as any).agentId === 'string') {
                    (session.user as typeof session.user & { agentId: string }).agentId =
                        (token as any).agentId;
                }
            } catch {
                // swallow – fall back to an anonymous session
                return { ...session, user: undefined, expires: session.expires };
            }
            return session;
        },
    },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
