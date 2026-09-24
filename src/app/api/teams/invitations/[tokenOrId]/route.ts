import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { getInvitationByToken, revokeInvitation } from '@/core/teams/team-service';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tokenOrId: string }> }
) {
  try {
    const { tokenOrId } = await params;

    const invite = await getInvitationByToken(tokenOrId);
    if (!invite) {
      return NextResponse.json(
        { error: 'Invitation not found or invalid' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { invitation: invite },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to inspect invitation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tokenOrId: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:invite');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'org:invite', auth.userRole);

    const { tokenOrId } = await params;

    const revoked = await revokeInvitation({
      invitationId: tokenOrId,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
    });

    if (!revoked) {
      return NextResponse.json(
        { error: 'Invitation not found, already revoked, or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { revoked: true },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
