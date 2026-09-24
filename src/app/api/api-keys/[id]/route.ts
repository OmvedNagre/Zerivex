import { NextRequest, NextResponse } from 'next/server';
import { requireApiOrSessionAuth, handleAuthError } from '@/core/rbac/authorization-guard';
import { revokeApiKey } from '@/core/auth/api-key-service';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'apikeys:revoke');
    const { id } = await context.params;

    const revoked = await revokeApiKey({
      apiKeyId: id,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
    });

    if (!revoked) {
      return NextResponse.json(
        { success: false, error: 'API key not found or already revoked' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key successfully revoked',
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
