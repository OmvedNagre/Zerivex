# Security and reliability remediation — 2 November 2026

This document supersedes earlier readiness and infrastructure claims where they conflict with the implementation described here.

## Implemented

- Scan checks retain per-check outcomes. Transport failures, upstream errors, and zero-request checks are inconclusive. Partial results are retained, but incomplete scans have no score and cannot export a completed security report.
- Fix verification requires observed successful execution. It cannot interpret a swallowed network failure as remediation. Cookie rule IDs are canonicalized, including legacy persisted findings. Returned evidence is redacted.
- Requests made during assessments are confined to the registered origin, and URL_PATH assessments are confined to their subtree. Cross-origin redirects are rejected. Domain/wildcard scope declarations do not automatically authorize scans of other hosts; register each host separately.
- Session-derived organization IDs are retained by customer routes. Staff sessions fail closed without an internal workspace membership. Suspended organizations and removed memberships cannot authenticate with API keys or create scans.
- Scan creation reserves monthly quota and creates the job in one transaction. The same service handles dashboard, CI, and schedule jobs. Engine selection and crawl budgets follow the resolved plan.
- Canonical plan migration supports STARTER, PRO, TEAM, ENTERPRISE. Partial updates preserve omitted fields and distinguish explicit nulls. Paid entitlements require an active, unexpired subscription. Production payment simulation is rejected. Enterprise checkout is handled by agreement, not a zero-priced subscription.
- All scan execution passes through the worker pool. The worker command consumes persisted queued jobs, dispatches due schedules, maintains heartbeats, and marks abandoned work failed. Schedule dispatch uses an atomic lease. In-process concurrency limits apply per process; deploy one worker initially and size additional replicas deliberately.
- Audit records have a serialized per-organization hash chain and database triggers rejecting updates, deletes, and truncation. Existing records are baselined by migration; this cannot attest to history before migration or defend against a privileged database administrator replacing the chain. Audit retention is append-only; physical deletion of referenced users/organizations requires a separately designed retention process.
- Production API rate limiting uses shared PostgreSQL counters. Forwarded IP headers are trusted only with explicit deployment configuration. Actual streamed request bodies are bounded, even without Content-Length.
- Runtime startup validates security configuration. PostgreSQL TLS verifies certificates. Staff ID-token fallback verifies audience, issuer, and freshness.
- Readiness reports mark untested controls explicitly. Configuration audits never issue production certification. Historical report summaries and results are read from stored data rather than fabricated defaults.
- Legacy admin URLs redirect to the staff console. Dead legal/disclosure links were removed pending published policies. Credit grants remain unavailable until a real ledger exists. Notifications use the shared toaster, and screenshot scripts use Node's WebSocket and configurable local output paths.

## Deployment

1. Back up the application database and retain its previous application release for rollback planning.
2. Apply migrations with `npm run db:migrate`. Use an unpooled migration connection if your provider restricts DDL or connection-level settings. Migrations 011–013 must precede the application release.
3. Run the web process and a separate long-lived worker process: `npm run start` and `npm run worker`. A request-only/serverless deployment without the worker does not provide asynchronous scans or recurring scheduling.
4. Set `TRUST_PROXY_HEADERS=true` only when the ingress overwrites/removes client-supplied forwarding headers and direct access to the origin is restricted. Otherwise requests share a conservative rate-limit bucket.
5. Configure Google/GitHub OAuth and HTTPS application URLs before starting production. Configure Stripe keys before enabling paid checkout. A private PostgreSQL CA can be supplied as `DATABASE_SSL_CA`.
6. Verify `/api/health/ready`, inspect durable queue metrics from `/api/health`, and exercise a target you own before accepting customers.

Schema changes and worker deployment have not been applied to application tables by this remediation session. Database verification uses a generated temporary schema that is dropped after the check.

## Verification commands

- `npm test`: hermetic suites; application `.env.local` is never loaded by Vitest. Legacy live-database suites are excluded unless explicitly enabled.
- `TEST_DATABASE_URL=... npm run test:postgres`: isolated PostgreSQL regressions covering migrations, partial updates, concurrent quota and rate-limit enforcement, incomplete scan outcomes, duplicate job claims, audit chaining, append-only controls, scheduler leases, and suspension.
- `npm run build` and `npm run typecheck`.

The PostgreSQL regression script can explicitly use the configured server with `--temporary-schema`; it creates and removes only a uniquely named test schema. It does not scan external targets. Legacy integration suites still assume mutable audit fixtures and older plan behavior; do not run them against application data. They need fixture migration before enabling `ZERIVEX_INTEGRATION_TESTS=true` with a disposable TEST_DATABASE_URL.

## Remaining product and operational work

- Publish reviewed legal policies; implement the credit ledger and staff billing-event feed before exposing those features.
- Theme selection remains intentionally parked by the current UI specification. No dual-theme accessibility or full browser interaction audit is claimed.
- Live OAuth, Stripe lifecycle reconciliation, browser execution confirmation for XSS, external backup restore drills, and deployment firewall configuration require environment-specific acceptance checks. SQL differential and XSS reflection findings carry confidence limits.
- Older architecture, handoff, and audit documents include historical plans and unverified hosting assertions. Treat this document and executable checks as current operational guidance.
