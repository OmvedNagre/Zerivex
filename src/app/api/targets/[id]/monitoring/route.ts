import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getTargetById } from '@/core/targets/target-service';
import {
  getTargetAlerts,
  getTargetSecurityTrends,
} from '@/core/monitoring/monitoring-repository';
import { getScanSchedulesByTarget } from '@/core/scheduler/schedule-repository';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:read');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    // Verify target ownership
    const target = await getTargetById(id, orgCtx.organizationId);

    const [trends, alerts, schedules] = await Promise.all([
      getTargetSecurityTrends(target.id, orgCtx.organizationId),
      getTargetAlerts(target.id, orgCtx.organizationId, 30),
      getScanSchedulesByTarget(target.id, orgCtx.organizationId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        target,
        trends,
        alerts,
        schedules,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
