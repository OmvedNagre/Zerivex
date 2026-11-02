import { query } from '@/core/db/database';
export async function getWorkerHealth() {
  const workers = await query<{ id: string; heartbeatAt: Date; lastDispatchAt: Date | null; lastErrorAt: Date | null; stopping: boolean; online: boolean }>(`SELECT id, heartbeat_at AS "heartbeatAt", last_dispatch_at AS "lastDispatchAt", last_error_at AS "lastErrorAt", stopping, (heartbeat_at > NOW()-INTERVAL '45 seconds' AND NOT stopping) AS online FROM worker_instances WHERE heartbeat_at>NOW()-INTERVAL '24 hours' ORDER BY heartbeat_at DESC LIMIT 20`);
  const queue = await query<{ overdue: number; oldestQueuedAt: Date | null }>(`SELECT COUNT(*) FILTER (WHERE created_at<NOW()-INTERVAL '2 minutes')::int AS overdue, MIN(created_at) AS "oldestQueuedAt" FROM scan_jobs WHERE status='QUEUED'`);
  return { online: workers.rows.some(w => w.online), workers: workers.rows, ...queue.rows[0], checkedAt: new Date().toISOString() };
}
