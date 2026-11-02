import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, handleAuthError } from '@/core/rbac/authorization-guard';
import { query } from '@/core/db/database';
import { acceptInvitation } from '@/core/teams/team-service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tokenOrId: string }> }
) {
  try {
    const session = await requireAuthenticatedUser(req);
    if (session.viaStaffPortal) return NextResponse.json({error:"Use your normal customer sign-in to accept a workspace invitation"},{status:403});
    const { tokenOrId } = await params;

    const result = await acceptInvitation({
      rawToken: tokenOrId,
      userId: session.user.id,
    });

    await query('UPDATE sessions SET active_organization_id=$1 WHERE id=$2 AND user_id=$3 AND via_staff_portal=false', [result.organizationId, session.sessionId, session.user.id]);

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
