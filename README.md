# Zerivex

**Security for software built with AI.**

**Verify. Detect. Defend.**

Zerivex is a web application security platform for developers, security teams and agencies managing modern websites and APIs. It combines target ownership verification, deterministic vulnerability checks, actionable findings, remediation guidance, scheduled monitoring and organization administration.

The product has a customer workspace for application security work and a separately authenticated staff console for platform operations. PostgreSQL stores identities, sessions, organizations, scan jobs, findings, subscriptions, invitation delivery state and audit records. A separate worker consumes persisted jobs instead of depending on a browser remaining open.

| Product information | Value |
| --- | --- |
| Website | [www.zerivex.tech](https://www.zerivex.tech) |
| Operator / managing organization | Zerivex |
| Support, queries and invitation replies | [zerivex.secure@gmail.com](mailto:zerivex.secure@gmail.com) |
| Invitation sender | `zerivex.secure@gmail.com` through the Gmail API |
| Designated product owner | `code64816@gmail.com` |
| Repository package version | `0.1.0` |

This README describes the repository implementation. An implemented feature, passing local test or successful website build does not establish that its external provider, worker, billing configuration or production monitoring is operational.

## Contents

- [Product capabilities](#product-capabilities)
- [Scanner coverage and limits](#scanner-coverage-and-limits)
- [Plans and entitlements](#plans-and-entitlements)
- [Architecture and repository](#architecture-and-repository)
- [Local installation](#local-installation)
- [Environment configuration](#environment-configuration)
- [Google and GitHub authentication](#google-and-github-authentication)
- [Owner and staff administration](#owner-and-staff-administration)
- [Invitation email and onboarding](#invitation-email-and-onboarding)
- [Production deployment](#production-deployment)
- [API and integrations](#api-and-integrations)
- [Testing and verification](#testing-and-verification)
- [Operations and recovery](#operations-and-recovery)
- [Troubleshooting](#troubleshooting)
- [Development guidance](#development-guidance)

## Product capabilities

### Customer workspace

- **Dashboard:** security posture, scan intake, registered sites, findings and setup guidance.
- **Targets:** register endpoints, inspect discovered surfaces and verify authorized ownership before active testing.
- **Scanning:** launch eligible assessments, follow execution progress and inspect persisted engine execution details.
- **Findings:** review severity, evidence and remediation guidance; collaborate and track finding status.
- **Remediation:** framework-oriented fix guidance and targeted fix re-verification, subject to plan limits.
- **Automation:** scheduled scans, regression detection and monitoring alerts.
- **CI/CD:** API keys, quality gates and machine-readable scan results for eligible organizations.
- **Team management:** role-based membership, invitation management and recipient onboarding.
- **Agency portfolio:** manage client organizations and portfolio workflows where entitled.
- **Audit vault:** inspect and export audit records and check recorded integrity.
- **Billing:** plan comparison, usage, subscriptions and credit-backed additional scan allowances.
- **Account settings:** profile, sessions, API keys and webhooks.
- **Security Academy:** reference material and remediation education.

Feature visibility is not sufficient authorization. The server checks permissions, organization membership, subscription features, quotas and target verification where applicable.

### Staff console

Staff operations include organization inspection, scan queue and worker health, audit activity, security events, scan credit grants and billing-event monitoring. Staff authentication is separate from customer authentication. Being a customer workspace owner does not automatically create a staff account.

The application does not provide a localhost administrator login, automatic email-based owner promotion or a role-based commercial quota bypass. Administrative access must be explicitly provisioned.

## Scanner coverage and limits

The registry in [`src/core/scanner/engine-registry.ts`](src/core/scanner/engine-registry.ts) defines 14 engines. A registered engine can be unavailable, locked or skipped for a particular assessment because of its plan, scan mode, verified scope or discovered inputs.

| Engine | Minimum plan | Class |
| --- | --- | --- |
| TLS & Certificate | Starter | Passive |
| Security Headers | Starter | Passive |
| Cookie Flags | Starter | Passive |
| CORS Policy | Starter | Passive |
| Exposed Secrets & Files | Starter | Passive |
| security.txt | Starter | Passive |
| AI Code Smells | Starter | Passive |
| HTTP Methods | Pro | Passive |
| Error Leaks | Pro | Passive |
| Open API Endpoints | Pro | Passive |
| SQL Injection | Pro | Active |
| Reflected XSS | Pro | Active |
| Open Redirects | Pro | Active |
| Path Traversal | Pro | Active |

Passive does not mean offline: these checks can make network requests. Active probes require verified ownership and the applicable entitlement. Discovered input coverage affects which probes can run.

The current AI Code Smells engine checks observable application signals; it is not a source repository audit or an LLM-powered code review. API schema fuzzing, authenticated-session scanning and AI repository analysis are explicitly registered as roadmap capabilities, not completed engines.

Security scores summarize observed findings and assessment coverage. They are not a guarantee that an application is secure, a penetration-test certification or proof of regulatory compliance. Scan only targets you are authorized to assess.

### Network and evidence controls

Scanner requests pass through the safe HTTP layer, which applies protocol/port restrictions, IP validation, private-network and metadata protections, DNS/socket handling, redirect revalidation and resource bounds. Evidence is redacted before persistence/export to reduce disclosure of cookies, authorization values and detected secrets.

These controls complement session validation, organization scoping, server-side permissions, request validation and rate limiting. Keep their tests intact when changing scanner or API code.

## Plans and entitlements

The canonical configuration is [`src/core/billing/types.ts`](src/core/billing/types.ts). Amounts are INR; yearly amounts below are the total annual price, not a monthly equivalent.

| Plan | Monthly | Yearly | Sites | Included scans/month | Members | History |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | ₹0 | ₹0 | 1 | 8 | 1 | 30 days |
| Pro | ₹1,499 | ₹14,990 | 3 | 50 | 3 | 90 days |
| Team | ₹4,999 | ₹49,990 | 15 | 250 | 10 | 365 days |
| Enterprise | Custom | Custom | Configured agreement | Configured agreement | Configured agreement | 730 days in current configuration |

- **Starter:** seven passive engines, fix guidance and limited re-tests.
- **Pro:** eligibility for the full engine registry, verified active testing, crawling, schedules, alerts and collaboration.
- **Team:** additional fleet capacity plus CI gates, SARIF, webhooks, API keys, audit vault and agency features.
- **Enterprise:** custom commercial arrangements and expanded limits. Large internal numeric limits do not mean an unlimited service or a free Enterprise plan.

The configuration also defines crawl bounds and daily fix re-test caps. Marketing and billing changes should use this configuration rather than introduce a second pricing table in application code.

### Scan credits

Credits use a balanced ledger. Authorized staff can grant credits with an operational reason and idempotency protection. A credit permits an additional scan after the included allowance; it does not unlock higher-tier engines or features. Quota reservation and job creation are coordinated atomically. A launched scan consumes its allowance even if execution later fails.

## Architecture and repository

```mermaid
flowchart TD
    Customer[Customer browser] --> Web[Next.js pages and API routes]
    Staff[Staff browser with separate session] --> Web
    Providers[Google / GitHub] --> Web
    Web --> DB[(PostgreSQL)]
    Worker[Supervised scanner worker] --> DB
    Worker --> Scanner[Safe HTTP and scanner engines]
    Scanner --> Target[Authorized target]
    Worker --> Gmail[Gmail invitation delivery]
    Stripe[Stripe signed webhook] --> Web
    Monitor[External monitoring] --> Health[Health endpoints]
    Health --> DB
```

| Layer | Implementation |
| --- | --- |
| Web framework | Next.js 16 App Router |
| UI runtime | React 18 and TypeScript |
| Styling | CSS tokens and component styles; Ember & Paper customer surfaces |
| UI primitives | Radix UI, Lucide icons, Sonner and related components |
| Motion | GSAP / React integration; Lenis for selected marketing flows |
| Validation | Zod |
| Persistence | PostgreSQL through `pg`; ordered SQL migrations |
| Customer authentication | Google/GitHub OAuth and opaque server-side sessions |
| Staff authentication | Dedicated Google flow, allowlist and explicit platform role |
| Billing | Stripe checkout, subscription/event processing and local usage/credit ledgers |
| Testing | Vitest, Playwright and axe accessibility tooling |
| Worker deployment | Docker worker; Vercel daemon configuration and systemd example |

Use `package-lock.json` and `npm ci` for the resolved dependency versions. Version ranges in `package.json` are not a deployment manifest by themselves.

```text
src/
  app/                 Public pages, customer/staff layouts and API routes
  components/          Landing, dashboard, staff, authentication and UI components
  core/
    auth/              OAuth, customer sessions and organization selection
    staff/             Staff sessions and permissions
    rbac/              Authorization rules
    scanner/           Engine registry, checks, execution and worker health
    security/          Safe HTTP, IP checks, rate limiting and validation
    targets/           Target registration and ownership verification
    surface/           Crawling and technology discovery
    scheduler/         Scheduled scan dispatch
    monitoring/        Monitoring records and regression detection
    remediation/       Fix catalog and verification
    reporting/         Reports and SARIF
    teams/             Membership and invitations
    mail/              Gmail transport and invitation outbox
    billing/           Plans, entitlements and Stripe operations
    credits/           Credit accounting
    audit/             Audit activity, integrity and readiness assessment
    db/                PostgreSQL access and migrations
  styles/              Shared tokens and stylesheets
scripts/               Development, migrations, provisioning and verification
public/                Served brand assets, fonts and font licence notices
tests/                 Security, regression and browser tests
deploy/                Production environment template and service example
docs/                  Remaining architecture, security and recovery documentation
Dockerfile.worker      Worker container definition
vercel.json            Next.js and scanner daemon configuration
```

## Local installation

### Prerequisites

- Node.js 22 or newer compatible with the locked dependencies; the worker image uses Node.js 22.
- npm and Git.
- PostgreSQL, locally or through a managed provider.
- Google/GitHub OAuth applications for the login methods you intend to test.
- PostgreSQL client tools for backups and restore verification.
- Chrome or Playwright Chromium for browser tests.

On macOS, PostgreSQL client tools can be installed with `brew install libpq`; ensure `pg_dump` and `pg_restore` are on `PATH`.

### Install and configure

```bash
git clone https://github.com/OmvedNagre/Zerivex.git
cd Zerivex
npm ci
```

Create a private `.env.local` in the repository root. Preserve existing settings if the file already exists. The minimum starting configuration is:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CONTACT_EMAIL=zerivex.secure@gmail.com
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/zerivex
SESSION_SECRET=REPLACE_WITH_A_RANDOM_VALUE_AT_LEAST_32_CHARACTERS
GOOGLE_CLIENT_ID=REPLACE_WITH_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=REPLACE_WITH_MATCHING_GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID=REPLACE_WITH_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=REPLACE_WITH_MATCHING_GITHUB_CLIENT_SECRET
```

Generate a session secret locally with:

```bash
openssl rand -base64 32
```

The example contains placeholders, not usable credentials. Keep actual values out of commits, screenshots, support messages and browser-visible variables.

### Initialize and run

```bash
npm run db:migrate
npm run dev
```

Open [localhost:3000](http://localhost:3000). The development launcher starts the web application and worker together; stop them with Ctrl+C. To run them separately, use two terminals:

```bash
npm run dev:web
```

```bash
npm run worker
```

The database is required for real sessions and workflows. Running only the web process does not provide scan execution or invitation email delivery.

## Environment configuration

A safe production placeholder template remains in [`deploy/vercel-production.env.example`](deploy/vercel-production.env.example). There is no root `.env.example`. The tables below cover application and operational configuration; test harnesses may define additional internal variables.

### Application, database and authentication

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Canonical origin. Use `http://localhost:3000` locally and `https://www.zerivex.tech` for the current production domain arrangement. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Public contact address; defaults to `zerivex.secure@gmail.com`. |
| `DATABASE_URL` | Required PostgreSQL connection string; use the provider's appropriate runtime/pooled connection. |
| `DATABASE_DIRECT_URL` | Optional direct connection for administration/migration tooling. |
| `DATABASE_SSL_CA` | Optional trusted CA PEM when the database requires a custom certificate authority. |
| `SESSION_SECRET` | Required high-entropy secret, at least 32 characters. Shared consistently by web and worker. Also protects encrypted temporary OAuth/outbox data. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Matching Google website OAuth client credentials. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Matching GitHub OAuth application credentials. |
| `INITIAL_OWNER_EMAIL` | Explicit bootstrap tooling input; does not automatically promote a user at login. |
| `TRUST_PROXY_HEADERS` | Enable only behind a trusted proxy that replaces forwarded headers. Do not trust client-supplied proxy headers. |
| `NODE_ENV` | Runtime mode; production hosting normally supplies `production`. |
| `PORT` | Web server port where applicable; local default is 3000. |

### Staff access

| Variable | Purpose / default |
| --- | --- |
| `STAFF_PORTAL_ENABLED` | Staff portal switch; defaults to enabled. Authentication and permissions still apply. |
| `STAFF_ALLOWED_EMAILS` | Comma-separated individual staff identities; designated owner is `code64816@gmail.com`. |
| `STAFF_ALLOWED_EMAIL_DOMAINS` | Optional organization-domain allowlist; public consumer domains such as `gmail.com` are rejected. Use individual emails instead. |
| `STAFF_BOOTSTRAP_OWNER_EMAIL` | Explicit staff bootstrap identity; falls back to `INITIAL_OWNER_EMAIL`. |
| `STAFF_SESSION_TTL_MINUTES` | Absolute staff session lifetime; default 480. |
| `STAFF_IDLE_TTL_MINUTES` | Staff idle timeout; default 30. |
| `STAFF_REAUTH_WINDOW_MINUTES` | Recent-authentication window for sensitive operations; default 10. |

### Scanner, worker and invitation email

| Variable | Purpose / default |
| --- | --- |
| `SCANNER_MAX_CONCURRENT_JOBS` | Per-process concurrency setting; default 5, accepted range 1–32. |
| `SCANNER_REQUEST_TIMEOUT_MS` | Scanner request timeout; default 15000, accepted range 100–60000. |
| `SCANNER_MAX_RESPONSE_BYTES` | Response-size bound; default 10485760 bytes, accepted range 1024–10485760. |
| `WORKER_HEALTH_PORT` | Worker health listener; deployment configuration uses 8081. |
| `WORKER_MONITOR_SECRET` | Separate random secret, at least 32 characters, for the protected web worker-health endpoint. |
| `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` | Matching OAuth credentials for the sender connection. Prefer a separate sender client from customer sign-in. |
| `GMAIL_REFRESH_TOKEN` | Sender authorization generated by `npm run mail:connect`. |

### Billing, legal review and tests

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe server key for the selected test/live environment. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this application's Stripe webhook endpoint in the same mode. |
| `LEGAL_OPERATOR_NAME` | Legal/operator identity; current product operator is Zerivex. |
| `LEGAL_JURISDICTION` | Applicable governing country/state, determined by the operator. |
| `LEGAL_POLICIES_APPROVED` | Set `true` only after actual policy review; do not use it to skip unfinished legal work. |
| `TEST_DATABASE_URL` | Disposable PostgreSQL database for integration/browser verification. |
| `PLAYWRIGHT_EXECUTABLE_PATH` | Optional browser executable override for Playwright. |

`NEXT_PUBLIC_` variables are public. Never place database passwords, OAuth secrets, Gmail refresh tokens, Stripe secret keys or session secrets under that prefix. Redis and OpenAI credentials are not prerequisites for the implemented scan queue or deterministic engines; references to these names in defensive self-checks do not mean the services must be configured.

## Google and GitHub authentication

### Register exact callback URLs

| Purpose | Local callback | Production callback |
| --- | --- | --- |
| Google customer login | `http://localhost:3000/api/auth/callback/google` | `https://www.zerivex.tech/api/auth/callback/google` |
| GitHub customer login | `http://localhost:3000/api/auth/callback/github` | `https://www.zerivex.tech/api/auth/callback/github` |
| Google staff login | `http://localhost:3000/api/staff/auth/callback` | `https://www.zerivex.tech/api/staff/auth/callback` |

The requested callback must match the provider registration, including scheme, hostname, port and path. `zerivex.tech` and `www.zerivex.tech` are different origins. Register an additional exact callback if the deployed application uses the apex; avoid wildcard registration. A callback URL belongs under redirect/callback settings, not merely a JavaScript-origin field.

Use a client ID and secret from the **same provider application**. Gmail sender credentials and website login credentials are separate configuration groups, even if an operator has deliberately chosen to reuse a Google client.

### Login implementation

The current source uses single-use server-held OAuth attempts bound to the provider, browser, callback, purpose and expiry. Both customer providers use PKCE. Sensitive temporary values are encrypted, and state/browser bindings are hashed. Successful customer authentication resolves an active account and issues an opaque session whose hash is stored server-side.

Staff login starts at `/staff/login` through its dedicated Google route. It requires a verified provider identity, an allowlist match and an existing active staff role, and issues a separate staff session. It does not create or promote staff accounts.

### Credential diagnostic

```bash
npm run auth:check -- --origin=https://www.zerivex.tech
```

This contacts provider token endpoints with an intentionally invalid authorization code. The expected result is acceptance of the client followed by rejection of the invalid test code. It does not log a real user in or prove that the deployed environment contains the same credentials. No user tokens are issued by this diagnostic.

Migrations `017_oauth_login_attempts.sql` and `018_oauth_staff_purpose.sql` must exist in the target database before deploying the rebuilt routes.

## Owner and staff administration

The designated owner signs in as `code64816@gmail.com`. The address alone is not an authorization bypass.

| Command | Intended use |
| --- | --- |
| `npm run admin:bootstrap` | Explicit customer/platform owner bootstrap subject to the script's safeguards. |
| `npm run staff:bootstrap` | Explicit staff-owner provisioning using the configured bootstrap identity. |
| `npm run owner:provision` | Dry-run inspection for the designated Zerivex owner/workspace operation. |
| `npm run owner:provision -- --apply` | Applies the designated owner, managing-workspace and complimentary-subscription operation. |

The Zerivex-specific provisioning script requires an existing active verified Google identity and an existing owner workspace. It grants the requested staff role, names the managing organization Zerivex and records a ten-year complimentary Enterprise subscription when safe. This is an explicit subscription record, not a role-based entitlement exception. The script refuses to overwrite an incompatible existing Stripe subscription.

Run administrative provisioning only against the intended database. These commands change privileges or commercial records; they are not normal startup steps.

## Invitation email and onboarding

### Connect the sender

1. Enable Gmail API access in the sender's Google Cloud project and configure its OAuth application.
2. Register `http://127.0.0.1:5367/oauth/callback` for the local connection utility.
3. Store its matching `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` privately in `.env.local`.
4. Run `npm run mail:connect`.
5. Open the generated authorization URL and choose **zerivex.secure@gmail.com**.
6. Complete authorization. The utility verifies the sender and saves `GMAIL_REFRESH_TOKEN` in ignored `.env.local` without printing it.
7. Set the same three sender variables in production and restart/redeploy both web and worker.

The connection utility requests identity/email and Gmail send access; it does not request inbox-reading access. It does not send a test invitation. Provider consent/testing status and refresh-token lifecycle must support unattended production delivery.

### Recipient experience

An authorized organization administrator selects an email and role. The application creates an expiring invitation and queues an email with an **Accept the role** button. The recipient does not need a pre-existing Zerivex account: they can sign in/register through an available provider using the exact invited verified email, review the invitation, join the organization and complete team onboarding.

Opening the link alone does not grant access. Acceptance checks token validity, expiry, revocation, recipient identity, role rules, existing membership and available seats. Resending creates a fresh link and invalidates the previous one.

### Delivery behaviour

- Missing sender configuration produces an explicit service-unavailable error.
- The worker processes the persisted encrypted invitation outbox.
- Gmail acceptance is reported as **Sent**, not proof of inbox delivery.
- Ambiguous send failures are not blindly retried, to avoid duplicate messages; use the explicit resend workflow.
- Reply-To and support messages use `zerivex.secure@gmail.com`.
- Rotating `SESSION_SECRET` can invalidate queued encrypted payloads; resend affected invitations after rotation.

## Production deployment

### Release checklist

1. Review and commit the intended source changes. A Vercel redeploy of an old commit updates settings but does not publish unpushed local code.
2. Configure the production environment privately. Keep preview databases and credentials separate from production.
3. Back up the database before schema changes.
4. Apply migrations to the actual deployment database with `npm run db:migrate`.
5. Run the relevant tests, `npm run typecheck` and `npm run build`.
6. Deploy web and worker from the same release with consistent database and session configuration.
7. Confirm HTTPS/domain routing and exact provider callback registrations.
8. Confirm process readiness, worker heartbeat, queue processing and email delivery.
9. Exercise real customer/staff login and a consenting recipient's invitation acceptance.
10. Connect external monitoring and verify alerts and restore procedures.

### Vercel

The repository's `vercel.json` declares a Next.js project and one `scanner` daemon instance in `bom1`, built from `Dockerfile.worker`. Its liveness probe targets `/health` on port 8081, with a 30-second initial delay and a 300-second termination grace period.

Confirm that the selected Vercel account, plan, region and daemon service support this configuration. A successful web deployment alone does not establish that the daemon built, started or is processing jobs. Set shared worker configuration explicitly and inspect its logs/heartbeats.

After changing environment variables, create a new deployment. After changing source code, deploy the new commit rather than simply rebuilding an older production deployment.

### Other supervised hosting

For a conventional Node.js host:

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

Run `npm run worker` as a separate supervised process with the same release/environment. [`deploy/zerivex-worker.service`](deploy/zerivex-worker.service) provides a service example; adapt paths, user and environment for the host.

The worker image can be built separately:

```bash
docker build -f Dockerfile.worker -t zerivex-worker .
```

Provide secrets at runtime through the hosting platform. Never copy private environment files or backups into an image. Start with one worker and deliberately validate capacity, database leases and failure behaviour before increasing replicas; per-process concurrency is not a fleet-wide quota.

### Stripe and legal readiness

Point Stripe's signed webhook at `/api/billing/webhook`. Configure the selected mode's secret key and webhook signing secret. The event implementation lives in [`src/core/billing/billing-operations.ts`](src/core/billing/billing-operations.ts).

Test checkout, subscription changes, invoices, cancellations, duplicate deliveries and failed-event handling before enabling live payments. Simulated local checkout does not grant a paid subscription. Unsigned webhooks are rejected.

Legal pages remain drafts until the operator identity, governing jurisdiction and actual approval are configured. Production paid checkout checks legal readiness. Legal review, payment availability and production monitoring are operational responsibilities, not consequences of passing a build.

## API and integrations

Representative routes are listed below. They are not anonymous/public access promises: authentication, organization scope, role, plan and verification requirements vary by endpoint. Inspect the route implementation before writing a client.

| Area | Representative routes |
| --- | --- |
| Customer authentication | `/api/auth/login/[provider]`, `/api/auth/callback/[provider]`, `/api/auth/session`, `/api/auth/logout` |
| Staff authentication | `/api/staff/auth/login`, `/api/staff/auth/callback` |
| Targets | `/api/targets`, `/api/targets/[id]/verify`, `/api/targets/[id]/surface` |
| Scans and reports | `/api/scans`, `/api/scans/[id]`, `/api/scans/[id]/report` |
| CI/CD | `/api/v1/ci/scan`, `/api/v1/ci/scans/[id]`, `/api/v1/ci/scans/[id]/summary`, `/api/v1/ci/scans/[id]/sarif` |
| Scheduling and quality gates | `/api/schedules`, `/api/quality-gates` |
| Integrations | `/api/api-keys`, `/api/webhooks` |
| Billing | `/api/billing`, `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook` |
| Audit and operations | `/api/audit-vault`, `/api/staff/queue`, `/api/health/worker` |

On Vercel, CI scan creation must use `wait: false` and poll the returned `pollUrl`; the route rejects synchronous waiting there so scan execution remains in the worker.

API keys and webhook signing secrets must remain private. Outgoing webhooks use signing controls; receiving integrations should verify signatures before processing payloads. SARIF and audit exports are plan/permission gated. A web report is not evidence of a certified compliance audit.

## Testing and verification

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript validation. |
| `npm test` | Vitest suites; database-dependent coverage needs the corresponding test configuration. |
| `npm run test:watch` | Interactive Vitest watch mode. |
| `npm run test:security` | Tests under `tests/security`. |
| `npm run test:postgres` | PostgreSQL availability/configuration diagnostic. |
| `npm run test:integration` | Database-backed regression suite using a disposable test database. |
| `npm run test:e2e` | Desktop/mobile browser workflows and accessibility checks. |
| `npm run build` | Production compilation and route build. |
| `npm run project:status` | Safe configuration/database status summary. |
| `npm run launch:check` | Launch/configuration checks; not independent production certification. |
| `npm run auth:check` | Provider client diagnostic using invalid test codes. |

Use a dedicated `TEST_DATABASE_URL` for integration and browser tests. These harnesses also support explicit temporary-schema operation on the configured database:

```bash
npm run test:integration -- --temporary-schema
npm run test:e2e -- --temporary-schema
```

They create and remove their own schemas rather than truncate application tables. The database account needs schema-creation privileges. Prefer a disposable test database even when schema isolation is available.

Install Chromium where needed:

```bash
npx playwright install chromium
```

The browser configuration defaults to installed Google Chrome on macOS and Playwright Chromium elsewhere; `PLAYWRIGHT_EXECUTABLE_PATH` can override the executable. Browser fixtures exercise application flows, not real Google/GitHub provider consent or actual inbox receipt. Complete those acceptance checks separately.

Do not treat a historical test count as a release criterion. Run checks against the exact commit and configuration being deployed, and record material failures or skipped external checks.

## Operations and recovery

### Health and monitoring

| Probe | Meaning |
| --- | --- |
| `/api/health/live` | Web process liveness. |
| `/api/health/ready` | Dependency readiness, including database connectivity. |
| `/api/health` | Broader application/queue health summary. |
| `/api/health/worker` | Protected worker-health assessment; use `Authorization: Bearer <WORKER_MONITOR_SECRET>`. |
| Worker port 8081 `/health` | Container-local worker probe used by deployment configuration. |

A live web process is not proof of a healthy scanner. Monitor worker heartbeats while idle, queue age, overdue work, failures, invitation dispatch, billing-event failures and backup status. Configure an external monitor with alert delivery; a dashboard status display is not external monitoring.

Jobs interrupted beyond their permitted execution window fail rather than silently repeating intrusive scans. Investigate the failure and use an intentional retry/new scan where appropriate.

### Backups

```bash
npm run db:backup -- --verify-restore
```

The backup command creates a custom-format PostgreSQL backup. Restore verification uses a temporary database and compares table row counts before cleanup; the account must have `CREATE DATABASE` permission. Verification establishes useful restore evidence, not every application-level invariant.

`.backups/` contains sensitive application data and is ignored by Git. Store encrypted copies independently of the application host, restrict access and apply an explicit retention policy.

### Recovery

1. Preserve the failed environment and relevant redacted logs.
2. Create a separate empty PostgreSQL database.
3. Restore the selected backup with `pg_restore --exit-on-error --no-owner --no-acl` and the appropriate connection options.
4. Validate schema, record counts, account access and representative workflows.
5. Switch web and worker to the restored database during a controlled maintenance window.
6. Recheck OAuth sessions, queue state, monitoring and integrations before reopening normal traffic.

Do not restore over a running application database. Keep the pre-migration backup until the release has been validated. Review the remaining recovery runbook against actual schema and infrastructure before executing its commands.

### Secret rotation

Coordinate rotation across web, worker and provider settings. Session-secret rotation affects encrypted temporary OAuth attempts and invitation outbox payloads; plan recovery/resend behaviour. Database password changes require updating every process that connects. Stripe webhook secrets belong to specific endpoints/modes. Never remove a Gmail client secret without considering the sender connection using it.

## Troubleshooting

| Symptom | Checks |
| --- | --- |
| Google `redirect_uri_mismatch` | Compare the requested URI with the registration on the exact client ID in use; check `www`, HTTPS, port and callback path. |
| Google token exchange HTTP 401 | Verify the matching client ID/secret pair, environment selection and that a new deployment loaded the changes. |
| GitHub redirect warning | Correct the OAuth application's callback registration for the actual website origin. |
| Login loops or invalid state | Begin a fresh login; check host consistency, cookies, session secret, attempt expiry and OAuth migrations. |
| Staff login denied | Check the verified Google identity, staff allowlist, existing active platform role and separate staff login route. |
| Invitation sender not connected | Configure all three Gmail variables, authorize the designated sender and restart web/worker. |
| Invitation marked Sent but not received | Check recipient/spam/provider behaviour; Gmail acceptance is not an inbox-delivery receipt. |
| Invitation recipient rejected | Sign in with the exact invited verified email; check expiry, revocation, replacement link and seat availability. |
| Scan stays queued | Inspect worker logs/heartbeats, database configuration, job age and deployment release consistency. |
| Active engine locked | Check plan entitlement, verified target scope, scan mode and required discovered inputs. |
| Health endpoint fails | Inspect dependency/worker diagnostics and redacted runtime logs; distinguish readiness from liveness. |
| UI changes absent after redeploy | Confirm the new source commit was pushed and deployed; rebuilding an old commit cannot publish local edits. |
| Database TLS error | Use the correct provider connection/CA and certificate validation; do not disable production TLS verification as a workaround. |
| Checkout unavailable | Check Stripe mode/keys, legal approval and application readiness. |

Share only sanitized error messages and correlation references when troubleshooting. Omit OAuth codes, tokens, cookies, connection strings and secrets.

## Development guidance

- Keep authentication, platform permissions, commercial entitlements and organization membership separate.
- Never reintroduce localhost login bypasses, automatic owner promotion or fabricated scan findings.
- Treat the engine registry and plan configuration as the application sources of truth.
- Preserve ordered database migrations; removing old planning documents does not justify removing migration history.
- Keep customer/staff session boundaries and target ownership checks covered by regression tests.
- Verify UI changes at desktop and mobile widths, including contrast, overflow, dialogs and keyboard access.
- Keep font licence notices and source asset provenance where appropriate.
- Before changing Next.js APIs, read the relevant installed documentation under `node_modules/next/dist/docs/`, as required by `AGENTS.md`.
- Keep credentials in ignored local files or hosting secret storage. Do not commit `.env.local`, backups or generated reports containing private data.

For product/support enquiries, contact [zerivex.secure@gmail.com](mailto:zerivex.secure@gmail.com).
