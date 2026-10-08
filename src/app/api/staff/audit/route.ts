import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';

export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);
    const { searchParams } = new URL(req.url);

    const action = searchParams.get('action');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    let sql = `
      SELECT
        al.id,
        al.actor_user_id as "actorUserId",
        u.email as "actorEmail",
        al.actor_type as "actorType",
        al.action,
        al.resource_type as "resourceType",
        al.resource_id as "resourceId",
        al.reason,
        al.ip_address as "ipAddress",
        al.user_agent as "userAgent",
        al.metadata_json as "metadata",
        al.created_at as "createdAt"
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.id
      WHERE al.actor_type = 'STAFF'
    `;

    const sqlParams: any[] = [];
    if (action) {
      sqlParams.push(action);
      sql += ` AND al.action = $${sqlParams.length}`;
    }

    sqlParams.push(limit);
    sql += ` ORDER BY al.created_at DESC LIMIT $${sqlParams.length}`;

    const res = await query(sql, sqlParams);

    return NextResponse.json({
      success: true,
      data: {
        auditLogs: res.rows,
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
