import crypto from 'crypto';
import { PlanId, BillingCycle, PLANS, SubscriptionStatus } from './types';
import { upsertSubscription, getSubscriptionByStripeId } from './subscription-repository';
import { recordAuditEvent } from '@/core/audit/audit-service';

export interface StripeCheckoutParams {
  organizationId: string;
  planId: PlanId;
  billingCycle: BillingCycle;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface StripeCheckoutResult {
  sessionId: string;
  url: string;
  isSimulated: boolean;
}

export interface StripePortalParams {
  organizationId: string;
  stripeCustomerId: string;
  returnUrl: string;
}

export interface StripePortalResult {
  url: string;
  isSimulated: boolean;
}

/**
 * Verify Stripe webhook signature with constant-time HMAC-SHA256 comparison and replay mitigation.
 */
export function verifyStripeWebhookSignature(
  rawPayload: string,
  signatureHeader: string | null,
  secret: string,
  toleranceSeconds = 300
): { valid: boolean; error?: string } {
  if (!signatureHeader) {
    return { valid: false, error: 'Missing Stripe-Signature header' };
  }

  // Parse header: t=timestamp,v1=sig1,v1=sig2...
  const parts = signatureHeader.split(',');
  let timestamp: string | null = null;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, val] = part.trim().split('=');
    if (key === 't' && val) {
      timestamp = val;
    } else if (key === 'v1' && val) {
      signatures.push(val);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return { valid: false, error: 'Malformed Stripe-Signature header' };
  }

  // Replay mitigation
  const eventTime = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(eventTime) || Math.abs(now - eventTime) > toleranceSeconds) {
    return { valid: false, error: 'Webhook timestamp outside allowed tolerance window' };
  }

  // Calculate HMAC-SHA256 signature
  const signedPayload = `${timestamp}.${rawPayload}`;
  const computedHmac = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Constant-time comparison
  const computedBuffer = Buffer.from(computedHmac, 'utf8');
  let matched = false;

  for (const sig of signatures) {
    const sigBuffer = Buffer.from(sig, 'utf8');
    if (computedBuffer.length === sigBuffer.length && crypto.timingSafeEqual(computedBuffer, sigBuffer)) {
      matched = true;
      break;
    }
  }

  if (!matched) {
    return { valid: false, error: 'Invalid HMAC signature signature match failure' };
  }

  return { valid: true };
}

/**
 * Initiate Stripe Checkout session in INR.
 * Falls back safely to hermetic local simulation when no live STRIPE_SECRET_KEY is configured.
 */
export async function createStripeCheckoutSession(
  params: StripeCheckoutParams
): Promise<StripeCheckoutResult> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const plan = PLANS[params.planId];
  if (!plan) {
    throw new Error(`Invalid plan specified: ${params.planId}`);
  }

  // Simulated mode (for local dev, tests, or environments without live Stripe keys)
  if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
    const simulatedSessionId = `cs_sim_${crypto.randomBytes(12).toString('hex')}`;
    const redirectUrl = new URL(params.successUrl);
    redirectUrl.searchParams.set('session_id', simulatedSessionId);
    redirectUrl.searchParams.set('simulated', 'true');
    redirectUrl.searchParams.set('plan', params.planId);
    redirectUrl.searchParams.set('cycle', params.billingCycle);

    return {
      sessionId: simulatedSessionId,
      url: redirectUrl.toString(),
      isSimulated: true,
    };
  }

  // Live Stripe API Integration using native HTTPS
  const priceInr =
    params.billingCycle === 'YEARLY' ? plan.pricing.yearlyInr : plan.pricing.monthlyInr;

  // Stripe requires amount in smallest currency unit (paise for INR: 1 INR = 100 paise)
  const amountInPaise = priceInr * 100;

  const bodyData = new URLSearchParams({
    mode: 'subscription',
    'payment_method_types[0]': 'card',
    'line_items[0][price_data][currency]': 'inr',
    'line_items[0][price_data][product_data][name]': `Zerivex ${plan.name} (${params.billingCycle})`,
    'line_items[0][price_data][product_data][description]': plan.tagline,
    'line_items[0][price_data][unit_amount]': amountInPaise.toString(),
    'line_items[0][price_data][recurring][interval]': params.billingCycle === 'YEARLY' ? 'year' : 'month',
    'line_items[0][quantity]': '1',
    'metadata[organizationId]': params.organizationId,
    'metadata[planId]': params.planId,
    'metadata[billingCycle]': params.billingCycle,
    'subscription_data[metadata][organizationId]': params.organizationId,
    'subscription_data[metadata][planId]': params.planId,
    'subscription_data[metadata][billingCycle]': params.billingCycle,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  if (params.customerEmail) {
    bodyData.set('customer_email', params.customerEmail);
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyData.toString(),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(
      `Stripe checkout creation failed (${response.status}): ${JSON.stringify(errorJson)}`
    );
  }

  const session = await response.json();
  return {
    sessionId: session.id,
    url: session.url,
    isSimulated: false,
  };
}

/**
 * Create Stripe Customer Portal session.
 */
export async function createStripePortalSession(
  params: StripePortalParams
): Promise<StripePortalResult> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey || !stripeSecretKey.startsWith('sk_')) {
    return {
      url: `${params.returnUrl}?portal_simulated=true`,
      isSimulated: true,
    };
  }

  const bodyData = new URLSearchParams({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: bodyData.toString(),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(`Stripe portal session failed: ${JSON.stringify(errorJson)}`);
  }

  const portal = await response.json();
  return {
    url: portal.url,
    isSimulated: false,
  };
}

/**
 * Process verified Stripe Webhook event.
 */
export async function handleStripeWebhookEvent(event: {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}): Promise<{ handled: boolean; action?: string }> {
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const metadata = (obj.metadata as Record<string, string>) || {};
      const organizationId = metadata.organizationId;
      const planId = (metadata.planId as PlanId) || 'TEAM_PRO';
      const billingCycle = (metadata.billingCycle as BillingCycle) || 'MONTHLY';
      const customerId = (obj.customer as string) || null;
      const subscriptionId = (obj.subscription as string) || null;

      if (organizationId) {
        await upsertSubscription({
          organizationId,
          planId,
          status: 'ACTIVE',
          billingCycle,
          currency: 'INR',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(
            Date.now() + (billingCycle === 'YEARLY' ? 365 : 30) * 24 * 60 * 60 * 1000
          ),
          cancelAtPeriodEnd: false,
        });

        await recordAuditEvent({
          organizationId,
          actorUserId: null,
          action: 'SUBSCRIPTION_UPGRADED',
          resourceType: 'SUBSCRIPTION',
          resourceId: subscriptionId || organizationId,
          metadata: {
            planId,
            billingCycle,
            currency: 'INR',
            stripeEventId: event.id,
          },
        });
      }
      return { handled: true, action: 'checkout.session.completed' };
    }

    case 'customer.subscription.updated': {
      const subscriptionId = obj.id as string;
      const statusRaw = obj.status as string;
      const cancelAtPeriodEnd = (obj.cancel_at_period_end as boolean) ?? false;
      const currentPeriodStart = obj.current_period_start
        ? new Date((obj.current_period_start as number) * 1000)
        : undefined;
      const currentPeriodEnd = obj.current_period_end
        ? new Date((obj.current_period_end as number) * 1000)
        : undefined;

      const subRecord = await getSubscriptionByStripeId(subscriptionId);
      if (subRecord) {
        let status: SubscriptionStatus = 'ACTIVE';
        if (statusRaw === 'past_due') status = 'PAST_DUE';
        else if (statusRaw === 'canceled') status = 'CANCELED';
        else if (statusRaw === 'trialing') status = 'TRIALING';
        else if (statusRaw === 'incomplete') status = 'INCOMPLETE';

        await upsertSubscription({
          organizationId: subRecord.organizationId,
          planId: subRecord.planId,
          status,
          cancelAtPeriodEnd,
          currentPeriodStart,
          currentPeriodEnd,
          stripeSubscriptionId: subscriptionId,
        });

        await recordAuditEvent({
          organizationId: subRecord.organizationId,
          actorUserId: null,
          action: 'SUBSCRIPTION_RENEWED',
          resourceType: 'SUBSCRIPTION',
          resourceId: subscriptionId,
          metadata: {
            status,
            cancelAtPeriodEnd,
            stripeEventId: event.id,
          },
        });
      }
      return { handled: true, action: 'customer.subscription.updated' };
    }

    case 'customer.subscription.deleted': {
      const subscriptionId = obj.id as string;
      const subRecord = await getSubscriptionByStripeId(subscriptionId);

      if (subRecord) {
        await upsertSubscription({
          organizationId: subRecord.organizationId,
          planId: 'FREE_DEVELOPER',
          status: 'CANCELED',
          stripeSubscriptionId: null,
        });

        await recordAuditEvent({
          organizationId: subRecord.organizationId,
          actorUserId: null,
          action: 'SUBSCRIPTION_CANCELED',
          resourceType: 'SUBSCRIPTION',
          resourceId: subscriptionId,
          metadata: {
            previousPlanId: subRecord.planId,
            stripeEventId: event.id,
          },
        });
      }
      return { handled: true, action: 'customer.subscription.deleted' };
    }

    case 'invoice.payment_succeeded': {
      const subscriptionId = obj.subscription as string | null;
      if (subscriptionId) {
        const subRecord = await getSubscriptionByStripeId(subscriptionId);
        if (subRecord) {
          await recordAuditEvent({
            organizationId: subRecord.organizationId,
            actorUserId: null,
            action: 'INVOICE_PAYMENT_SUCCEEDED',
            resourceType: 'INVOICE',
            resourceId: (obj.id as string) || subscriptionId,
            metadata: {
              amountPaid: obj.amount_paid,
              currency: obj.currency || 'inr',
              stripeEventId: event.id,
            },
          });
        }
      }
      return { handled: true, action: 'invoice.payment_succeeded' };
    }

    case 'invoice.payment_failed': {
      const subscriptionId = obj.subscription as string | null;
      if (subscriptionId) {
        const subRecord = await getSubscriptionByStripeId(subscriptionId);
        if (subRecord) {
          await upsertSubscription({
            organizationId: subRecord.organizationId,
            status: 'PAST_DUE',
          });

          await recordAuditEvent({
            organizationId: subRecord.organizationId,
            actorUserId: null,
            action: 'INVOICE_PAYMENT_FAILED',
            resourceType: 'INVOICE',
            resourceId: (obj.id as string) || subscriptionId,
            metadata: {
              attemptCount: obj.attempt_count,
              stripeEventId: event.id,
            },
          });
        }
      }
      return { handled: true, action: 'invoice.payment_failed' };
    }

    default:
      return { handled: false, action: event.type };
  }
}
