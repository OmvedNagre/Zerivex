import { query } from '@/core/db/database';
import { defaultWorkerPool } from '@/core/scanner/worker-pool';
import { WorkerPoolMetrics } from '@/core/scanner/worker-types';

export interface DatabaseHealth {
  status: 'CONNECTED' | 'ERROR';
  latencyMs?: number;
  error?: string;
}

export interface MemoryHealth {
  rssMb: number;
  heapUsedMb: number;
  heapTotalMb: number;
}

export interface SystemHealthReport {
  status: 'UP' | 'DEGRADED' | 'DOWN';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  database: DatabaseHealth;
  memory: MemoryHealth;
  workers: WorkerPoolMetrics;
}

/**
 * Diagnostic Service checking core subsystems health (Phase 14)
 */
export async function getSystemHealthReport(): Promise<SystemHealthReport> {
  const timestamp = new Date().toISOString();
  const uptimeSeconds = Math.floor(process.uptime ? process.uptime() : 0);
  const mem = process.memoryUsage ? process.memoryUsage() : { rss: 0, heapUsed: 0, heapTotal: 0 };

  const memory: MemoryHealth = {
    rssMb: Math.round((mem.rss / (1024 * 1024)) * 100) / 100,
    heapUsedMb: Math.round((mem.heapUsed / (1024 * 1024)) * 100) / 100,
    heapTotalMb: Math.round((mem.heapTotal / (1024 * 1024)) * 100) / 100,
  };

  const workers = defaultWorkerPool.getMetrics();

  // Test Database Connection with timing
  let database: DatabaseHealth;
  const dbStart = Date.now();
  try {
    await query('SELECT 1');
    const latencyMs = Date.now() - dbStart;
    database = {
      status: 'CONNECTED',
      latencyMs,
    };
  } catch (err: any) {
    database = {
      status: 'ERROR',
      error: err.message || 'Database ping failed',
    };
  }

  // Determine overall status
  let status: 'UP' | 'DEGRADED' | 'DOWN' = 'UP';
  if (database.status === 'ERROR') {
    status = 'DOWN';
  } else if (workers.openCircuits > 0 || (database.latencyMs && database.latencyMs > 1000)) {
    status = 'DEGRADED';
  }

  return {
    status,
    timestamp,
    uptimeSeconds,
    version: '0.1.0',
    environment: process.env.NODE_ENV || 'development',
    database,
    memory,
    workers,
  };
}

/**
 * Lightweight readiness probe verifying that the application is ready to accept traffic.
 */
export async function checkReadiness(): Promise<{ ready: boolean; reason?: string }> {
  try {
    await query('SELECT 1');
    const workers = defaultWorkerPool.getMetrics();
    if (workers.isShuttingDown) {
      return { ready: false, reason: 'Worker pool is shutting down' };
    }
    return { ready: true };
  } catch (err: any) {
    return { ready: false, reason: `Database connection unavailable: ${err.message}` };
  }
}
