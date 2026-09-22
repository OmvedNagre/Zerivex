# Zerivex: Pre-Implementation Setup & External Dependencies

> **Project:** ZERIVEX  
> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Phase:** 0A — Pre-Implementation Discovery  
> **Status:** PENDING OWNER PROVISIONING

---

## 1. Master Service Dependency Matrix

| Requirement | Recommended Provider | Why | Required Phase | Complexity | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Database** | **Neon** (Serverless PostgreSQL) or **Local/Self-hosted PostgreSQL** | Fully compliant PostgreSQL with connection pooling, branching, strict relational integrity, UUIDv4, and SSL enforcement. | **Phase 1** (Required Now) | Low | **PENDING** |
| **Google OAuth** | **Google Cloud Console (OAuth 2.0 / OIDC)** | Enterprise-grade OIDC authentication, supports Authorization Code Flow with PKCE, email verification metadata. | **Phase 2** (Required for Live Auth) | Low | **PENDING** |
| **GitHub OAuth** | **GitHub Developer Settings (OAuth Apps)** | Standard developer identity provider, verified primary email API, essential for developer-focused security SaaS. | **Phase 2** (Required for Live Auth) | Low | **PENDING** |
| **Domain & DNS** | **Cloudflare DNS** or Owner's Registrar | DNS TXT and CNAME management for target ownership verification testing and apex domain hosting. | **Phase 3** (Target Verif) / Prod | Low | **PENDING** |
| **Queue / Worker** | **In-Process Worker Queue** (MVP) $\rightarrow$ **BullMQ / Redis** | Simplest architecture for Phase 4 MVP without external cloud infrastructure; upgrades to Redis worker isolation. | **Phase 4** (MVP In-Process) | Medium | **PLANNED** |
| **Email (Transactional)** | **Resend** or **Postmark** | High deliverability, clean developer API, no secret leak vectors in URL callbacks. | **Phase 5** (Alerts/Reports) | Low | **OPTIONAL** |
| **Object Storage** | **Cloudflare R2** or **AWS S3** | S3-compatible, zero egress fees (R2), ideal for encrypted PDF reports and large scan evidence snapshots. | **Phase 5** (Reports) | Medium | **OPTIONAL** |
| **Monitoring & Sentry** | **Sentry** | Full-stack exception tracking, sensitive data scrubbing (sanitizing tokens/passwords), performance tracing. | **Phase 14** (Hardening) | Low | **OPTIONAL** |
| **Payments / Billing** | **Stripe** | Global compliance, customer portal, webhook signature verification, provider-agnostic billing abstraction. | **Phase 11** (Billing) | Medium | **PLANNED** |

---

## 2. Grouped Requirements & Provisioning Instructions

### GROUP A — Database (PostgreSQL)

- **SERVICE:** Relational Database
- **PURPOSE:** Multi-tenant user accounts, sessions, organizations, projects, scan jobs, deterministic findings, evidence, immutable audit logs.
- **RECOMMENDED:** **Neon Serverless PostgreSQL** (or local PostgreSQL `postgresql://postgres:postgres@localhost:5432/zerivex` for offline local development).
- **WHY:** 
  - Standard PostgreSQL 16+ engine with strict relational constraints (foreign keys, cascading rules, JSONB for evidence).
  - Built-in connection pooling for serverless/edge environments.
  - Native SSL encryption in transit (`sslmode=require`).
- **ALTERNATIVES:**
  1. Supabase PostgreSQL (Managed Postgres, pgbouncer built-in)
  2. AWS Aurora PostgreSQL (Enterprise-grade, higher cost/complexity)
  3. Local Docker PostgreSQL (`docker run --name zerivex-postgres -e POSTGRES_PASSWORD=... -p 5432:5432 -d postgres:16-alpine`)
- **REQUIRED NOW:** **YES** (Phase 1 cannot initialize tables without a connection string).
- **ESTIMATED COMPLEXITY:** LOW.
- **WHAT THE OWNER MUST CREATE:**
  1. Create a project at [Neon](https://neon.tech) or start a local/managed PostgreSQL database instance.
  2. Create a database named `zerivex`.
- **WHAT THE OWNER MUST PROVIDE / CONFIGURE:**
  - `DATABASE_URL`: The pooled connection string (e.g. `postgresql://user:password@ep-xyz.neon.tech/zerivex?sslmode=require`).
  - *Never paste production passwords in AI chat! Store directly in `.env.local`.*
- **WHERE IT WILL BE USED:** Core database client (`src/core/db/`).
- **SECURITY CONSIDERATIONS:** 
  - Connections must enforce TLS/SSL.
  - Direct database access restricted to backend servers only (never exposed publicly).
  - Database user credentials must follow least privilege once production migrations stabilize.

---

### GROUP B — Authentication (OAuth Providers)

#### 1. Google OAuth 2.0 / OpenID Connect
- **SERVICE:** Social & Enterprise Identity Provider
- **PURPOSE:** Safe user onboarding, email verification, and one-time owner bootstrap.
- **RECOMMENDED:** **Google Cloud Console** (APIs & Services $\rightarrow$ Credentials $\rightarrow$ OAuth 2.0 Client IDs).
- **WHY:** High trust, built-in MFA/passkeys on Google side, verified email claim in OpenID tokens.
- **ALTERNATIVES:** Auth0, Clerk, AWS Cognito (Avoided to maintain direct server-side session ownership and avoid vendor lock-in).
- **REQUIRED NOW:** Required for Phase 2 (Live OAuth verification). For automated Phase 1 tests, a built-in mock OAuth adapter will be used.
- **ESTIMATED COMPLEXITY:** LOW.
- **WHAT THE OWNER MUST CREATE:**
  1. Go to Google Cloud Console $\rightarrow$ APIs & Services $\rightarrow$ Credentials.
  2. Create an **OAuth 2.0 Client ID** (Application type: *Web application*).
  3. Authorized JavaScript origins: `http://localhost:3000` (and production domain when deployed).
  4. Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google` (and `https://<domain>/api/auth/callback/google`).
- **WHAT THE OWNER MUST PROVIDE / CONFIGURE:**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET` (Store in `.env.local`)
- **SECURITY CONSIDERATIONS:**
  - Enforce Authorization Code Flow with PKCE and state/nonce validation.
  - Client secret must never be exposed to the browser.

#### 2. GitHub OAuth
- **SERVICE:** Developer Identity Provider
- **PURPOSE:** Primary login for developers, repository integration readiness.
- **RECOMMENDED:** **GitHub Developer Settings** (Settings $\rightarrow$ Developer settings $\rightarrow$ OAuth Apps).
- **WHY:** Ubiquitous among software engineers and security researchers; supports verified primary email retrieval.
- **REQUIRED NOW:** Required for Phase 2 (Live OAuth).
- **ESTIMATED COMPLEXITY:** LOW.
- **WHAT THE OWNER MUST CREATE:**
  1. Go to GitHub $\rightarrow$ Settings $\rightarrow$ Developer settings $\rightarrow$ OAuth Apps $\rightarrow$ *New OAuth App*.
  2. Application name: `Zerivex Security`
  3. Homepage URL: `http://localhost:3000`
  4. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
- **WHAT THE OWNER MUST PROVIDE / CONFIGURE:**
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET` (Store in `.env.local`)
- **SECURITY CONSIDERATIONS:**
  - Must explicitly query the `/user/emails` endpoint and only trust emails marked `verified: true` and `primary: true`.

#### 3. Owner Bootstrap Email
- **PURPOSE:** Configures the initial platform OWNER for one-time transactional promotion.
- **RECOMMENDED:** Owner's personal or company email (matching their Google or GitHub verified email).
- **CONFIGURED AS:** `INITIAL_OWNER_EMAIL` in `.env.local`.

---

### GROUP C — Deployment & Runtime Environment

- **SERVICE:** Production Application & API Hosting
- **PURPOSE:** Running Next.js server, API endpoints, background jobs, and serving web assets.
- **RECOMMENDED:** **Vercel** (for web app / dashboard) + **Dedicated Node.js Worker** (Docker / Railway / Fly.io for isolated scanning tasks).
- **WHY:** Next.js native optimization, fast edge delivery, automatic SSL, serverless scalability.
- **ALTERNATIVES:**
  1. Single Docker container on Railway / Render / AWS ECS (simpler unified deployment).
  2. Self-hosted VPS with Docker Compose and Nginx reverse proxy.
- **REQUIRED NOW:** NO (Local development runs on Node.js 20+).
- **ESTIMATED COMPLEXITY:** MEDIUM.
- **WHAT THE OWNER MUST CREATE:**
  - Create project on chosen hosting platform when reaching Phase 14 (Production Hardening).

---

### GROUP D — Domain & DNS

- **SERVICE:** Domain Name & DNS Management
- **PURPOSE:** Application URL (`zerivex.com`), SSL certificates, and DNS TXT target verification testing.
- **RECOMMENDED:** **Cloudflare** (free tier).
- **WHY:** Fast DNS propagation (under 60 seconds), automated TLS, DDoS protection, edge security headers.
- **REQUIRED NOW:** NO for Phase 1; needed for Phase 3 target verification testing.
- **ESTIMATED COMPLEXITY:** LOW.

---

### GROUP E — Error Tracking & Observability (Phase 14)

- **SERVICE:** Application Monitoring & Error Tracking
- **RECOMMENDED:** **Sentry** (Developer tier).
- **WHY:** Automatic error capture, stack trace decoding, and built-in data scrubbing rules (redacting authorization headers, cookies, and tokens).
- **REQUIRED NOW:** NO (Console structured logging used in Phase 0-4).

---

### GROUP F — Payments & Billing (Phase 11)

- **SERVICE:** Subscription Management & Credit Ledger
- **RECOMMENDED:** **Stripe**.
- **WHY:** Industry gold standard, clean webhook signature verification (`stripe-signature`), hosted Customer Portal, sandbox test environment.
- **REQUIRED NOW:** NO (Abstract billing interface built in Phase 1; live provider wired in Phase 11).

---

## 3. Owner Provisioning Action Checklist

### Phase 1 Immediate Prerequisites
- [ ] **1. Node.js Environment**: Verify Node.js v20+ LTS is installed on developer workstation (`node -v`).
- [ ] **2. Database Connection**: 
  - Option A: Create a free PostgreSQL instance on [Neon](https://neon.tech) and copy connection URL.
  - Option B: Run local PostgreSQL via Docker: `docker run --name zerivex-db -e POSTGRES_PASSWORD=zerivex -p 5432:5432 -d postgres:16-alpine`.
- [ ] **3. Environment File Configuration**:
  - Copy `.env.example` to `.env.local`.
  - Set `DATABASE_URL` in `.env.local`.
  - Generate a secure 32-byte secret: `openssl rand -base64 32` and set `SESSION_SECRET` in `.env.local`.
  - Set `INITIAL_OWNER_EMAIL` to your intended owner email address.
- [ ] **4. OAuth Credentials (for Phase 2)**:
  - Register Google OAuth credentials.
  - Register GitHub OAuth credentials.
  - Add client IDs and secrets to `.env.local`.

---

## 4. Security Boundaries for Credentials

1. **NO SECRETS IN CHAT:** Under no circumstances should database passwords, OAuth secrets, or session keys be pasted into this conversation.
2. **LOCAL STORAGE ONLY:** All secrets must reside exclusively in `/Users/omvednagre/Desktop/Zerivex/.env.local` (which is git-ignored).
3. **MOCK FALLBACK FOR CI/TESTS:** For automated test suites, the platform provides in-memory mock adapters so tests can execute 100% deterministically and offline without live external API keys.
