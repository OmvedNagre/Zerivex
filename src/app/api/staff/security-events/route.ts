import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';

export async function GET(req: NextRequest) {
  try {
    const staff = await requireStaffPermission(req, 'VIEW_SECURITY_EVENTS');

    const res = await query<{
      id: string;
      action: string;
      actorType: string;
      resourceType: string;
      resourceId: string | null;
      reason: string | null;
      ipAddress: string | null;
      createdAt: Date;
      metadata: Record<string, unknown>;
    }>(
      `
      SELECT
        id,
        action,
        actor_type as "actorType",
        resource_type as "resourceType",
        resource_id as "resourceId",
        reason,
        ip_address as "ipAddress",
        created_at as "createdAt",
        metadata_json as "metadata"
      FROM audit_logs
      WHERE action IN (
        'AUTH_FAILED_LOGIN',
        'STAFF_FAILED_LOGIN',
        'SECURITY_POLICY_CHANGED',
        'TARGET_VERIFIED',
        'STAFF_ROLE_GRANTED',
        'STAFF_ROLE_REVOKED',
        'STAFF_ORGANIZATION_SUSPENDED'
      )
      ORDER BY created_at DESC
      LIMIT 100
      `
    );

    return NextResponse.json({
      success: true,
      data: {
        events: res.rows,
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
