import { setTimeout as pause } from 'node:timers/promises';

try { process.loadEnvFile('.env.local'); } catch { /* deployment environment may supply variables */ }

async function main() {
  const { query, closeDbPool } = await import('../src/core/db/database');
  const { executeScanJob, SCAN_WORKER_ID } = await import('../src/core/scanner/scan-runner');
  const { dispatchDueSchedules } = await import('../src/core/scheduler/scheduler-service');
  const { defaultWorkerPool } = await import('../src/core/scanner/worker-pool');
  const { validateProductionReadiness } = await import('../src/core/config/env-validator');
  validateProductionReadiness();
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; });
  process.on('SIGINT', () => { stopping = true; });
  const workerId = SCAN_WORKER_ID;
  const heartbeat = setInterval(() => {
    query("UPDATE scan_jobs SET heartbeat_at = NOW() WHERE worker_id = $1 AND status = 'RUNNING'", [workerId])
      .catch(() => console.error('[WORKER] Heartbeat failed'));
  }, 10_000);
  try {
    while (!stopping) {
      try {
        // Do not silently rerun potentially intrusive work after a process crash.
        await query(`UPDATE scan_jobs SET status = 'FAILED', score = NULL, completed_at = NOW(),
          error_message = 'Worker heartbeat expired; scan coverage is incomplete'
          WHERE status = 'RUNNING' AND COALESCE(heartbeat_at, started_at) < NOW() - INTERVAL '6 minutes'`);
        await query('DELETE FROM rate_limit_windows WHERE expires_at < NOW()');
        const capacity = defaultWorkerPool.getMetrics().maxConcurrency;
        await dispatchDueSchedules(capacity);
        const queued = await query<{ id: string }>(
          "SELECT id FROM scan_jobs WHERE status = 'QUEUED' ORDER BY created_at LIMIT $1", [capacity]);
        await Promise.allSettled(queued.rows.map((job) => executeScanJob(job.id)));
      } catch {
        console.error('[WORKER] Dispatch failed; retrying shortly');
      }
      if (!stopping) await pause(1000);
    }
  } finally {
    clearInterval(heartbeat);
    await defaultWorkerPool.drainAndStop();
    await closeDbPool();
  }
}

main().catch(() => { console.error('[WORKER] Startup failed'); process.exitCode = 1; });
