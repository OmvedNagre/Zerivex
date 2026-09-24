import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import {
  getPendingInvitations,
  inviteMember,
} from '@/core/teams/team-service';
import { OrganizationRole } from '@/core/rbac/permissions';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:members_read');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'org:members_read', auth.userRole);

    const invitations = await getPendingInvitations(auth.organizationId);

    return NextResponse.json({
      success: true,
      data: { invitations },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:invite');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'org:invite', auth.userRole);

    const body = await req.json();
    const { email, role } = body as { email?: string; role?: OrganizationRole };

    if (!email || !role) {
      return NextResponse.json(
        { error: 'email and role are required' },
        { status: 400 }
      );
    }

    const validRoles: OrganizationRole[] = [
      'ORG_ADMIN',
      'ORG_MEMBER',
      'ORG_VIEWER',
      'ORG_AUDITOR',
    ];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invitations cannot be issued for role '${role}'. Permitted invitation roles: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await inviteMember({
      organizationId: auth.organizationId,
      email,
      role,
      actorUserId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      data: {
        invitation: result.invitation,
        rawToken: result.rawToken,
        inviteUrl: result.inviteUrl,
      },
    });
  } catch (error: any) {
    if (error?.message?.includes('already a member')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleAuthError(error);
  }
}
