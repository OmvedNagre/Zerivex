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

    return NextResponse.json({
      success: true,
      data: {
        queue: res.rows,
        currentUserRole: staff.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.statusCode || 401 }
    );
  }
}
