import { createHash } from 'node:crypto';
import { query } from '@/core/db/database';
import { RateLimitResult, RateLimitTier, TIER_CONFIGS } from './rate-limiter';

/** Shared fixed-window counter for production replicas. No raw client IP is stored. */
export async function checkDistributedRateLimit(key: string, tier: RateLimitTier): Promise<RateLimitResult> {
  const config = TIER_CONFIGS[tier];
  const now = Date.now();
  const windowStart = Math.floor(now / config.windowMs) * config.windowMs;
  const resetInMs = windowStart + config.windowMs - now;
  const keyHash = createHash('sha256').update(key).digest('hex');
  const result = await query<{ requests: number }>(`INSERT INTO rate_limit_windows
    (key_hash, window_start, expires_at, requests) VALUES ($1, $2, $3, 1)
    ON CONFLICT (key_hash, window_start) DO UPDATE SET requests = rate_limit_windows.requests + 1
    WHERE rate_limit_windows.requests < $4 RETURNING requests`,
  [keyHash, new Date(windowStart), new Date(windowStart + config.windowMs), config.maxRequests]);
  const requests = result.rows[0]?.requests;
  return { allowed: requests !== undefined, limit: config.maxRequests,
    remaining: requests === undefined ? 0 : Math.max(0, config.maxRequests - requests),
    resetInMs, retryAfterSeconds: requests === undefined ? Math.ceil(resetInMs / 1000) : 0 };
}
