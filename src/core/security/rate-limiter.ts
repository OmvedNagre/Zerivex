export type RateLimitTier = 'AUTH' | 'SCANS' | 'API_STANDARD' | 'PUBLIC';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export const TIER_CONFIGS: Record<RateLimitTier, RateLimitConfig> = {
  AUTH: { maxRequests: 10, windowMs: 60_000 }, // 10 req/min for auth/login/token
  SCANS: { maxRequests: 20, windowMs: 60_000 }, // 20 req/min for scan launches
  API_STANDARD: { maxRequests: 120, windowMs: 60_000 }, // 120 req/min for authenticated API
  PUBLIC: { maxRequests: 60, windowMs: 60_000 }, // 60 req/min for public browsing
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
  retryAfterSeconds: number;
}

/**
 * High-Performance Sliding Window Rate Limiter (Phase 14 Production Hardening)
 */
export class SlidingWindowRateLimiter {
  private windows = new Map<string, number[]>();
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(autoSweep = true) {
    if (autoSweep && typeof setInterval !== 'undefined') {
      // Periodic sweep every 2 minutes to prune stale keys
      this.sweepInterval = setInterval(() => this.pruneStaleWindows(), 120_000);
      if (this.sweepInterval.unref) {
        this.sweepInterval.unref();
      }
    }
  }

  /**
   * Check and consume rate limit quota for a given identifier key.
   */
  public check(key: string, tierOrConfig: RateLimitTier | RateLimitConfig): RateLimitResult {
    const config: RateLimitConfig =
      typeof tierOrConfig === 'string' ? TIER_CONFIGS[tierOrConfig] : tierOrConfig;

    const now = Date.now();
    const windowStart = now - config.windowMs;

    let timestamps = this.windows.get(key);
    if (!timestamps) {
      timestamps = [];
      this.windows.set(key, timestamps);
    }

    // Filter out entries outside current sliding window
    timestamps = timestamps.filter((t) => t > windowStart);
    this.windows.set(key, timestamps);

    if (timestamps.length >= config.maxRequests) {
      const oldestInWindow = timestamps[0] || now;
      const resetInMs = Math.max(0, oldestInWindow + config.windowMs - now);
      const retryAfterSeconds = Math.ceil(resetInMs / 1000);

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetInMs,
        retryAfterSeconds,
      };
    }

    // Record this request
    timestamps.push(now);
    const remaining = Math.max(0, config.maxRequests - timestamps.length);
    const oldestInWindow = timestamps[0] || now;
    const resetInMs = Math.max(0, oldestInWindow + config.windowMs - now);

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining,
      resetInMs,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Reset rate limit state for a key or entire table (testing).
   */
  public reset(key?: string): void {
    if (key) {
      this.windows.delete(key);
    } else {
      this.windows.clear();
    }
  }

  public getTrackedKeyCount(): number {
    return this.windows.size;
  }

  public destroy(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
    this.windows.clear();
  }

  private pruneStaleWindows(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.windows.entries()) {
      const active = timestamps.filter((t) => now - t < 120_000);
      if (active.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, active);
      }
    }
  }
}

// Global default singleton instance
export const defaultRateLimiter = new SlidingWindowRateLimiter();

/**
 * Extract genuine client IP address from request headers with reverse proxy spoofing defenses.
 * Prioritizes CF-Connecting-IP, X-Real-IP, and X-Forwarded-For.
 */
export function getClientIp(headers: Headers): string {
  // 1. Cloudflare True Client IP (High Confidence)
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp && isValidIp(cfIp.trim())) {
    return cfIp.trim();
  }

  // 2. Nginx / AWS ALB X-Real-IP
  const realIp = headers.get('x-real-ip');
  if (realIp && isValidIp(realIp.trim())) {
    return realIp.trim();
  }

  // 3. X-Forwarded-For (Extract leftmost valid client IP)
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim());
    for (const candidate of ips) {
      if (isValidIp(candidate)) {
        return candidate;
      }
    }
  }

  return '127.0.0.1';
}

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:|^:[0-9a-fA-F]{1,7}|::1$/;

function isValidIp(ip: string): boolean {
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

/**
 * Payload Size Guard (Anti-DoS Defense)
 * Validates Content-Length header to reject oversized request bodies.
 */
export function validateRequestBodySize(
  headers: Headers,
  maxBytes: number = 2 * 1024 * 1024 // 2MB default max
): { valid: boolean; length: number; maxBytes: number; error?: string } {
  const clHeader = headers.get('content-length');
  if (!clHeader) {
    return { valid: true, length: 0, maxBytes };
  }

  const length = parseInt(clHeader, 10);
  if (isNaN(length) || length < 0) {
    return { valid: false, length: 0, maxBytes, error: 'Invalid Content-Length header' };
  }

  if (length > maxBytes) {
    return {
      valid: false,
      length,
      maxBytes,
      error: `Payload too large (${length} bytes). Exceeds limit of ${maxBytes} bytes.`,
    };
  }

  return { valid: true, length, maxBytes };
}
