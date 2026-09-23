import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getScanScheduleById } from '@/core/scheduler/schedule-repository';
import {
  updateScanScheduleWithValidation,
  deleteScanScheduleWithValidation,
} from '@/core/scheduler/scheduler-service';
import { ScheduleFrequency } from '@/core/scheduler/cron-evaluator';
import { ScanMode } from '@/core/scanner/checks/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'schedules:read');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const schedule = await getScanScheduleById(id, orgCtx.organizationId);
    if (!schedule) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: { schedule },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'schedules:update');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const body = await req.json();

    const { name, frequency, customCron, scanMode, isActive } = body as {
      name?: string;
      frequency?: ScheduleFrequency;
      customCron?: string;
      scanMode?: ScanMode;
      isActive?: boolean;
    };

    const updated = await updateScanScheduleWithValidation(
      id,
      orgCtx.organizationId,
      auth.user.id,
      { name, frequency, customCron, scanMode, isActive }
    );

    return NextResponse.json({
      success: true,
      data: { schedule: updated },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'schedules:delete');

    const { id } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const deleted = await deleteScanScheduleWithValidation(id, orgCtx.organizationId, auth.user.id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Schedule not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Schedule successfully deleted',
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
