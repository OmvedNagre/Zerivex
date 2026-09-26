import { NextRequest, NextResponse } from 'next/server';
import {
  requireAuthenticatedUser,
  ForbiddenError,
  handleAuthError,
} from '@/core/rbac/authorization-guard';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { runPlatformSelfScan } from '@/core/audit/self-scan-engine';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuthenticatedUser(req);

    // Only platform owners or admins can trigger full dogfooding self-scans
    if (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN') {
      throw new ForbiddenError(
        'Platform Self-Scans can only be triggered by Platform Owners or Administrators.'
      );
    }

    await recordAuditEvent({
      actorUserId: session.user.id,
      action: 'SELF_SCAN_TRIGGERED',
      resourceType: 'platform',
      resourceId: 'zerivex-core',
      metadata: {
        userEmail: session.user.email,
        role: session.user.role,
      },
    });

    const report = await runPlatformSelfScan({
      triggeredByUserId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
