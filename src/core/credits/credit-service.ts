import type { QueryResult, QueryResultRow } from 'pg';
import { query, withTransaction } from '@/core/db/database';
import { recordAuditEvent } from '@/core/audit/audit-service';

export type DbExecutor = { query: <R extends QueryResultRow = QueryResultRow>(sql: string, values?: unknown[]) => Promise<QueryResult<R>> };

async function postCredits(client: DbExecutor, input: {
  organizationId: string; userId?: string; amount: number; source: 'GRANT' | 'SCAN_USAGE'; reason: string; key: string;
}) {
  const existing = await client.query<{ id: string }>('SELECT id FROM credit_transactions WHERE organization_id = $1 AND idempotency_key = $2', [input.organizationId, input.key]);
  if (existing.rows[0]) return { transactionId: existing.rows[0].id, duplicate: true };
  await client.query("INSERT INTO credit_accounts (organization_id, kind) VALUES ($1, 'ORG_AVAILABLE') ON CONFLICT (organization_id) DO NOTHING", [input.organizationId]);
  const accounts = await client.query<{ id: string; kind: string }>(
    "SELECT id, kind FROM credit_accounts WHERE organization_id = $1 OR kind = 'PLATFORM_POOL' ORDER BY id FOR UPDATE", [input.organizationId]);
  const org = accounts.rows.find((account) => account.kind === 'ORG_AVAILABLE');
  const pool = accounts.rows.find((account) => account.kind === 'PLATFORM_POOL');
  if (!org || !pool) throw new Error('Credit accounts unavailable');
  const changed = await client.query('UPDATE credit_accounts SET balance = balance + $2 WHERE id = $1 AND balance + $2 >= 0 RETURNING id', [org.id, input.amount]);
  if (!changed.rows.length) throw Object.assign(new Error('Monthly scan allowance exhausted and no scan credits remain'), { statusCode: 403 });
  await client.query('UPDATE credit_accounts SET balance = balance - $2 WHERE id = $1', [pool.id, input.amount]);
  const transaction = await client.query<{ id: string }>(`INSERT INTO credit_transactions
    (organization_id, actor_user_id, source, idempotency_key, reason) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
  [input.organizationId, input.userId || null, input.source, input.key, input.reason]);
  const id = transaction.rows[0]!.id;
  await client.query('INSERT INTO credit_postings (transaction_id, account_id, amount) VALUES ($1, $2, $4), ($1, $3, -$4)', [id, org.id, pool.id, input.amount]);
  return { transactionId: id, duplicate: false };
}

export async function grantScanCredits(input: { organizationId: string; userId: string; amount: number; reason: string; idempotencyKey: string }) {
  if (!Number.isSafeInteger(input.amount) || input.amount < 1 || input.amount > 1_000_000) throw Object.assign(new Error('Credit amount must be an integer from 1 to 1,000,000'), { statusCode: 400 });
  if (input.reason.trim().length < 5 || input.reason.length > 1000 || !/^[\w:-]{8,128}$/.test(input.idempotencyKey)) throw Object.assign(new Error('A specific reason and valid idempotency key are required'), { statusCode: 400 });
  return withTransaction(async (client) => {
    const org = await client.query('SELECT id FROM organizations WHERE id = $1 AND is_internal = false AND suspended_at IS NULL FOR UPDATE', [input.organizationId]);
    if (!org.rows.length) throw Object.assign(new Error('Active customer organization not found'), { statusCode: 404 });
    const result = await postCredits(client, { ...input, amount: input.amount, source: 'GRANT', key: input.idempotencyKey });
    if (!result.duplicate) await recordAuditEvent({ organizationId: input.organizationId, actorUserId: input.userId,
      actorType: 'STAFF', action: 'STAFF_CREDITS_GRANTED', resourceType: 'credit_transaction', resourceId: result.transactionId,
      reason: input.reason, metadata: { amount: input.amount, unit: 'additional_scan' } }, client);
    return result;
  });
}

/** Caller holds the organization lock; posting and scan creation commit together. */
export async function consumeScanCredit(client: DbExecutor, organizationId: string, userId: string, scanId: string) {
  return postCredits(client, { organizationId, userId, amount: -1, source: 'SCAN_USAGE', key: `scan:${scanId}`, reason: 'Additional scan beyond the monthly plan allocation' });
}

export async function getCreditLedger(organizationId: string) {
  const balance = await query<{ balance: string }>("SELECT balance::text FROM credit_accounts WHERE organization_id = $1 AND kind = 'ORG_AVAILABLE'", [organizationId]);
  const entries = await query<{ id: string; source: string; amount: string; reason: string; createdAt: Date; actorEmail: string | null }>(`SELECT t.id, t.source, p.amount::text, t.reason, t.created_at as "createdAt", u.email as "actorEmail"
    FROM credit_transactions t JOIN credit_postings p ON p.transaction_id = t.id
    JOIN credit_accounts a ON a.id = p.account_id AND a.kind = 'ORG_AVAILABLE'
    LEFT JOIN users u ON u.id = t.actor_user_id WHERE t.organization_id = $1 ORDER BY t.created_at DESC, t.id DESC LIMIT 100`, [organizationId]);
  return { balance: Number(balance.rows[0]?.balance || 0), entries: entries.rows.map((entry) => ({ ...entry, amount: Number(entry.amount) })) };
}
