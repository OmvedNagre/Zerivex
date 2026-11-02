import { beforeAll, describe, expect, it } from 'vitest';
import { query, withTransaction } from '@/core/db/database';
import { grantScanCredits, getCreditLedger } from '@/core/credits/credit-service';
import { createScanJob } from '@/core/scanner/scan-runner';
import { processStripeEvent, retryBillingEvent } from '@/core/billing/billing-operations';
import { getSubscriptionByOrgId } from '@/core/billing/subscription-repository';

describe('Credit ledger and billing reconciliation integration', () => {
  let userId: string; let orgId: string; let targetId: string;
  beforeAll(async () => {
    userId = (await query<{ id: string }>("INSERT INTO users (email) VALUES ('ledger-owner@example.test') RETURNING id")).rows[0]!.id;
    orgId = (await query<{ id: string }>("INSERT INTO organizations (name, slug, created_by_user_id) VALUES ('Ledger Test', 'ledger-test', $1) RETURNING id", [userId])).rows[0]!.id;
    await query("INSERT INTO memberships (organization_id,user_id,role) VALUES ($1,$2,'ORG_OWNER')", [orgId, userId]);
    const project = (await query<{ id: string }>("INSERT INTO projects (organization_id,name) VALUES ($1,'Test') RETURNING id", [orgId])).rows[0]!.id;
    targetId = (await query<{ id: string }>("INSERT INTO targets (organization_id,project_id,target_url,hostname,verification_token) VALUES ($1,$2,'https://example.com','example.com','test') RETURNING id", [orgId, project])).rows[0]!.id;
  });
  it('records a balanced idempotent grant once under concurrent retries', async () => {
    const requests = await Promise.all(Array.from({ length: 4 }, () => grantScanCredits({ organizationId: orgId, userId, amount: 3, reason: 'Customer scan allowance adjustment', idempotencyKey: 'concurrent-grant-001' })));
    expect(requests.filter((request) => !request.duplicate)).toHaveLength(1);
    expect((await getCreditLedger(orgId)).balance).toBe(3);
    expect((await query<{ total: string }>('SELECT SUM(amount)::text as total FROM credit_postings')).rows[0]?.total).toBe('0');
  });
  it('does not overspend additional credits after the included allocation is exhausted', async () => {
    await query(`INSERT INTO usage_ledgers (organization_id,metric,period_start,period_end,value)
      VALUES ($1,'MONTHLY_SCANS',date_trunc('month',NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
      (date_trunc('month',NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC',8)`, [orgId]);
    const results = await Promise.allSettled(Array.from({ length: 7 }, () => createScanJob({ organizationId: orgId, targetId, requesterUserId: userId })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    expect((await getCreditLedger(orgId)).balance).toBe(0);
    expect((await query<{ count: string }>('SELECT COUNT(*)::text as count FROM scan_jobs WHERE organization_id=$1', [orgId])).rows[0]?.count).toBe('3');
  });
  it('rejects unbalanced ledger postings at commit and prevents mutation', async () => {
    await expect(withTransaction(async (client) => {
      await client.query("INSERT INTO credit_transactions (organization_id,source,idempotency_key,reason) VALUES ($1,'GRANT','broken-transaction','Invalid transaction')", [orgId]);
    })).rejects.toThrow('two balanced postings');
    await expect(query("UPDATE credit_postings SET amount=1")).rejects.toThrow('append-only');
  });
  const subscriptionEvent = (id: string, created: number, status: string) => ({ id, type: 'customer.subscription.updated', created, livemode: false,
    data: { object: { id: 'sub_ledger_test', customer: 'cus_ledger_test', status,
      current_period_start: 1790000000, current_period_end: 1890000000, metadata: { organizationId: orgId, planId: 'TEAM', billingCycle: 'YEARLY' } } } });
  it('deduplicates events and reconciles authoritative billing periods', async () => {
    const event = subscriptionEvent('evt_paid_001', 1791000000, 'active');
    expect((await processStripeEvent(event)).handled).toBe(true);
    expect((await processStripeEvent(event)).duplicate).toBe(true);
    expect((await getSubscriptionByOrgId(orgId)).planId).toBe('TEAM');
    expect((await query<{ count: string }>("SELECT COUNT(*)::text as count FROM audit_logs WHERE resource_id='evt_paid_001'")).rows[0]?.count).toBe('1');
  });
  it('does not regress subscription state when an older event arrives', async () => {
    await processStripeEvent(subscriptionEvent('evt_late_002', 1790000000, 'past_due'));
    expect((await getSubscriptionByOrgId(orgId)).status).toBe('ACTIVE');
  });
  it('records failures for staff reconciliation and safely retries an unmatched invoice', async () => {
    const event = { id: 'evt_invoice_003', type: 'invoice.payment_failed', created: 1792000000, data: { object: {
      id: 'in_test', subscription: 'sub_not_linked', amount_due: 499900, amount_paid: 0, currency: 'inr', status: 'open' } } };
    await expect(processStripeEvent(event)).rejects.toThrow('matching customer organization');
    expect((await query<{ processing_status: string }>("SELECT processing_status FROM billing_events WHERE id='evt_invoice_003'")).rows[0]?.processing_status).toBe('FAILED');
    await processStripeEvent({ ...subscriptionEvent('evt_link_004', 1792000001, 'active'), data: { object: { ...subscriptionEvent('unused', 1, 'active').data.object, id: 'sub_not_linked' } } });
    await retryBillingEvent('evt_invoice_003');
    expect((await query<{ processing_status: string }>("SELECT processing_status FROM billing_events WHERE id='evt_invoice_003'")).rows[0]?.processing_status).toBe('PROCESSED');
    expect((await query<{ amount_paid: string }>("SELECT amount_paid FROM billing_invoices WHERE id='in_test'")).rows[0]?.amount_paid).toBe('0');
  });
});
