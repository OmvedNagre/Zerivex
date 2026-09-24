import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { getSubscriptionByOrgId } from '@/core/billing/subscription-repository';
import { createStripePortalSession } from '@/core/billing/stripe-service';
import { recordAuditEvent } from '@/core/audit/audit-service';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'billing:manage');

    const orgCtx = await getUserActiveOrganization(auth.user.id);
    const subscription = await getSubscriptionByOrgId(orgCtx.organizationId);

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const returnUrl = `${origin}/dashboard/billing`;

    const portal = await createStripePortalSession({
      organizationId: orgCtx.organizationId,
      stripeCustomerId: subscription.stripeCustomerId || 'sim_cust_default',
      returnUrl,
    });

    await recordAuditEvent({
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      action: 'BILLING_PORTAL_ACCESSED',
      resourceType: 'SUBSCRIPTION',
      resourceId: subscription.id,
      metadata: {
        isSimulated: portal.isSimulated,
      },
    });

    return NextResponse.json({
      success: true,
      data: portal,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
