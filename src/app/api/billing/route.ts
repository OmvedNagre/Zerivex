import { readJsonBody } from '@/core/security/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getOrganizationEntitlementSummary } from '@/core/billing/entitlement-service';
import { PLANS } from '@/core/billing/types';
import { updateCancellation } from '@/core/billing/billing-operations';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'billing:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id, auth.organizationId);
    const summary = await getOrganizationEntitlementSummary(
      orgCtx.organizationId,
      auth
    );

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: orgCtx.organizationId,
          name: orgCtx.organizationName,
        },
        entitlements: summary,
        plans: PLANS,
        currency: 'INR',
        currencySymbol: '₹',
      },
    });
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'billing:manage');

    const body = await readJsonBody(req);
    const { cancelAtPeriodEnd } = body;
    if (typeof cancelAtPeriodEnd !== 'boolean') return NextResponse.json({ error: 'cancelAtPeriodEnd must be a boolean' }, { status: 400 });

    const orgCtx = await getUserActiveOrganization(auth.user.id, auth.organizationId);

    const updated = await updateCancellation(orgCtx.organizationId, cancelAtPeriodEnd);

    await recordAuditEvent({
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      action: cancelAtPeriodEnd ? 'SUBSCRIPTION_CANCELED' : 'SUBSCRIPTION_RENEWED',
      resourceType: 'SUBSCRIPTION',
      resourceId: updated.id,
      metadata: { cancelAtPeriodEnd },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
