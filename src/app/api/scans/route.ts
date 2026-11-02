import { readJsonBody } from '@/core/security/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  createScanJob,
  listScanJobsForOrg,
} from '@/core/scanner/scan-runner';
import { ScanMode } from '@/core/scanner/checks/types';
import {
  checkFeatureAccess,
} from '@/core/billing/entitlement-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'scans:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id, auth.organizationId);
    const targetId = req.nextUrl.searchParams.get('targetId') ?? undefined;

    const scans = await listScanJobsForOrg(orgCtx.organizationId, targetId);

    return NextResponse.json({
      success: true,
      data: { scans },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'scans:create');

    const body = await readJsonBody(req);
    const { targetId, scanMode } = body;

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json(
        { error: 'A valid targetId UUID is required to initiate a scan' },
        { status: 400 }
      );
    }

    const orgCtx = await getUserActiveOrganization(auth.user.id, auth.organizationId);
    const selectedMode: ScanMode = (scanMode as ScanMode) || 'PUBLIC_PASSIVE';

    // Included quota and additional credits are reserved atomically by createScanJob.

    // 2. Enforce active scanning feature access
    if (selectedMode === 'VERIFIED_ACTIVE') {
      const featureCheck = await checkFeatureAccess(
        orgCtx.organizationId,
        'activeVerifiedTests',
        auth
      );
      if (!featureCheck.allowed) {
        return NextResponse.json(
          {
            error: featureCheck.reason,
            feature: 'activeVerifiedTests',
            planId: featureCheck.planId,
          },
          { status: 403 }
        );
      }
    }

    // 3. Create scan job (enforces target ownership & authorization gate)
    const scanJob = await createScanJob({
      organizationId: orgCtx.organizationId,
      targetId,
      requesterUserId: auth.user.id,
      scanMode: selectedMode,
      session: auth,
    });

    // 4. Record monthly scan usage
    // Usage is reserved atomically with job creation.

    // A separate durable worker executes queued jobs; web requests never own scan lifetimes.

    return NextResponse.json(
      {
        success: true,
        data: {
          scanJob,
          findingsCount: 0,
          pollUrl: `/api/scans/${scanJob.id}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes('[ZERIVEX CRITICAL SECURITY]') || message.includes('Target ownership must be verified')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    return handleAuthError(error);
  }
}
