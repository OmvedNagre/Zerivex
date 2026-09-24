import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import {
  addFindingComment,
  getFindingComments,
} from '@/core/collaboration/comment-service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'findings:read');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'findings:read', auth.userRole);

    const { id: findingId } = await params;

    const comments = await getFindingComments({
      findingId,
      organizationId: auth.organizationId,
    });

    return NextResponse.json({
      success: true,
      data: { comments },
    });
  } catch (error: any) {
    if (error?.message?.includes('not found') || error?.message?.includes('access denied')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleAuthError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'findings:comment');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'findings:comment', auth.userRole);

    const { id: findingId } = await params;
    const body = await req.json();
    const { content } = body as { content?: string };

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content cannot be empty' },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const comment = await addFindingComment({
      findingId,
      organizationId: auth.organizationId,
      userId: auth.userId,
      content: content.trim(),
      commentType: 'USER_COMMENT',
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: { comment },
    });
  } catch (error: any) {
    if (error?.message?.includes('not found') || error?.message?.includes('access denied')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return handleAuthError(error);
  }
}
