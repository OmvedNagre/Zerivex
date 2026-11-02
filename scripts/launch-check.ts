import { databasePool, loadLocalEnvironment } from './lib/environment';
loadLocalEnvironment();
async function main() {
  let publicHttpsOrigin = false;
  try { const u = new URL(process.env.NEXT_PUBLIC_APP_URL || ''); publicHttpsOrigin = u.protocol === 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname); } catch {}
  const checks: Record<string, unknown> = {
    publicHttpsOrigin,
    gmailSenderConfigured: Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN),
    workerMonitorConfigured: Boolean(process.env.WORKER_MONITOR_SECRET && process.env.WORKER_MONITOR_SECRET.length >= 32),
    stripeSecretConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    legalJurisdictionConfigured: Boolean(process.env.LEGAL_JURISDICTION),
    legalApprovalConfigured: process.env.LEGAL_POLICIES_APPROVED === 'true',
    note: 'Local configuration only. Deployed OAuth, worker, payments, backups and DNS require production acceptance.'
  };
  const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL;
  if (url) {
    const db = databasePool(url);
    try {
      checks.activeMockLinkedSessions = (await db.query("SELECT count(*)::int AS count FROM sessions WHERE revoked_at IS NULL AND expires_at > NOW() AND user_id IN (SELECT user_id FROM identities WHERE provider = 'mock')")).rows[0].count;
      checks.mockIdentities = (await db.query("SELECT count(*)::int AS count FROM identities WHERE provider = 'mock'")).rows[0].count;
      checks.verifiedTargetsWithLatestManualProof = (await db.query(`SELECT count(*)::int AS count FROM targets t WHERE t.verification_status = 'VERIFIED' AND (SELECT a.metadata_json->>'method' FROM audit_logs a WHERE a.action = 'TARGET_VERIFIED' AND a.resource_id = t.id::text ORDER BY a.created_at DESC LIMIT 1) = 'MANUAL_BYPASS'`)).rows[0].count;
    } finally { await db.end(); }
  }
  console.log(JSON.stringify(checks, null, 2));
}
main().catch(() => { console.error('Launch check failed; no credentials were logged.'); process.exitCode = 1; });
