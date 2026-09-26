import {
  CircuitBreakerState,
  WorkerJob,
  WorkerPoolMetrics,
  WorkerPoolOptions,
} from './worker-types';

export class CircuitBreakerOpenError extends Error {
  public readonly code = 'CIRCUIT_BREAKER_OPEN';
  public readonly domain: string;
  public readonly remainingCooldownMs: number;

  constructor(domain: string, remainingCooldownMs: number) {
    super(
      `Circuit breaker open for domain "${domain}". Repeated scan failures detected. Cooldown remaining: ${Math.ceil(
        remainingCooldownMs / 1000
      )}s`
    );
    this.name = 'CircuitBreakerOpenError';
    this.domain = domain;
    this.remainingCooldownMs = remainingCooldownMs;
  }
}

const DEFAULT_MAX_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes
const DEFAULT_CIRCUIT_THRESHOLD = 5; // 5 consecutive failures
const DEFAULT_CIRCUIT_COOLDOWN_MS = 60_000; // 60 seconds cooldown

/**
 * Isolated Scan Worker Pool (Phase 14 Production Hardening)
 *
 * Manages asynchronous security scan jobs with:
 * - Strict concurrency limits
 * - Per-job timeout cancellation watchdogs (AbortSignal)
 * - Domain-level circuit breakers preventing cascading network failure
 * - Graceful shutdown and liveness metrics
 */
export class WorkerPool {
  private maxConcurrency: number;
  private defaultTimeoutMs: number;
  private circuitBreakerThreshold: number;
  private circuitBreakerCooldownMs: number;

  private queue: WorkerJob[] = [];
  private activeJobs = new Map<string, WorkerJob>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();

  private completedCount = 0;
  private failedCount = 0;
  private timedOutCount = 0;
  private isShuttingDown = false;
  private startTime = Date.now();

  constructor(options: WorkerPoolOptions = {}) {
    this.maxConcurrency = options.maxConcurrency || DEFAULT_MAX_CONCURRENCY;
    this.defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_TIMEOUT_MS;
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || DEFAULT_CIRCUIT_THRESHOLD;
    this.circuitBreakerCooldownMs = options.circuitBreakerCooldownMs || DEFAULT_CIRCUIT_COOLDOWN_MS;
  }

  /**
   * Submit a new scan job to the worker pool.
   * Throws immediately if pool is shutting down or circuit breaker is open.
   */
  public async submitJob<T = any>(
    params: {
      id: string;
      targetId: string;
      organizationId: string;
      domain: string;
      priority?: number;
      timeoutMs?: number;
      execute: (signal: AbortSignal) => Promise<T>;
    }
  ): Promise<T> {
    if (this.isShuttingDown) {
      throw new Error('WorkerPool is shutting down; new jobs cannot be accepted');
    }

    const domain = params.domain.toLowerCase().trim();
    this.assertCircuitClosed(domain);

    return new Promise<T>((resolve, reject) => {
      const job: WorkerJob<T> = {
        id: params.id,
        targetId: params.targetId,
        organizationId: params.organizationId,
        domain,
        priority: params.priority ?? 0,
        status: 'QUEUED',
        queuedAt: Date.now(),
        timeoutMs: params.timeoutMs || this.defaultTimeoutMs,
        execute: params.execute,
      };

      // Wrap execution to resolve/reject caller promise
      const originalExecute = job.execute;
      job.execute = async (signal: AbortSignal) => {
        try {
          const res = await originalExecute(signal);
          resolve(res);
          return res;
        } catch (err: any) {
          reject(err);
          throw err;
        }
      };

      this.enqueue(job);
    });
  }

  /**
   * Check if circuit breaker is open for a given target domain.
   */
  public isCircuitOpen(domain: string): boolean {
    const state = this.circuitBreakers.get(domain.toLowerCase());
    if (!state || !state.isOpen) return false;

    const elapsed = Date.now() - (state.openedAt || 0);
    if (elapsed >= this.circuitBreakerCooldownMs) {
      // Cooldown expired, transition to half-open
      state.isOpen = false;
      return false;
    }
    return true;
  }

  private assertCircuitClosed(domain: string): void {
    const state = this.circuitBreakers.get(domain.toLowerCase());
    if (state && state.isOpen) {
      const elapsed = Date.now() - (state.openedAt || 0);
      const remaining = this.circuitBreakerCooldownMs - elapsed;
      if (remaining > 0) {
        throw new CircuitBreakerOpenError(domain, remaining);
      }
      // Cooldown expired, transition to half-open
      state.isOpen = false;
    }
  }

  private recordSuccess(domain: string): void {
    const key = domain.toLowerCase();
    const state = this.circuitBreakers.get(key);
    if (state) {
      state.consecutiveFailures = 0;
      state.isOpen = false;
      state.openedAt = null;
    }
  }

  private recordFailure(domain: string): void {
    const key = domain.toLowerCase();
    let state = this.circuitBreakers.get(key);
    if (!state) {
      state = {
        domain: key,
        consecutiveFailures: 0,
        lastFailureTime: Date.now(),
        isOpen: false,
        openedAt: null,
      };
      this.circuitBreakers.set(key, state);
    }

    state.consecutiveFailures += 1;
    state.lastFailureTime = Date.now();

    if (state.consecutiveFailures >= this.circuitBreakerThreshold) {
      state.isOpen = true;
      state.openedAt = Date.now();
    }
  }

  private enqueue(job: WorkerJob): void {
    this.queue.push(job);
    // Sort descending by priority (higher priority runs first)
    this.queue.sort((a, b) => b.priority - a.priority);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isShuttingDown) return;

    while (this.activeJobs.size < this.maxConcurrency && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.runJob(job);
    }
  }

  private async runJob(job: WorkerJob): Promise<void> {
    const abortController = new AbortController();
    job.abortController = abortController;
    job.status = 'RUNNING';
    job.startedAt = Date.now();
    this.activeJobs.set(job.id, job);

    let timeoutHandle: NodeJS.Timeout | null = null;
    let didTimeout = false;

    if (job.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        didTimeout = true;
        job.status = 'TIMED_OUT';
        abortController.abort();
      }, job.timeoutMs);
    }

    try {
      const result = await job.execute(abortController.signal);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      job.status = 'COMPLETED';
      job.result = result;
      job.completedAt = Date.now();
      this.completedCount += 1;
      this.recordSuccess(job.domain);
    } catch (err: any) {
      if (timeoutHandle) clearTimeout(timeoutHandle);

      job.completedAt = Date.now();
      if (didTimeout || abortController.signal.aborted) {
        job.status = 'TIMED_OUT';
        job.error = `Scan execution timed out after ${job.timeoutMs}ms`;
        this.timedOutCount += 1;
      } else {
        job.status = 'FAILED';
        job.error = err.message || 'Worker execution error';
        this.failedCount += 1;
      }

      this.recordFailure(job.domain);
    } finally {
      this.activeJobs.delete(job.id);
      this.processQueue();
    }
  }

  /**
   * Cancel an individual queued or active job.
   */
  public cancelJob(jobId: string): boolean {
    // If queued, remove directly
    const queueIndex = this.queue.findIndex((j) => j.id === jobId);
    if (queueIndex !== -1) {
      const job = this.queue.splice(queueIndex, 1)[0]!;
      job.status = 'CANCELLED';
      job.completedAt = Date.now();
      return true;
    }

    // If active, signal abort
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.status = 'CANCELLED';
      active.abortController?.abort();
      active.completedAt = Date.now();
      this.activeJobs.delete(jobId);
      this.processQueue();
      return true;
    }

    return false;
  }

  /**
   * Graceful shutdown of the worker pool.
   */
  public async drainAndStop(gracePeriodMs: number = 10_000): Promise<void> {
    this.isShuttingDown = true;

    // Clear and cancel any queued jobs
    for (const job of this.queue) {
      job.status = 'CANCELLED';
    }
    this.queue = [];

    // Wait for running jobs or terminate after gracePeriodMs
    if (this.activeJobs.size > 0) {
      const deadline = Date.now() + gracePeriodMs;
      while (this.activeJobs.size > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Abort any lingering jobs
      for (const [, job] of this.activeJobs) {
        job.abortController?.abort();
      }
      this.activeJobs.clear();
    }
  }

  /**
   * Reset worker pool state (primarily for automated testing).
   */
  public reset(): void {
    this.queue = [];
    for (const [, job] of this.activeJobs) {
      job.abortController?.abort();
    }
    this.activeJobs.clear();
    this.circuitBreakers.clear();
    this.completedCount = 0;
    this.failedCount = 0;
    this.timedOutCount = 0;
    this.isShuttingDown = false;
  }

  /**
   * Retrieve real-time operational metrics.
   */
  public getMetrics(): WorkerPoolMetrics {
    let openCount = 0;
    for (const [, state] of this.circuitBreakers) {
      if (this.isCircuitOpen(state.domain)) {
        openCount += 1;
      }
    }

    return {
      activeWorkers: this.activeJobs.size,
      maxConcurrency: this.maxConcurrency,
      queuedJobs: this.queue.length,
      completedJobs: this.completedCount,
      failedJobs: this.failedCount,
      timedOutJobs: this.timedOutCount,
      openCircuits: openCount,
      isShuttingDown: this.isShuttingDown,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  public getCircuitBreakerStatus(domain: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(domain.toLowerCase()) || null;
  }
}

// Global default singleton instance
export const defaultWorkerPool = new WorkerPool();
