import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { assignFinding } from '@/core/collaboration/comment-service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'findings:assign');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'findings:assign', auth.userRole);

    const { id: findingId } = await params;
    const body = await req.json();
    const { assignedUserId } = body as { assignedUserId?: string | null };

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = await assignFinding({
      findingId,
      organizationId: auth.organizationId,
      actorUserId: auth.userId,
      assignedUserId: assignedUserId || null,
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error?.message?.includes('not found') || error?.message?.includes('access denied')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error?.message?.includes('not an active member')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return handleAuthError(error);
  }
}
