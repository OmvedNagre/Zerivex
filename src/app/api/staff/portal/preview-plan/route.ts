import { NextRequest, NextResponse } from 'next/server';
import { requireStaffAuth } from '@/core/staff/staff-session-service';
import { can } from '@/core/staff/staff-permissions';
import { query } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

import { PLAN_RANK, resolvePlanId } from '@/core/billing/types';

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaffAuth(req);
    const body = await req.json().catch(() => ({}));
    const rawPlanId = body.planId as string | null;

    // Validate planId (allow new canonical IDs, legacy aliases, or null to clear)
    const validPlans = ['STARTER', 'PRO', 'TEAM', 'ENTERPRISE', 'FREE_DEVELOPER', 'TEAM_PRO', null];
    if (rawPlanId !== null && !validPlans.includes(rawPlanId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid preview plan ID' },
        { status: 400 }
      );
    }

    const previewPlanId = rawPlanId ? resolvePlanId(rawPlanId) : null;

    // Role check: Support cannot preview above Pro tier
    if (previewPlanId && PLAN_RANK[previewPlanId] > PLAN_RANK.PRO) {
      if (!can(staff, 'PLAN_PREVIEW_ANY')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Support staff is restricted to previewing up to Pro tier only.',
          },
          { status: 403 }
        );
      }
    }

    // Update active customer session preview_plan_id for this user
    await query(
      `
      UPDATE sessions
      SET preview_plan_id = $1
      WHERE user_id = $2 AND via_staff_portal = true AND expires_at > NOW()
      `,
      [previewPlanId, staff.userId]
    );

    // Audit log
    await recordAuditEvent({
      actorUserId: staff.userId,
      actorType: 'STAFF',
      action: 'STAFF_PLAN_PREVIEW_CHANGED',
      resourceType: 'plan_preview',
      resourceId: staff.userId,
      metadata: { previewPlanId, role: staff.role },
    });

    return NextResponse.json({
      success: true,
      data: { previewPlanId },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Unauthorized' },
      { status: err.statusCode || 401 }
    );
  }
}
