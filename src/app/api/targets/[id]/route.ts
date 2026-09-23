import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getTargetById, deleteTarget } from '@/core/targets/target-service';
import { getVerificationInstructions } from '@/core/targets/verification-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:read');

    const { id: targetId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const target = await getTargetById(targetId, orgCtx.organizationId);
    const instructions = getVerificationInstructions(target);

    return NextResponse.json({
      success: true,
      data: {
        target,
        instructions,
      },
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
    requirePermission(auth, 'targets:delete');

    const { id: targetId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    await deleteTarget(targetId, orgCtx.organizationId, auth.user.id);

    return NextResponse.json({
      success: true,
      data: { message: 'Target successfully deleted' },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
