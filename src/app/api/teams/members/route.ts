import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import {
  getOrganizationMembers,
  updateMemberRole,
  removeMember,
} from '@/core/teams/team-service';
import { OrganizationRole } from '@/core/rbac/permissions';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:members_read');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'org:members_read', auth.userRole);

    const members = await getOrganizationMembers(auth.organizationId);

    return NextResponse.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:members_manage');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'org:members_manage', auth.userRole);

    const body = await req.json();
    const { targetUserId, role } = body as { targetUserId?: string; role?: OrganizationRole };

    if (!targetUserId || !role) {
      return NextResponse.json(
        { error: 'targetUserId and role are required' },
        { status: 400 }
      );
    }

    const validRoles: OrganizationRole[] = [
      'ORG_OWNER',
      'ORG_ADMIN',
      'ORG_MEMBER',
      'ORG_VIEWER',
      'ORG_AUDITOR',
    ];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedRole = await updateMemberRole({
      organizationId: auth.organizationId,
      targetUserId,
      newRole: role,
      actorUserId: auth.userId,
    });

    return NextResponse.json({
      success: true,
      data: { role: updatedRole },
    });
  } catch (error: any) {
    if (error?.message?.includes('sole organization owner')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'org:members_manage');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'org:members_manage', auth.userRole);

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get('userId');

    if (!targetUserId) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      );
    }

    const removed = await removeMember({
      organizationId: auth.organizationId,
      targetUserId,
      actorUserId: auth.userId,
    });

    if (!removed) {
      return NextResponse.json(
        { error: 'Member not found or already removed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { removed: true },
    });
  } catch (error: any) {
    if (error?.message?.includes('sole organization owner')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
