export const PLATFORM_FEE_BPS = 1500;
export const PLATFORM_CURRENCY = 'USD';

export function rewardAmountToCents(amount: number): number {
    return Math.round(amount * 100);
}

export function calculatePlatformFeeCents(rewardCents: number): number {
    return Math.ceil((rewardCents * PLATFORM_FEE_BPS) / 10_000);
}
