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

    let preferredMethod: VerificationMethod | 'MANUAL_BYPASS' | undefined;
    let bypass = false;
    try {
      const body = await req.json();
      if (body.preferredMethod) {
        preferredMethod = body.preferredMethod;
      }
      if (body.bypass) {
        bypass = Boolean(body.bypass);
      }
    } catch {
      // Empty body is acceptable
    }

    const isAuthorizedForBypass =
      auth.user.role === 'OWNER' ||
      auth.user.role === 'ADMIN' ||
      process.env.NODE_ENV !== 'production';

    const shouldBypass = (bypass || preferredMethod === 'MANUAL_BYPASS') && isAuthorizedForBypass;

    const result = await verifyTarget({
      targetId,
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      preferredMethod: shouldBypass ? 'MANUAL_BYPASS' : preferredMethod as VerificationMethod | undefined,
      bypass: shouldBypass,
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
