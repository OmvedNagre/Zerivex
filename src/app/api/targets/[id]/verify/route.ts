import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { verifyTarget } from '@/core/targets/verification-service';
import { VerificationMethod } from '@/core/targets/target-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'targets:verify');

    const { id: targetId } = await params;
    const orgCtx = await getUserActiveOrganization(auth.user.id);

    let preferredMethod: VerificationMethod | undefined;
    try {
      const body = await req.json();
      if (body.preferredMethod) {
        preferredMethod = body.preferredMethod as VerificationMethod;
      }
    } catch {
      // Empty body is acceptable
    }

    const result = await verifyTarget({
      targetId,
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      preferredMethod,
    });

    return NextResponse.json({
      success: result.success,
      data: {
        diagnostic: result.diagnostic,
        verifiedAt: result.verifiedAt,
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
