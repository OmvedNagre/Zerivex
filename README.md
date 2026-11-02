# Zerivex

Security scanning application with separate customer and staff portals.

## Local development

Use Node.js 22 or newer. Install dependencies with `npm ci`, copy `.env.example` to `.env.local`, and configure PostgreSQL, session secrets, and OAuth providers. Existing local settings should be preserved.

Run `npm run db:migrate`, then `npm run dev`. This starts Next.js and the queue worker together. Open http://localhost:3000. Stop both with Ctrl+C. `npm run dev:web` and `npm run worker` run them separately.

Google callback: `/api/auth/callback/google`; GitHub callback: `/api/auth/callback/github`. Register these under your exact application origin in each provider console. Browser fixture tests do not validate a real provider account sign-in.

Staff accounts require an explicit `STAFF_ALLOWED_EMAILS` entry and a platform role. `npm run staff:bootstrap` grants the configured `STAFF_BOOTSTRAP_OWNER_EMAIL` (falling back to `INITIAL_OWNER_EMAIL`) owner access; run only for your intended administrator. Customer and staff sessions are separate.

## Verification

- `npm run typecheck` and `npm test`: offline checks.
- `npm run test:integration`: database regression tests; requires a disposable `TEST_DATABASE_URL`.
- `npm run test:e2e`: desktop/mobile Chromium and accessibility checks; requires `TEST_DATABASE_URL` and installed Chrome on macOS or Playwright Chromium elsewhere.
- Both database test commands accept `-- --temporary-schema` to explicitly use fresh temporary schemas on the configured application database. They remove their own schemas afterward and never truncate application tables.
- `npm run project:status`: safe database/configuration summary without credentials.

## Backups and recovery

Install PostgreSQL client tools (`brew install libpq` on macOS). `npm run db:backup -- --verify-restore` makes a consistent custom-format full backup and restores it into a temporary database, comparing table row counts before removing the temporary database. The database account must have CREATE DATABASE permission for restore verification. `.backups` contains sensitive data and is ignored by Git; copy encrypted backups to independently managed storage with restricted access and a retention policy.

For recovery, create a separate empty database, restore using `pg_restore --exit-on-error --no-owner --no-acl`, verify its data, then change the application connection string during a maintenance window. Do not restore over a running database. Keep the pre-migration backup until the release has been validated.

## Production services

Run `npm ci`, `npm run db:migrate`, and `npm run build` as release steps. Run `npm start` and `npm run worker` as separate supervised services using the same environment and release. Restart both after deployment. Use HTTPS and only enable `TRUST_PROXY_HEADERS` behind a proxy that replaces forwarded headers. Never embed `.env.local` in an image or commit it.

Monitor `/api/health/live` for process liveness and `/api/health/ready` for dependencies. Alert on worker dispatch/heartbeat errors, aged queued jobs, failed scans, failed billing events, and backup failures. Expired running scans fail rather than being silently rerun. Staff billing operations exposes failed event receipts for audited retry.

Stripe needs a real `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; point the signed webhook at `/api/billing/webhook`. Subscribe to checkout, subscription lifecycle, and invoice events handled in `billing-operations.ts`. Test checkout, renewal, cancellation, duplicate deliveries, and retries with Stripe test mode before live activation. Local simulated checkout does not grant a paid subscription. Unsigned webhooks are rejected.

Legal pages remain drafts until `LEGAL_OPERATOR_NAME`, `LEGAL_JURISDICTION`, and `LEGAL_POLICIES_APPROVED=true` are supplied after review. The contact address defaults to code64816@gmail.com. Production paid checkout requires these details. Review provider disclosures, retention practices, commercial terms, and jurisdiction-specific requirements before public launch.

Credits are an immutable balanced ledger. Staff grants require recent authentication, permission, a reason, and an idempotency key. A credit allows one extra scan after the included monthly allowance; it does not unlock paid scanner engines. Reservation and job creation are atomic. A launched scan consumes its allowance even if execution later fails.
