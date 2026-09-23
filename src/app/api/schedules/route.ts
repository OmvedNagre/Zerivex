import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  getScanSchedulesByOrg,
  getScanSchedulesByTarget,
} from '@/core/scheduler/schedule-repository';
import { createScanScheduleWithValidation } from '@/core/scheduler/scheduler-service';
import { ScheduleFrequency } from '@/core/scheduler/cron-evaluator';
import { ScanMode } from '@/core/scanner/checks/types';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'schedules:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const { searchParams } = new URL(req.url);
    const targetId = searchParams.get('targetId');

    const schedules = targetId
      ? await getScanSchedulesByTarget(targetId, orgCtx.organizationId)
      : await getScanSchedulesByOrg(orgCtx.organizationId);

    return NextResponse.json({
      success: true,
      data: { schedules },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'schedules:create');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const body = await req.json();

    const {
      targetId,
      projectId,
      name,
      frequency,
      customCron,
      scanMode,
    } = body as {
      targetId: string;
      projectId?: string;
      name: string;
      frequency: ScheduleFrequency;
      customCron?: string;
      scanMode?: ScanMode;
    };

    if (!targetId || !name || !frequency) {
      return NextResponse.json(
        { success: false, error: 'targetId, name, and frequency are required' },
        { status: 400 }
      );
    }

    const schedule = await createScanScheduleWithValidation({
      organizationId: orgCtx.organizationId,
      projectId: projectId || orgCtx.organizationId, // Fallback to orgCtx if omitted
      targetId,
      name,
      frequency,
      customCron,
      scanMode,
      actorUserId: auth.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: { schedule },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleAuthError(error);
  }
}
