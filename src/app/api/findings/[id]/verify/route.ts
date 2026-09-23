import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { verifyFindingFix } from '@/core/remediation/fix-verifier';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'findings:update');

    const { id: findingId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const result = await verifyFindingFix({
      findingId,
      organizationId: orgCtx.organizationId,
      userId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
