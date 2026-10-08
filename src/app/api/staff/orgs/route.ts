import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';

export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'VIEW_ORGS');

    const res = await query<{
      id: string;
      name: string;
      slug: string;
      isInternal: boolean;
      suspendedAt: Date | null;
      suspendedReason: string | null;
      createdAt: Date;
      memberCount: string;
      targetCount: string;
      scanCount: string;
    }>(
      `
      SELECT
        o.id,
        o.name,
        o.slug,
        o.is_internal as "isInternal",
        o.suspended_at as "suspendedAt",
        o.suspended_reason as "suspendedReason",
        o.created_at as "createdAt",
        COUNT(DISTINCT m.user_id)::text as "memberCount",
        COUNT(DISTINCT t.id)::text as "targetCount",
        COUNT(DISTINCT sj.id)::text as "scanCount"
      FROM organizations o
      LEFT JOIN memberships m ON o.id = m.organization_id
      LEFT JOIN targets t ON o.id = t.organization_id
      LEFT JOIN scan_jobs sj ON o.id = sj.organization_id
      GROUP BY o.id, o.name, o.slug, o.is_internal, o.suspended_at, o.suspended_reason, o.created_at
      ORDER BY o.created_at DESC
      `
    );

    const organizations = res.rows.map((row) => ({
      ...row,
      memberCount: parseInt(row.memberCount, 10) || 0,
      targetCount: parseInt(row.targetCount, 10) || 0,
      scanCount: parseInt(row.scanCount, 10) || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        organizations,
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
