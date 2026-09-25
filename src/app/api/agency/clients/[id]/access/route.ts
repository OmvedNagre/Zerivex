import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import {
  grantClientAccess,
  revokeClientAccess,
} from '@/core/agency/agency-service';
import { ClientGrantRole } from '@/core/agency/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'agency:clients_manage');

    const { id: relationshipId } = await params;
    const body = await req.json();

    const { userEmail, role = 'CLIENT_VIEWER' } = body;

    if (!userEmail || typeof userEmail !== 'string') {
      return NextResponse.json(
        { error: 'A valid userEmail string is required' },
        { status: 400 }
      );
    }

    if (role !== 'CLIENT_VIEWER' && role !== 'CLIENT_MANAGER') {
      return NextResponse.json(
        { error: 'Role must be either CLIENT_VIEWER or CLIENT_MANAGER' },
        { status: 400 }
      );
    }

    const grant = await grantClientAccess({
      relationshipId,
      userEmail: userEmail.trim(),
      role: role as ClientGrantRole,
      actorUserId: auth.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          grant,
        },
      },
      { status: 201 }
    );
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
    requirePermission(auth, 'agency:clients_manage');

    const { id: relationshipId } = await params;
    const userId = req.nextUrl.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Query parameter userId is required' },
        { status: 400 }
      );
    }

    await revokeClientAccess({
      relationshipId,
      userId,
      actorUserId: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Client stakeholder access revoked successfully',
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
