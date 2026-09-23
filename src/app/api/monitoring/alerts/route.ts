import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import {
  getOrganizationAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
} from '@/core/monitoring/monitoring-repository';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'monitoring:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getOrganizationAlerts(orgCtx.organizationId, {
      unreadOnly,
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

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'monitoring:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const body = await req.json();
    const { alertId, markAll } = body as { alertId?: string; markAll?: boolean };

    if (markAll) {
      const count = await markAllAlertsAsRead(orgCtx.organizationId);
      return NextResponse.json({
        success: true,
        message: `Marked ${count} alerts as read`,
        data: { updatedCount: count },
      });
    }

    if (!alertId) {
      return NextResponse.json({ success: false, error: 'alertId is required' }, { status: 400 });
    }

    const updated = await markAlertAsRead(alertId, orgCtx.organizationId);
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Alert marked as read',
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
