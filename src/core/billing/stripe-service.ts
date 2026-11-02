import crypto from 'crypto';
import { stripeRequest } from './stripe-client';
import { PlanId, BillingCycle, PLANS } from './types';

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
 * Missing Stripe credentials fail closed in every environment; no payment simulation.
 */
export async function createStripeCheckoutSession(
  params: StripeCheckoutParams
): Promise<StripeCheckoutResult> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const plan = PLANS[params.planId];
  if (!plan) {
    throw new Error(`Invalid plan specified: ${params.planId}`);
  }

  if (!stripeSecretKey?.startsWith('sk_')) throw Object.assign(new Error('Stripe is not configured'), { statusCode: 503 });

  if (process.env.NODE_ENV === 'production' &&
      (process.env.LEGAL_POLICIES_APPROVED !== 'true' || !process.env.LEGAL_OPERATOR_NAME?.trim() || !process.env.LEGAL_JURISDICTION?.trim())) {
    throw new Error('Public paid checkout requires reviewed policies and operator details');
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

  const session = await stripeRequest('checkout/sessions', { method: 'POST', body: bodyData });
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

  if (!stripeSecretKey?.startsWith('sk_')) throw Object.assign(new Error('Stripe is not configured'), { statusCode: 503 });

  const bodyData = new URLSearchParams({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });

  const portal = await stripeRequest('billing_portal/sessions', { method: 'POST', body: bodyData });
  return {
    url: portal.url,
    isSimulated: false,
  };
}

/**
 * Process verified Stripe Webhook event.
 */
export async function handleStripeWebhookEvent(event: {
  id: string; type: string; created?: number; livemode?: boolean; data: { object: Record<string, unknown> };
}) {
  const { processStripeEvent } = await import('./billing-operations');
  return processStripeEvent(event);
}
