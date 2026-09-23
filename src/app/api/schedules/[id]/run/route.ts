import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { triggerScheduleNow } from '@/core/scheduler/scheduler-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'schedules:update');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const result = await triggerScheduleNow(id, orgCtx.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      data: {
        schedule: result.schedule,
        scanJob: result.scanJob,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
