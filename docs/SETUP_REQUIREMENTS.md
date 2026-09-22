# Zerivex: Setup Requirements & External Dependency Discovery

> **Project:** ZERIVEX  
> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Current Phase:** PHASE 0A — PRE-IMPLEMENTATION DISCOVERY  
> **Status:** READY_FOR_REVIEW  

---

## 1. Master External Dependency Matrix

| Requirement | Recommended Provider | Alternatives | Required Phase | Dev Required | Production Required | Owner Action | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Database** | **Neon** (Serverless PostgreSQL) | Local PostgreSQL (Docker), Supabase PostgreSQL, AWS RDS Aurora | **Phase 1** | YES | YES | Provision PostgreSQL database & set `DATABASE_URL` in `.env.local` | **PENDING** |
| **OAuth (Google)** | **Google Cloud Console** (OAuth 2.0 / OIDC) | Auth0, Clerk (rejected: vendor lock-in) | **Phase 2** | YES (Mock available) | YES | Create OAuth 2.0 Web Client, add redirect URIs, set credentials | **PENDING** |
| **OAuth (GitHub)** | **GitHub Developer Settings** (OAuth Apps) | Auth0 (rejected) | **Phase 2** | YES (Mock available) | YES | Register GitHub OAuth App, add callback URL, set credentials | **PENDING** |
| **Domain & DNS** | **Cloudflare DNS** | Route53, Namecheap, Vercel DNS | **Phase 3** (Target Verif) | NO (Mocked) | YES | Delegate domain nameservers & configure DNS verification TXT records | **PENDING** |
| **Queue / Worker** | **In-Process Worker Queue** (MVP) | Redis / BullMQ, AWS SQS | **Phase 4** (Scanner MVP) | YES (In-Process) | NO (Redis for scale) | None for Phase 4; Redis instance provisioned in Phase 14 | **PLANNED** |
| **Email (Transactional)** | **Resend** or **Postmark** | SendGrid, AWS SES | **Phase 5** (Alerts) | NO (Console logs) | YES | Create account, verify sending domain, set API key | **OPTIONAL** |
| **Object Storage** | **Cloudflare R2** | AWS S3, MinIO (local dev) | **Phase 5** (Reports/Evidence) | NO (Database JSON) | YES | Create bucket, configure credentials, set bucket policies | **OPTIONAL** |
| **Payments / Billing** | **Stripe** | LemonSqueezy, Paddle | **Phase 11** (Billing) | NO | YES | Create Stripe account, create webhook endpoint, set price IDs | **PLANNED** |
| **Monitoring / APM** | **Sentry** | Baselime, Datadog, OpenTelemetry | **Phase 14** (Hardening) | NO | YES | Create Sentry project, configure DSN & sensitive data scrubbing | **PLANNED** |
| **Logging & Egress** | **Node.js Structured Logger + Cloudflare WAF** | Datadog, Axiom | **Phase 14** (Hardening) | YES (Console JSON) | YES | Configure WAF rules, rate limits, and egress worker firewall | **PLANNED** |

---

## 2. Granular Dependency Analysis

### GROUP A — Database (Canonical PostgreSQL)

- **PURPOSE:** Multi-tenant relational storage for organizations, users, identities, sessions, projects, targets, verifications, scans, findings, evidence, and tamper-evident append-only audit logs.
- **RECOMMENDED:** **Neon Serverless PostgreSQL** (or local PostgreSQL via Docker for 100% offline local development).
- **WHY:** 
  - Standard PostgreSQL 16+ engine with strict relational constraints (foreign keys, cascading rules, JSONB for evidence).
  - Native connection pooling for serverless/edge connection safety.
  - Native SSL encryption in transit (`sslmode=require`).
  - No behavioral deviations between local and production.
- **ALTERNATIVES:**
  1. *Local Docker PostgreSQL:* `docker run --name zerivex-postgres -e POSTGRES_PASSWORD=zerivex -p 5432:5432 -d postgres:16-alpine` (Zero cost, offline).
  2. *Supabase PostgreSQL:* Managed Postgres with built-in connection pooler.
  3. *AWS RDS / Aurora PostgreSQL:* Enterprise standard, higher operational overhead.
- **REQUIRED NOW (Phase 1):** **YES**.
- **ESTIMATED COMPLEXITY:** LOW.
- **WHAT THE OWNER MUST CREATE:**
  1. Create a project at [Neon](https://neon.tech) or spin up a local PostgreSQL container.
  2. Ensure a database named `zerivex` exists.
- **WHAT THE OWNER MUST CONFIGURE (in `.env.local` only):**
  - `DATABASE_URL`: `postgresql://user:password@ep-xyz.neon.tech/zerivex?sslmode=require`
- **SECURITY IMPLICATIONS:**
  - TLS enforced on all connections.
  - Direct database access restricted to backend servers only.
  - No database passwords ever pasted into chat or committed to Git.
- **COST:** Free tier on Neon / $0 for local Docker.

---

### GROUP B — Authentication (OAuth 2.0 / OIDC Providers)

#### 1. Google OAuth 2.0 / OpenID Connect
- **PURPOSE:** Secure enterprise & developer sign-in, email verification, and one-time owner bootstrap.
- **RECOMMENDED:** **Google Cloud Console** (APIs & Services $\rightarrow$ Credentials $\rightarrow$ OAuth 2.0 Client IDs).
- **WHY:** High trust, built-in MFA/passkeys on Google accounts, cryptographic OpenID tokens with verified email claims.
- **REQUIRED IN PHASE:** Phase 2 (Live Auth). *Note: Phase 1 & 2 automated tests use an internal Mock OAuth Provider to run hermetically offline.*
- **WHAT THE OWNER MUST CREATE:**
  1. Google Cloud Console $\rightarrow$ APIs & Services $\rightarrow$ Credentials.
  2. Create an **OAuth 2.0 Client ID** (Application type: *Web application*).
  3. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`.
- **WHAT THE OWNER MUST CONFIGURE (in `.env.local` only):**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`

#### 2. GitHub OAuth
- **PURPOSE:** Developer identity provider, repository integration readiness.
- **RECOMMENDED:** **GitHub Developer Settings** (Settings $\rightarrow$ Developer settings $\rightarrow$ OAuth Apps).
- **WHY:** Standard for software engineers and security researchers; supports verified primary email retrieval via `/user/emails`.
- **REQUIRED IN PHASE:** Phase 2 (Live Auth).
- **WHAT THE OWNER MUST CREATE:**
  1. GitHub $\rightarrow$ Settings $\rightarrow$ Developer settings $\rightarrow$ OAuth Apps $\rightarrow$ *New OAuth App*.
  2. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`.
- **WHAT THE OWNER MUST CONFIGURE (in `.env.local` only):**
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`

#### 3. Owner Bootstrap Email
- **PURPOSE:** Transactional one-time promotion of the platform owner account.
- **WHAT THE OWNER MUST CONFIGURE (in `.env.local` only):**
  - `INITIAL_OWNER_EMAIL`: The verified email matching the owner's Google or GitHub account.

---

### GROUP C — Domain, DNS & Target Verification (Phase 3)

- **PURPOSE:** Hosting apex domain (`zerivex.com`), SSL termination, and testing DNS TXT target ownership verification.
- **RECOMMENDED:** **Cloudflare DNS**.
- **WHY:** Sub-minute propagation speed, enterprise DDoS protection, and DNS API for verification checks.
- **REQUIRED IN PHASE:** Phase 3 (Domain Verification). Local tests will mock DNS queries using `node:dns` test fixtures.
- **OWNER ACTION:** None for Phase 0-2.

---

### GROUP D — Scanner Queue & Worker Infrastructure (Phase 4)

- **PURPOSE:** Decoupling long-running HTTP scans from the web request/response lifecycle.
- **RECOMMENDED:** 
  - **Phase 4 (MVP):** In-Process Async Job Queue with concurrency limits and timeout cancellation.
  - **Phase 14 (Production):** Distributed Redis / BullMQ with dedicated isolated worker containers.
- **WHY:** In-process queue eliminates external infrastructure overhead during MVP while preserving clean worker interface abstractions.
- **REQUIRED IN PHASE:** Phase 4.

---

### GROUP E — Error Tracking, Observability & Hardening (Phase 14)

- **PURPOSE:** Exception monitoring with strict sensitive data scrubbing (redacting authorization headers, cookies, tokens).
- **RECOMMENDED:** **Sentry**.
- **REQUIRED IN PHASE:** Phase 14 (Production Hardening). Phase 0-5 uses structured JSON console logging.

---

### GROUP F — Payments & Billing (Phase 11)

- **PURPOSE:** Subscription plans, credit ledgers, automated webhook signature verification.
- **RECOMMENDED:** **Stripe**.
- **REQUIRED IN PHASE:** Phase 11. Core authorization and owner entitlement logic in Phase 1-5 operates independently of external billing providers via the entitlement engine abstraction.

---

## 3. Owner Action Checklist: Phase 0B Provisioning

Before Phase 1 execution can begin, complete this checklist:

- [ ] **1. Node.js Verification:** Ensure Node.js 20+ LTS is active (`node -v`).
- [ ] **2. PostgreSQL Provisioning:**
  - Create Neon project or start local Docker PostgreSQL.
  - Verify database connection string.
- [ ] **3. Local Environment Configuration (`.env.local`):**
  - Copy `.env.example` to `.env.local` in project root.
  - Fill in `DATABASE_URL` (local or Neon).
  - Generate a secure 32-byte secret: `openssl rand -base64 32` and set `SESSION_SECRET`.
  - Set `INITIAL_OWNER_EMAIL` to your intended platform owner email address.
- [ ] **4. Verification without Secret Leakage:**
  - Confirm `.env.local` exists and contains no empty required fields for Phase 1.
  - Do NOT share the contents of `.env.local` in the chat.
