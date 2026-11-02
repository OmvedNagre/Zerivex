import { readJsonBody } from '@/core/security/request-body';
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
    const orgCtx = await getUserActiveOrganization(auth.user.id, auth.organizationId);

    let preferredMethod: VerificationMethod | 'MANUAL_BYPASS' | undefined;
    let bypass = false;
    try {
      const body = await readJsonBody(req);
      if (body.preferredMethod) {
        preferredMethod = body.preferredMethod;
      }
      if (body.bypass) {
        bypass = Boolean(body.bypass);
      }
    } catch {
      // Empty body is acceptable
    }

    if (bypass || preferredMethod === 'MANUAL_BYPASS') return NextResponse.json({ error: 'Manual verification bypasses are disabled' }, { status: 403 });

    const result = await verifyTarget({
      targetId,
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      preferredMethod: preferredMethod as VerificationMethod | undefined,
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
