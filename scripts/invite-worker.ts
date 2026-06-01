import { prisma } from '../src/lib/prisma';
import { inviteWorker } from '../src/lib/workerInvite';

const BANNER = `
\x1b[38;5;208m   _      __        __ __
  | | /| / /__ ____/ //_/ /
  | |/ |/ / -_) __/ ,< / /__
  |__/|__/\\__/_/ /_/|_/____/
\x1b[2m  ─── operator console ───\x1b[0m
`;

const [, , emailArg, invitedByArg] = process.argv;

console.log(BANNER);

if (!emailArg) {
    console.error('Usage: npm run admin:invite-worker <email> [invitedBy]');
    process.exit(1);
}

async function main() {
    await inviteWorker({ email: emailArg, invitedBy: invitedByArg });
    console.log(`\x1b[32m✓\x1b[0m Invited \x1b[1m${emailArg.trim().toLowerCase()}\x1b[0m`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
