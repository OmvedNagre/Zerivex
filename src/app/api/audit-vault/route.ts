import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { queryAuditVault } from '@/core/audit/audit-vault';
import { AuditAction } from '@/core/audit/audit-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'audit:read');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'audit:read', auth.userRole);

    const { searchParams } = new URL(req.url);

    const action = searchParams.get('action') as AuditAction | null;
    const resourceType = searchParams.get('resourceType') || undefined;
    const actorUserId = searchParams.get('actorUserId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0;

    const result = await queryAuditVault({
      organizationId: auth.organizationId,
      action: action || undefined,
      resourceType,
      actorUserId,
      startDate,
      endDate,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
