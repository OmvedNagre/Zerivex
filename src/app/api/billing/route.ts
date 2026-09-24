import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getOrganizationEntitlementSummary } from '@/core/billing/entitlement-service';
import { PLANS } from '@/core/billing/types';
import { upsertSubscription } from '@/core/billing/subscription-repository';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'billing:read');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const summary = await getOrganizationEntitlementSummary(
      orgCtx.organizationId,
      auth.user.role
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

    const body = await req.json();
    const { cancelAtPeriodEnd } = body;

    const orgCtx = await getUserActiveOrganization(auth.user.id);

    const updated = await upsertSubscription({
      organizationId: orgCtx.organizationId,
      cancelAtPeriodEnd: Boolean(cancelAtPeriodEnd),
    });

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
