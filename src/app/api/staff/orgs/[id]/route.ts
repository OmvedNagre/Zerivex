import { NextRequest, NextResponse } from 'next/server';
import { requireStaffPermission } from '@/core/staff/staff-session-service';
import { query } from '@/core/db/database';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const staff = await requireStaffPermission(req, 'VIEW_ORGS');
    const { id } = await params;

    // 1. Org info
    const orgRes = await query<{
      id: string;
      name: string;
      slug: string;
      isInternal: boolean;
      suspendedAt: Date | null;
      suspendedReason: string | null;
      createdAt: Date;
    }>(
      `
      SELECT
        id,
        name,
        slug,
        is_internal as "isInternal",
        suspended_at as "suspendedAt",
        suspended_reason as "suspendedReason",
        created_at as "createdAt"
      FROM organizations
      WHERE id = $1
      `,
      [id]
    );

    const organization = orgRes.rows[0];
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // 2. Targets (hostnames only, strict data minimization)
    const targetsRes = await query<{
      id: string;
      hostname: string;
      verificationStatus: string;
      createdAt: Date;
    }>(
      `
      SELECT id, hostname, verification_status as "verificationStatus", created_at as "createdAt"
      FROM targets
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 50
      `,
      [id]
    );

    // 3. Members
    const membersRes = await query<{
      id: string;
      email: string;
      displayName: string | null;
      role: string;
      joinedAt: Date;
    }>(
      `
      SELECT
        u.id,
        u.email,
        u.display_name as "displayName",
        m.role,
        m.created_at as "joinedAt"
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.organization_id = $1
      ORDER BY m.created_at ASC
      `,
      [id]
    );

    // 4. Recent audit events (safe fields only)
    const auditRes = await query<{
      id: string;
      action: string;
      resourceType: string;
      createdAt: Date;
    }>(
      `
      SELECT id, action, resource_type as "resourceType", created_at as "createdAt"
      FROM audit_logs
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 20
      `,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        organization,
        targets: targetsRes.rows,
        members: membersRes.rows,
        recentAuditLogs: auditRes.rows,
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
