import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { transferOrganizationOwnership } from '@/core/teams/team-service';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:manage');
    const callerOrgRole = await requireOrgRolePermission(
      auth.userId,
      auth.organizationId,
      'org:manage',
      auth.userRole
    );

    if (callerOrgRole !== 'ORG_OWNER' && auth.userRole !== 'OWNER') {
      return NextResponse.json(
        { error: 'Only the current organization owner can transfer ownership' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { newOwnerUserId } = body as { newOwnerUserId?: string };

    if (!newOwnerUserId) {
      return NextResponse.json(
        { error: 'newOwnerUserId is required' },
        { status: 400 }
      );
    }

    if (newOwnerUserId === auth.userId) {
      return NextResponse.json(
        { error: 'Cannot transfer ownership to yourself' },
        { status: 400 }
      );
    }

    await transferOrganizationOwnership({
      organizationId: auth.organizationId,
      newOwnerUserId,
      currentOwnerUserId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      data: { transferred: true, newOwnerUserId },
    });
  } catch (error: any) {
    if (error?.message?.includes('must be an existing member')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
