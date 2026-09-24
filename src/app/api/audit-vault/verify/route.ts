import { NextRequest, NextResponse } from 'next/server';
import {
  requireApiOrSessionAuth,
  requireOrgRolePermission,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { verifyAuditVaultIntegrity } from '@/core/audit/audit-vault';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireApiOrSessionAuth(req, 'audit:read');
    await requireOrgRolePermission(auth.userId, auth.organizationId, 'audit:read', auth.userRole);

    const integrity = await verifyAuditVaultIntegrity(auth.organizationId);

    return NextResponse.json({
      success: true,
      data: integrity,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
