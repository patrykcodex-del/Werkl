/** How often the public feed polls for new tasks (ms) */
export const POLL_MS = 5_000;
/** Max rows shown in the public feed */
export const FEED_LIMIT = 20;

export const POLL_INTERVAL_MS      = 3_000;
export const HEARTBEAT_INTERVAL_MS = 20_000;
export const STREAM_POLL_MS        = 4_000;
export const STREAM_MAX            = 10;
export const CONCURRENCY_LIMIT     = 3;
/** How long (ms) a "gone" task lingers with a fade-out before being removed */
export const GONE_LINGER_MS        = 2_200;
export const RELEASE_GRACE_SECS    = 30;
export const OFFER_TTL             = 30;
