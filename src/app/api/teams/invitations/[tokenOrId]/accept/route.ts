import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, handleAuthError } from '@/core/rbac/authorization-guard';
import { acceptInvitation } from '@/core/teams/team-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tokenOrId: string }> }
) {
  try {
    const session = await requireAuthenticatedUser(req);
    const { tokenOrId } = await params;

    const result = await acceptInvitation({
      rawToken: tokenOrId,
      userId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: {
        organizationId: result.organizationId,
        role: result.role,
        message: 'Successfully joined organization',
      },
    });
  } catch (error: any) {
    if (error?.message?.includes('expired') || error?.message?.includes('already')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error?.message?.includes('Invalid invitation token')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
