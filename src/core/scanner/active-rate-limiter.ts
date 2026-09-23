/**
 * Zerivex Active Scanner Rate Limiter & Circuit Breaker
 * Protects customer infrastructure by throttling active probe request rates
 * and halting intrusive testing immediately if consecutive 5xx or connection
 * failures exceed safety thresholds.
 */

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly hostname: string, public readonly failureCount: number) {
    super(
      `[ZERIVEX CIRCUIT BREAKER] Circuit breaker tripped for host "${hostname}" after ${failureCount} consecutive failures. Active scanning halted to protect server stability.`
    );
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface RateLimiterOptions {
  /** Maximum requests per second per target host. Default: 5 */
  requestsPerSecond?: number;
  /** Maximum bucket burst capacity. Default: 5 */
  burstCapacity?: number;
}

export interface CircuitBreakerOptions {
  /** Consecutive failures before tripping the circuit breaker. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds before allowing a trial probe when OPEN. Default: 30000ms */
  cooldownMs?: number;
}

interface BucketState {
  tokens: number;
  lastRefillTime: number;
}

interface CircuitState {
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  lastFailureTime: number;
  lastStateChange: number;
}

export class ActiveRateLimiter {
  private buckets = new Map<string, BucketState>();
  private readonly rps: number;
  private readonly burst: number;

  constructor(options: RateLimiterOptions = {}) {
    this.rps = options.requestsPerSecond ?? 5;
    this.burst = options.burstCapacity ?? 5;
  }

  /**
   * Acquire a rate limit slot for a hostname.
   * Asynchronously sleeps if tokens are exhausted until next token is available.
   */
  async acquire(hostname: string): Promise<void> {
    const now = Date.now();
    let state = this.buckets.get(hostname);

    if (!state) {
      state = { tokens: this.burst, lastRefillTime: now };
      this.buckets.set(hostname, state);
    } else {
      // Refill tokens based on elapsed time
      const elapsedMs = now - state.lastRefillTime;
      const tokensToAdd = (elapsedMs / 1000) * this.rps;
      state.tokens = Math.min(this.burst, state.tokens + tokensToAdd);
      state.lastRefillTime = now;
    }

    if (state.tokens >= 1) {
      state.tokens -= 1;
      return;
    }

    // Calculate required wait time for 1 token
    const deficit = 1 - state.tokens;
    const waitMs = Math.ceil((deficit / this.rps) * 1000);
    state.tokens = 0;
    state.lastRefillTime = now + waitMs;

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async acquireToken(hostname: string): Promise<void> {
    return this.acquire(hostname);
  }

  /**
   * Reset rate limiter state for a hostname (useful in testing).
   */
  reset(hostname?: string): void {
    if (hostname) {
      this.buckets.delete(hostname);
    } else {
      this.buckets.clear();
    }
  }
}

export class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();
  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.threshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30000;
  }

  private getState(hostname: string): CircuitState {
    let state = this.circuits.get(hostname);
    if (!state) {
      state = {
        status: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        lastStateChange: Date.now(),
      };
      this.circuits.set(hostname, state);
    }
    return state;
  }

  /**
   * Check if circuit is currently open (blocking requests).
   */
  isOpen(hostname: string): boolean {
    const state = this.getState(hostname);
    if (state.status === 'OPEN') {
      const now = Date.now();
      if (now - state.lastStateChange >= this.cooldownMs) {
        // Cooldown passed: attempt trial request in HALF_OPEN
        state.status = 'HALF_OPEN';
        state.lastStateChange = now;
        return false;
      }
      return true;
    }
    return false;
  }

  /**
   * Record a successful response. Resets consecutive failure counter.
   */
  recordSuccess(hostname: string): void {
    const state = this.getState(hostname);
    state.consecutiveFailures = 0;
    state.status = 'CLOSED';
    state.lastStateChange = Date.now();
  }

  /**
   * Record an error or 5xx server failure. Trips circuit if threshold reached.
   */
  recordFailure(hostname: string): void {
    const state = this.getState(hostname);
    state.consecutiveFailures += 1;
    state.lastFailureTime = Date.now();

    if (state.consecutiveFailures >= this.threshold) {
      state.status = 'OPEN';
      state.lastStateChange = Date.now();
      throw new CircuitBreakerOpenError(hostname, state.consecutiveFailures);
    }
  }

  /**
   * Get consecutive failure count for a hostname.
   */
  getFailureCount(hostname: string): number {
    return this.getState(hostname).consecutiveFailures;
  }

  /**
   * Reset circuit state.
   */
  reset(hostname?: string): void {
    if (hostname) {
      this.circuits.delete(hostname);
    } else {
      this.circuits.clear();
    }
  }
}

// Global default instances for active scanning
export const defaultRateLimiter = new ActiveRateLimiter({ requestsPerSecond: 5, burstCapacity: 5 });
export const defaultCircuitBreaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 30000 });
export const activeRateLimiter = defaultRateLimiter;
export const circuitBreaker = defaultCircuitBreaker;
