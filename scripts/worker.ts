import { createServer } from 'node:http';
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
  const { dispatchInvitationMail } = await import('../src/core/mail/invitation-outbox');
  await query('INSERT INTO worker_instances (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET started_at=NOW(),heartbeat_at=NOW(),stopping=false', [workerId]);
  const healthServer = process.env.WORKER_HEALTH_PORT ? createServer((req,res) => {
    res.statusCode = req.url === '/health' && !stopping ? 200 : 503;
    res.end(stopping ? 'stopping' : 'running');
  }).listen(Number(process.env.WORKER_HEALTH_PORT), '0.0.0.0') : null;
  let heartbeating = false;
  let mailing = false;
  const mailTimer = setInterval(async () => {
    if (mailing || stopping) return;
    mailing = true;
    try { await dispatchInvitationMail(); } catch { console.error('[WORKER] Invitation dispatcher failed'); } finally { mailing = false; }
  }, 3000);
  const heartbeat = setInterval(async () => {
    if (heartbeating) return;
    heartbeating = true;
    try {
    await query( "UPDATE scan_jobs SET heartbeat_at = NOW() WHERE worker_id = $1 AND status = 'RUNNING'", [workerId])
    ;
    await query('UPDATE worker_instances SET heartbeat_at=NOW() WHERE id=$1', [workerId]);
    } catch { console.error('[WORKER] Heartbeat failed'); } finally { heartbeating = false; }
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
        await query('UPDATE worker_instances SET last_dispatch_at=NOW() WHERE id=$1',[workerId]);
      } catch {
        console.error('[WORKER] Dispatch failed; retrying shortly');
        await query('UPDATE worker_instances SET last_error_at=NOW() WHERE id=$1',[workerId]).catch(() => {});
      }
      if (process.argv.includes('--once')) break;
      if (!stopping) await pause(1000);
    }
  } finally {
    clearInterval(heartbeat);
    clearInterval(mailTimer);
    while (mailing || heartbeating) await pause(100);
    healthServer?.close();
    await query('UPDATE worker_instances SET stopping=true WHERE id=$1',[workerId]).catch(() => {});
    await defaultWorkerPool.drainAndStop();
    await closeDbPool();
  }
}

main().catch(() => { console.error('[WORKER] Startup failed'); process.exitCode = 1; });
