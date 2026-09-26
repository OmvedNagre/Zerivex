/**
 * Worker Pool Domain Types & Interfaces (Phase 14 Production Hardening)
 */

export type WorkerJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface WorkerJob<T = any> {
  id: string;
  targetId: string;
  organizationId: string;
  domain: string;
  priority: number; // Higher number = higher priority
  status: WorkerJobStatus;
  queuedAt: number;
  startedAt?: number;
  completedAt?: number;
  timeoutMs: number;
  execute: (signal: AbortSignal) => Promise<T>;
  abortController?: AbortController;
  result?: T;
  error?: string;
}

export interface WorkerPoolOptions {
  maxConcurrency?: number;
  defaultTimeoutMs?: number;
  circuitBreakerThreshold?: number;
  circuitBreakerCooldownMs?: number;
  autoStart?: boolean;
}

export interface CircuitBreakerState {
  domain: string;
  consecutiveFailures: number;
  lastFailureTime: number;
  isOpen: boolean;
  openedAt: number | null;
}

export interface WorkerPoolMetrics {
  activeWorkers: number;
  maxConcurrency: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  timedOutJobs: number;
  openCircuits: number;
  isShuttingDown: boolean;
  uptimeSeconds: number;
}
