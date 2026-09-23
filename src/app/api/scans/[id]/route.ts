import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getScanJobById } from '@/core/scanner/scan-runner';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'scans:read');

    const { id: scanId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const { scanJob, findings } = await getScanJobById(scanId, orgCtx.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        scanJob,
        findings,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
