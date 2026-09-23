import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  createScanJob,
  executeScanJob,
  listScanJobsForOrg,
} from '@/core/scanner/scan-runner';
import { ScanMode } from '@/core/scanner/checks/types';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'scans:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
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

    const body = await req.json();
    const { targetId, scanMode } = body;

    if (!targetId || typeof targetId !== 'string') {
      return NextResponse.json(
        { error: 'A valid targetId UUID is required to initiate a scan' },
        { status: 400 }
      );
    }

    const orgCtx = await getUserActiveOrganization(auth.user.id);

    // 1. Create scan job (enforces authorization gate)
    const scanJob = await createScanJob({
      organizationId: orgCtx.organizationId,
      targetId,
      requesterUserId: auth.user.id,
      scanMode: (scanMode as ScanMode) || 'PUBLIC_PASSIVE',
    });

    // 2. Execute scan job
    const result = await executeScanJob(scanJob.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          scanJob: result.scanJob,
          findingsCount: result.findings.length,
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
