import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { exportAuditVault } from '@/core/audit/audit-vault';
import { AuditAction } from '@/core/audit/audit-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'audit:export');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'audit:export', auth.userRole);

    const { searchParams } = new URL(req.url);

    const formatParam = searchParams.get('format')?.toLowerCase();
    const format: 'csv' | 'json' = formatParam === 'json' ? 'json' : 'csv';

    const action = searchParams.get('action') as AuditAction | null;
    const resourceType = searchParams.get('resourceType') || undefined;
    const actorUserId = searchParams.get('actorUserId') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const search = searchParams.get('search') || undefined;

    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    const userAgent = req.headers.get('user-agent') || undefined;

    const result = await exportAuditVault({
      filter: {
        organizationId: auth.organizationId,
        action: action || undefined,
        resourceType,
        actorUserId,
        startDate,
        endDate,
        search,
      },
      format,
      actorUserId: auth.userId,
      ipAddress: clientIp,
      userAgent,
    });

    return new NextResponse(result.data, {
      status: 200,
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Record-Count': String(result.recordCount),
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
