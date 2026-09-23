import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'findings:update');

    const { id: findingId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const body = await req.json();
    const { status, acceptedRiskReason } = body;

    const allowedStatuses = ['OPEN', 'CONFIRMED', 'FALSE_POSITIVE', 'ACCEPTED_RISK', 'FIXED', 'REOPENED'];
    if (!status || !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed values: [${allowedStatuses.join(', ')}]` },
        { status: 400 }
      );
    }

    if (status === 'ACCEPTED_RISK' && !acceptedRiskReason) {
      return NextResponse.json(
        { error: 'An explicit acceptedRiskReason is required when marking a finding as ACCEPTED_RISK' },
        { status: 400 }
      );
    }

    const res = await query(
      `
      UPDATE findings
      SET
        status = $1,
        accepted_risk_reason = $2,
        updated_at = NOW()
      WHERE id = $3 AND organization_id = $4
      RETURNING id, title, rule_id, status
      `,
      [status, acceptedRiskReason ?? null, findingId, orgCtx.organizationId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Finding not found or access denied' }, { status: 404 });
    }

    // Audit log
    await recordAuditEvent({
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      action: status === 'ACCEPTED_RISK' ? 'FINDING_ACCEPTED_RISK' : 'FINDING_STATUS_CHANGED',
      resourceType: 'finding',
      resourceId: findingId,
      metadata: {
        newStatus: status,
        reason: acceptedRiskReason ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      data: { finding: res.rows[0] },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
