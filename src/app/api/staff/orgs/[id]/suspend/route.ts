import { NextRequest, NextResponse } from 'next/server';
import {
  requireStaffPermission,
  requireStaffReauth,
} from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireStaffPermission(req, 'SUSPEND_ORGS');
    requireStaffReauth(staff);

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (!reason) {
      return NextResponse.json(
        { success: false, error: 'A specific operational reason is required to suspend an organization.' },
        { status: 400 }
      );
    }

    const res = await query<{ name: string; isInternal: boolean }>(
      `
      UPDATE organizations
      SET suspended_at = NOW(), suspended_reason = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING name, is_internal as "isInternal"
      `,
      [reason, id]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    const orgRecord = res.rows[0]!;
    if (orgRecord.isInternal) {
      return NextResponse.json(
        { success: false, error: 'Cannot suspend the internal platform organization.' },
        { status: 400 }
      );
    }

    await recordAuditEvent({
      organizationId: id,
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_ORGANIZATION_SUSPENDED',
      resourceType: 'organization',
      resourceId: id,
      reason,
      metadata: { orgName: orgRecord.name, staffRole: staff.role },
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        suspended: true,
        suspendedAt: new Date(),
        reason,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Unauthorized',
        reauthRequired: Boolean(err.reauthRequired),
      },
      { status: err.statusCode || 401 }
    );
  }
}
