import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission, handleAuthError } from '@/core/rbac/authorization-guard';
import { getUserActiveOrganization } from '@/core/auth/organization-context';
import { createStripeCheckoutSession } from '@/core/billing/stripe-service';
import { PlanId, BillingCycle, resolvePlanId } from '@/core/billing/types';
import { recordAuditEvent } from '@/core/audit/audit-service';
import { query } from '@/core/db/database';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    requirePermission(auth, 'billing:manage');

    const body = await req.json();
    const { planId, billingCycle } = body;

    const resolvedPlan = resolvePlanId(planId);
    const validPaidPlans = ['PRO', 'TEAM', 'ENTERPRISE'];
    if (!planId || !validPaidPlans.includes(resolvedPlan)) {
      return NextResponse.json(
        { error: 'Valid paid planId required (PRO, TEAM, or ENTERPRISE)' },
        { status: 400 }
      );
    }

    if (!billingCycle || !['MONTHLY', 'YEARLY'].includes(billingCycle)) {
      return NextResponse.json(
        { error: 'Valid billingCycle required (MONTHLY or YEARLY)' },
        { status: 400 }
      );
    }

    const orgCtx = await getUserActiveOrganization(auth.user.id);

    // Section C6: Billing disabled for internal organizations
    const orgCheck = await query<{ isInternal: boolean }>(
      'SELECT is_internal as "isInternal" FROM organizations WHERE id = $1',
      [orgCtx.organizationId]
    );
    if (orgCheck.rows[0]?.isInternal) {
      return NextResponse.json(
        { error: 'Internal workspace has no billing' },
        { status: 403 }
      );
    }

    const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await createStripeCheckoutSession({
      organizationId: orgCtx.organizationId,
      planId: planId as PlanId,
      billingCycle: billingCycle as BillingCycle,
      customerEmail: auth.user.email,
      successUrl: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancelUrl: `${origin}/dashboard/billing?canceled=true`,
    });

    await recordAuditEvent({
      organizationId: orgCtx.organizationId,
      actorUserId: auth.user.id,
      action: 'BILLING_CHECKOUT_INITIATED',
      resourceType: 'SUBSCRIPTION',
      resourceId: session.sessionId,
      metadata: {
        planId,
        billingCycle,
        currency: 'INR',
        isSimulated: session.isSimulated,
      },
    });

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
