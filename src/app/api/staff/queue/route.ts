import { getWorkerHealth } from '@/core/scanner/worker-health';
import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';

export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'VIEW_QUEUE');

    const res = await query<{
      id: string;
      orgName: string;
      hostname: string;
      scanMode: string;
      status: string;
      score: number | null;
      workerId: string | null;
      errorMessage: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
      createdAt: Date;
    }>(
      `
      SELECT
        sj.id,
        o.name as "orgName",
        t.hostname,
        sj.scan_mode as "scanMode",
        sj.status,
        sj.score,
        sj.worker_id as "workerId",
        sj.error_message as "errorMessage",
        sj.started_at as "startedAt",
        sj.completed_at as "completedAt",
        sj.created_at as "createdAt"
      FROM scan_jobs sj
      JOIN organizations o ON sj.organization_id = o.id
      JOIN targets t ON sj.target_id = t.id
      WHERE sj.status IN ('QUEUED', 'RUNNING', 'FAILED')
      ORDER BY sj.created_at DESC
      LIMIT 100
      `
    );

    const totals = await query<{ scansLast24h: number; queueDepth: number; failedScans: number }>(`
      SELECT COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int AS "scansLast24h",
        COUNT(*) FILTER (WHERE status IN ('QUEUED', 'RUNNING'))::int AS "queueDepth",
        COUNT(*) FILTER (WHERE status = 'FAILED' AND created_at >= NOW() - INTERVAL '24 hours')::int AS "failedScans"
      FROM scan_jobs`);

    return NextResponse.json({
      success: true,
      data: {
        workerHealth: await getWorkerHealth(),
        queue: res.rows,
        stats: totals.rows[0],
        currentUserRole: staff.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.statusCode ? err.message : 'Unable to load queue records' },
      { status: err.statusCode || 500 }
    );
  }
}
