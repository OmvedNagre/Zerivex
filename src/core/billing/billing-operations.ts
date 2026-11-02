import { z } from 'zod';
import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';
import type { DbExecutor } from '@/core/credits/credit-service';
import { getSubscriptionByStripeId, getSubscriptionByOrgId, upsertSubscription } from './subscription-repository';
import { stripeRequest } from './stripe-client';
import { resolvePlanId, type SubscriptionStatus } from './types';

const eventSchema = z.object({ id: z.string().min(1).max(255), type: z.string().min(1).max(255), created: z.number().int().nonnegative().optional(),
  livemode: z.boolean().optional(), data: z.object({ object: z.record(z.string(), z.unknown()) }) });
export type BillingEvent = z.infer<typeof eventSchema>;
const supported = new Set(['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated',
  'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_succeeded', 'invoice.payment_failed', 'invoice.finalized', 'invoice.voided']);
const idOf = (value: unknown): string | null => typeof value === 'string' ? value : value && typeof value === 'object' && 'id' in value ? String(value.id) : null;
export function invoiceSubscriptionId(object: Record<string, any>): string | null {
  return idOf(object.subscription) || idOf(object.parent?.subscription_details?.subscription);
}
function subscriptionId(event: BillingEvent): string | null {
  if (event.type.startsWith('customer.subscription.')) return idOf(event.data.object.id);
  return invoiceSubscriptionId(event.data.object);
}
function billingStatus(status: unknown): SubscriptionStatus {
  if (status === 'active') return 'ACTIVE';
  if (status === 'trialing') return 'TRIALING';
  if (status === 'past_due' || status === 'unpaid') return 'PAST_DUE';
  if (status === 'canceled' || status === 'incomplete_expired') return 'CANCELED';
  return 'INCOMPLETE';
}
function dateOf(value: unknown): Date | undefined { return typeof value === 'number' && value > 0 ? new Date(value * 1000) : undefined; }

/** Store only fields needed for reconciliation; no addresses, emails, payment methods, or card details. */
function minimizeEvent(event: BillingEvent): BillingEvent {
  const object = event.data.object as Record<string, any>;
  const allowed = ['id', 'customer', 'subscription', 'status', 'payment_status', 'currency', 'amount_due', 'amount_paid',
    'created', 'current_period_start', 'current_period_end', 'cancel_at_period_end', 'hosted_invoice_url'] as const;
  const minimal: Record<string, unknown> = {};
  for (const key of allowed) if (object[key] !== undefined) minimal[key] = typeof object[key] === 'object' ? idOf(object[key]) : object[key];
  minimal.metadata = Object.fromEntries(['organizationId', 'planId', 'billingCycle'].filter((key) => typeof object.metadata?.[key] === 'string').map((key) => [key, object.metadata[key]]));
  const item = object.items?.data?.[0];
  if (item) minimal.items = { data: [{ current_period_start: item.current_period_start, current_period_end: item.current_period_end, price: { recurring: { interval: item.price?.recurring?.interval } } }] };
  const parentSubscription = invoiceSubscriptionId(object);
  if (parentSubscription) minimal.subscription = parentSubscription;
  return { ...event, data: { object: minimal } };
}

async function applySubscription(client: DbExecutor, snapshot: Record<string, any>, orgId: string, event: BillingEvent) {
  const current = await client.query<{ stripeEventCreatedAt: Date | null }>('SELECT stripe_event_created_at as "stripeEventCreatedAt" FROM subscriptions WHERE organization_id = $1 FOR UPDATE', [orgId]);
  const providerTime = new Date((event.created || 0) * 1000);
  if (!process.env.STRIPE_SECRET_KEY && current.rows[0]?.stripeEventCreatedAt && current.rows[0].stripeEventCreatedAt > providerTime) return;
  const item = snapshot.items?.data?.[0];
  const start = dateOf(snapshot.current_period_start ?? item?.current_period_start);
  const end = dateOf(snapshot.current_period_end ?? item?.current_period_end);
  const existing = snapshot.id ? await getSubscriptionByStripeId(String(snapshot.id), client) : null;
  const planId = resolvePlanId(snapshot.metadata?.planId || existing?.planId);
  const status = billingStatus(snapshot.status);
  if ((status === 'ACTIVE' || status === 'TRIALING') && (!start || !end || end <= start || planId === 'STARTER')) {
    throw new Error('Subscription has no valid paid plan or provider billing period');
  }
  await upsertSubscription({ organizationId: orgId, planId: status === 'CANCELED' ? 'STARTER' : planId, status,
    billingCycle: (snapshot.metadata?.billingCycle === 'YEARLY' || item?.price?.recurring?.interval === 'year') ? 'YEARLY' : existing?.billingCycle || 'MONTHLY',
    currentPeriodStart: start, currentPeriodEnd: end, cancelAtPeriodEnd: Boolean(snapshot.cancel_at_period_end),
    stripeCustomerId: idOf(snapshot.customer), stripeSubscriptionId: status === 'CANCELED' ? null : idOf(snapshot.id) }, client);
  await client.query('UPDATE subscriptions SET stripe_event_created_at = GREATEST(COALESCE(stripe_event_created_at, $2), $2) WHERE organization_id = $1', [orgId, providerTime]);
}

export async function processStripeEvent(input: unknown): Promise<{ handled: boolean; action?: string; duplicate?: boolean }> {
  const parsed = eventSchema.safeParse(input);
  if (!parsed.success) throw Object.assign(new Error('Invalid Stripe event structure'), { statusCode: 400 });
  const event = minimizeEvent(parsed.data);
  const subId = subscriptionId(event);
  await query(`INSERT INTO billing_events (id, event_type, subscription_id, livemode, provider_created_at, payload_json)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb) ON CONFLICT (id) DO NOTHING`,
  [event.id, event.type, subId, event.livemode || false, new Date((event.created || 0) * 1000), JSON.stringify(event)]);
  try {
    return await withTransaction(async (client) => {
      const row = await client.query<{ processing_status: string; payload_json: BillingEvent }>('SELECT processing_status, payload_json FROM billing_events WHERE id = $1 FOR UPDATE', [event.id]);
      if (['PROCESSED', 'IGNORED'].includes(row.rows[0]!.processing_status)) return { handled: true, duplicate: true, action: event.type };
      // Always replay the originally verified payload, never a modified duplicate body.
      const verified = row.rows[0]!.payload_json;
      let object = verified.data.object as Record<string, any>;
      const verifiedSubId = subscriptionId(verified);
      if (!supported.has(verified.type)) {
        await client.query("UPDATE billing_events SET processing_status = 'IGNORED', processed_at = NOW(), attempts = attempts + 1 WHERE id = $1", [event.id]);
        return { handled: false, action: verified.type };
      }
      if (verifiedSubId) await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 1))', [verifiedSubId]);
      let snapshot: Record<string, any> | undefined;
      if (verifiedSubId && process.env.STRIPE_SECRET_KEY?.startsWith('sk_')) snapshot = await stripeRequest(`subscriptions/${encodeURIComponent(verifiedSubId)}`);
      else if (verified.type.startsWith('customer.subscription.')) snapshot = verified.type === 'customer.subscription.deleted' ? { ...object, status: 'canceled' } : object;
      else if (process.env.NODE_ENV !== 'test') throw new Error('Configure Stripe credentials to reconcile this event');
      const existing = verifiedSubId ? await getSubscriptionByStripeId(verifiedSubId, client) : null;
      const orgInput = snapshot?.metadata?.organizationId || object.metadata?.organizationId || existing?.organizationId;
      if (typeof orgInput !== 'string' || !z.string().uuid().safeParse(orgInput).success) throw new Error('No matching customer organization; retry after subscription reconciliation');
      const org = await client.query('SELECT id FROM organizations WHERE id = $1 AND is_internal = false FOR UPDATE', [orgInput]);
      if (!org.rows.length) throw new Error('Customer organization not found');
      if (snapshot) await applySubscription(client, snapshot, orgInput, verified);
      if (verified.type.startsWith('invoice.')) {
        if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_') && typeof object.id === 'string') {
          object = await stripeRequest(`invoices/${encodeURIComponent(object.id)}`);
        }
        if (typeof object.id !== 'string' || !Number.isSafeInteger(object.amount_due) || !Number.isSafeInteger(object.amount_paid) ||
            object.amount_due < 0 || object.amount_paid < 0 || typeof object.currency !== 'string') throw new Error('Invalid invoice amounts or currency');
        const invoiceTime = dateOf(object.created) || new Date((verified.created || 0) * 1000);
        const invoiceUrl = typeof object.hosted_invoice_url === 'string' && object.hosted_invoice_url.startsWith('https://') ? object.hosted_invoice_url : null;
        await client.query(`INSERT INTO billing_invoices (id, organization_id, subscription_id, amount_due, amount_paid, currency, status, hosted_invoice_url, provider_created_at, last_event_created_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO UPDATE SET amount_due=EXCLUDED.amount_due, amount_paid=EXCLUDED.amount_paid,
          status=EXCLUDED.status, hosted_invoice_url=EXCLUDED.hosted_invoice_url, updated_at=NOW(), last_event_created_at=EXCLUDED.last_event_created_at
          WHERE billing_invoices.last_event_created_at <= EXCLUDED.last_event_created_at`,
        [object.id, orgInput, verifiedSubId, object.amount_due, object.amount_paid, object.currency.toUpperCase(), object.status || (verified.type.includes('failed') ? 'open' : 'paid'), invoiceUrl, invoiceTime, process.env.STRIPE_SECRET_KEY ? new Date() : new Date((verified.created || 0) * 1000)]);
      }
      await recordAuditEvent({ organizationId: orgInput, actorType: 'SYSTEM', action: 'BILLING_EVENT_RECONCILED', resourceType: 'billing_event', resourceId: verified.id, metadata: { type: verified.type } }, client);
      await client.query("UPDATE billing_events SET organization_id = $2, processing_status = 'PROCESSED', processed_at = NOW(), attempts = attempts + 1, error_message = NULL WHERE id = $1", [verified.id, orgInput]);
      return { handled: true, action: verified.type };
    });
  } catch (error) {
    await query("UPDATE billing_events SET processing_status = 'FAILED', attempts = attempts + 1, error_message = $2 WHERE id = $1 AND processing_status NOT IN ('PROCESSED', 'IGNORED')", [event.id, 'Reconciliation failed. Verify Stripe configuration and organization metadata, then retry.']);
    throw error;
  }
}

export async function retryBillingEvent(id: string) {
  const result = await query<{ payload_json: BillingEvent }>('SELECT payload_json FROM billing_events WHERE id = $1', [id]);
  if (!result.rows[0]) throw Object.assign(new Error('Billing event not found'), { statusCode: 404 });
  return processStripeEvent(result.rows[0].payload_json);
}

export async function updateCancellation(organizationId: string, cancelAtPeriodEnd: boolean) {
  const subscription = await getSubscriptionByOrgId(organizationId);
  if (!subscription.stripeSubscriptionId) throw Object.assign(new Error('No Stripe subscription is linked to this organization'), { statusCode: 409 });
  const snapshot = await stripeRequest(`subscriptions/${encodeURIComponent(subscription.stripeSubscriptionId)}`, { method: 'POST',
    body: new URLSearchParams({ cancel_at_period_end: String(cancelAtPeriodEnd) }), idempotencyKey: `cancel:${subscription.stripeSubscriptionId}:${cancelAtPeriodEnd}:${Date.now()}` });
  await upsertSubscription({ organizationId, cancelAtPeriodEnd: Boolean(snapshot.cancel_at_period_end) });
  return getSubscriptionByOrgId(organizationId);
}
