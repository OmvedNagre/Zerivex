# ZERIVEX — COMPLETE CODEBASE SYSTEM & DYNAMIC UI ARCHITECTURE SPECIFICATION
**Document Identifier:** SPEC-ZX-SYSTEM-UI-2026-V1  
**Project Base:** [ZERIVEX Autonomous Application Security Fleet](file:///Users/omvednagre/Desktop/Zerivex)  
**Location:** `findings/ZERIVEX_SYSTEM_AND_UI_ARCHITECTURE_SPEC.md`  
**Generated Date:** October 2026  
**Scope:** Complete Codebase Scan (Backend Services, Scanner Engines, Target Ownership, Remediation Catalog, CI/CD, Audit Vault, RBAC, Billing) + Complete Frontend Design System (Ember & Paper Design System Tokens, Components, Layouts, Dynamic Adapters, No-Hardcoding Contract).

---

## 1. Executive Summary & Core Platform Philosophy

**ZERIVEX** is an autonomous, continuous application security platform built for modern engineering teams and software developed with AI coding assistants (Cursor, Lovable, v0, Bolt, Claude Code). 

### 1.1 The Problem Zerivex Solves
AI code assistants prioritize rapid feature generation, regularly hallucinating insecure defaults: hardcoding raw secrets in client-side bundles, disabling CORS checks, leaving unauthenticated server actions, and bypassing SQL escaping. Traditional dynamic application security testing (DAST) scanners flood developers with dozens of synthetic false positives and opaque alerts.

### 1.2 Zerivex Design Pillars
1. **100% Deterministic Security**: Every check rule (`ZX-*`) is backed by deterministic evidence evaluation. If a vulnerability is reported, reproducible HTTP proof and redacted evidence payloads are captured.
2. **Cryptographic Target Ownership**: No active scans or invasive probes can be run against a target until cryptographic ownership is mathematically proven via DNS TXT records, HTTP headers, or HTML meta tags.
3. **SSRF Egress Guardrails**: Outbound scanner requests pass through an active egress firewall with socket-level DNS pinning to guarantee the scanner itself cannot be weaponized for Server-Side Request Forgery or internal cloud metadata exfiltration.
4. **Code-Level Multi-Framework Remediation**: Instead of vague advice, every finding provides exact before/after code diffs for **Next.js**, **Express**, and **Nginx**, alongside instant CLI verification commands and on-demand automated re-testing.
5. **No Hardcoded UI (Dynamic-First Architecture)**: The frontend is **not a static brochure**. Every metric, badge, finding table, target row, and remediation diff is derived dynamically from backend models, database ledgers, and typed adapter functions.

---

## 2. Complete Backend Service & Capabilities Inventory (What We Offer)

The backend is organized into high-cohesion, isolated domain modules under `src/core/`. Below is the complete catalog of all services, engines, models, and security guarantees.

```
src/core/
├── academy/         # Interactive security playbooks, AI pitfalls, and test quizzes
├── agency/          # Multi-client agency management, white-label branding, portfolio metrics
├── audit/           # Tamper-evident immutable compliance audit vault, RFC 4180 CSV / SIEM JSON
├── auth/            # OAuth providers, cryptographic session tokens, API keys (zx_live_*)
├── billing/         # Stripe integration, subscription tiers, usage quota ledgers
├── cicd/            # Quality gate engine, OASIS SARIF v2.1.0 generator, PR markdown summaries
├── collaboration/   # Finding comments, multi-engineer threads, assignee tracking
├── config/          # Centralized environment variable validation and runtime constants
├── db/              # Neon PostgreSQL connection pool, schema migrations (001-007)
├── monitoring/      # Score regression detector (drop >= 10), alert repository
├── observability/   # Structured logging, timing metrics, scan telemetry
├── rbac/            # 5-tier role-based access control, permission evaluation guard
├── remediation/     # 31-rule remediation catalog, multi-framework diffs, fix verifier
├── reporting/       # Executive summary generator, technical PDF/HTML reports
├── scanner/         # Scan runner, worker pool, 14 check engines, rate limiter, redactor
├── scheduler/       # Cron evaluator, automated recurring scan schedules
├── security/        # Egress firewall, private IP validator, socket DNS pinning, safe HTTP
├── surface/         # Attack surface crawler, endpoint mapper, technology fingerprinting
├── targets/         # Cryptographic target verification service, domain resolvers
├── teams/           # Team membership, token-hashed invitations, ownership transfer
└── webhooks/        # Event-driven webhooks, HMAC SHA-256 signing, delivery log
```

---

### 2.1 Deterministic Scanner Battery (14 Check Engines)
Located in `src/core/scanner/checks/`, every engine implements the typed `ScanCheck` interface:
* `id`: Unique identifier (e.g., `check-tls`, `check-sqli`).
* `name`: Descriptive human-readable check name.
* `mode`: Required permission level (`PUBLIC_PASSIVE` or `VERIFIED_ACTIVE`).
* `run(context: ScanContext): Promise<RawFinding[]>`.

| Check Engine File | Rule ID Prefix | Mode | What It Tests & Detects | Severity Range |
| :--- | :--- | :--- | :--- | :--- |
| `tls-check.ts` | `ZX-TLS-*` | PASSIVE | Cleartext HTTP (port 80), TLS 1.0/1.1 deprecation, SSL certificate expiration, cipher weakness, missing HTTPS redirect. | HIGH to CRITICAL |
| `headers-check.ts` | `ZX-HDR-*` | PASSIVE | Missing or misconfigured defensive headers: HSTS (`Strict-Transport-Security`), CSP (`Content-Security-Policy`), `X-Frame-Options` (Clickjacking), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. | LOW to MEDIUM |
| `cors-check.ts` | `ZX-CORS-*` | PASSIVE | Insecure Cross-Origin Resource Sharing: Wildcard origin `*` paired with `Access-Control-Allow-Credentials: true`, dynamic origin reflection, `null` origin trust. | HIGH |
| `cookies-check.ts` | `ZX-CKI-*` | PASSIVE | Sensitive session cookies missing `Secure`, `HttpOnly`, or proper `SameSite` (`Strict`/`Lax`) attributes. | MEDIUM |
| `security-txt-check.ts`| `ZX-SEC-SECTXT-*`| PASSIVE | Compliance with RFC 9116: Missing `/.well-known/security.txt`, expired security contact, missing PGP encryption key or canonical URI. | INFORMATIONAL |
| `exposed-secrets-check.ts`| `ZX-SEC-*` | PASSIVE | Client-side bundles and public assets containing leaked tokens: AWS access keys, Stripe secret keys (`sk_live_...`), GitHub tokens, OpenAI/Anthropic API keys, private RSA keys. | CRITICAL |
| `http-methods-check.ts`| `ZX-SEC-VERB-*` | PASSIVE | Dangerous HTTP methods allowed by server: `TRACE` (Cross-Site Tracing), `PUT`, `DELETE`, unauthorized options disclosure. | MEDIUM |
| `stack-trace-check.ts` | `ZX-SEC-STACK-*`| PASSIVE | Verbose server stack traces, unhandled exception dumps, runtime environment leaks (Node.js, Python, PHP error pages). | MEDIUM |
| `api-security-check.ts`| `ZX-SEC-API-*`  | PASSIVE | Unauthenticated REST/GraphQL endpoints, exposed GraphQL schema introspection (`__schema`), Swagger/OpenAPI debug consoles. | MEDIUM to HIGH |
| `ai-code-smells-check.ts`| `ZX-AI-SMELL-*`| PASSIVE | Signatures of unvetted AI coding tools: placeholder test credentials, unauthenticated `/api/mock` or `/api/test` endpoints, permissive dev proxies left in production. | HIGH to CRITICAL |
| `sqli-check.ts` | `ZX-ACT-SQLI-*` | ACTIVE | Non-destructive SQL injection: Error-based markers, boolean-blind differential payloads, and time-based delay validation. | CRITICAL |
| `xss-check.ts` | `ZX-ACT-XSS-*`  | ACTIVE | Cross-Site Scripting: Reflected input markers, script context breakout, DOM-based sinks, and React hydration injection points. | HIGH |
| `path-traversal-check.ts`| `ZX-ACT-TRAV-*` | ACTIVE | Directory traversal and arbitrary file read: Dot-dot-slash sequences (`../../etc/passwd`, `..\..\windows\win.ini`), URL encoding evasion. | HIGH to CRITICAL |
| `open-redirect-check.ts` | `ZX-ACT-REDIR-*`| ACTIVE | Arbitrary URL redirection: Unvalidated redirect parameters (`?returnTo=`, `?next=`, `?url=`), domain bypass evasion. | MEDIUM |

#### Scan Modes
* **`PUBLIC_PASSIVE`**: Non-intrusive network inspection. Safe for unverified targets. Tests TLS certificates, security headers, CORS responses, public assets, and exposed secrets without altering state or sending attack payloads.
* **`VERIFIED_ACTIVE`**: Deep application scanning. **Strictly locked** until domain ownership is verified. Sends parameterized injection probes (SQLi, XSS, path traversal, open redirect) through the rate-limited execution harness.

#### Worker Pool & Rate Limiting (`worker-pool.ts`, `active-rate-limiter.ts`)
* **Concurrency**: Managed pool (default: 4 concurrent workers).
* **Active Rate Limiter**: Sliding-window rate limiter per target hostname (default: 5 requests/sec) to avoid service disruption or triggering target WAF rate bans.
* **Evidence Redaction (`evidence-redactor.ts`)**: Automatically masks passwords, bearer tokens, credit card numbers, and authorization headers in finding evidence JSON before storage.

---

### 2.2 Target Ownership Verification Engine (`src/core/targets/`)
Located in `verification-service.ts` and `target-service.ts`. Targets cannot be scanned in active mode without passing a challenge.

#### Challenge Token Generation
Zerivex generates a high-entropy token: `zx_verify_<hex32>`.

#### Supported Verification Methods
1. **`DNS_TXT`**: The target owner adds a DNS TXT record. Zerivex probes multiple candidate DNS hosts:
   * `_zerivex-challenge.<hostname>` (e.g., `_zerivex-challenge.api.example.com`)
   * `_zerivex-challenge.<apexDomain>` (e.g., `_zerivex-challenge.example.com`)
   * Direct root TXT: `zerivex-verification=<token>`
   * Handles multi-part TLDs (`.co.uk`, `.co.in`, `.com.au`, `.org.nz`, etc.) via `extractApexDomain()`.
2. **`HTTP_HEADER`**: The target server sends a custom response header on root `GET /`:
   * Header Name: `X-Zerivex-Verification`
   * Header Value: `<token>`
3. **`HTML_META`**: The target serves an HTML meta tag on its index page:
   * `<meta name="zerivex-verification" content="<token>" />`
4. **`FILE_UPLOAD`**: Token served at `/.well-known/zerivex-verification.txt`.

#### Target Scopes
* `EXACT_HOST`: Covers only the specific hostname (e.g., `app.example.com`).
* `DOMAIN`: Covers the apex domain and its direct hosts.
* `SUBDOMAIN_WILDCARD`: Covers all `*.example.com` subdomains.
* `URL_PATH`: Scoped to a specific base path prefix.

---

### 2.3 SSRF Egress Firewall & Safe Network Client (`src/core/security/`)
Located in `egress-firewall.ts`, `ip-validator.ts`, and `safe-http-client.ts`.

#### Threat Defenses
* **Private IP Blocking**: Outbound scanner sockets are blocked from resolving to RFC 1918 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`), or multicast.
* **Cloud Metadata Protection**: Explicitly blocks `169.254.169.254` (AWS IMDSv1/v2, GCP metadata, Azure metadata).
* **DNS Pinning**: Resolves the hostname once at the socket level. Pins the socket connection directly to the verified safe IP to defeat DNS rebinding attacks and multi-A-record round-robin evasion.
* **Protocol Restriction**: Enforces `http:` and `https:` only. Blocks `file://`, `gopher://`, `dict://`, `ftp://`, and `ldap://`.

---

### 2.4 Remediation Catalog & Automated Fix Verifier (`src/core/remediation/`)
Located in `remediation-catalog.ts` and `fix-verifier.ts`.

#### Catalog Architecture
A comprehensive repository of 31+ deterministic security rules mapping rule IDs (`ZX-*`) to:
* Plain-English title and executive summary.
* Business & architectural impact statement.
* Standard classifications: **CWE ID** (e.g., `CWE-319`, `CWE-89`, `CWE-79`) and **OWASP Top 10 Category** (e.g., `A02:2021-Cryptographic Failures`).
* **Multi-Framework Code Diffs**: Real before-and-after patch snippets for:
  * **Next.js** (e.g., `next.config.mjs`, middleware, route handlers)
  * **Express** (e.g., helmet configuration, middleware scripts)
  * **Nginx** (e.g., `nginx.conf`, header directives, SSL cipher blocks)
* Copy-pasteable CLI verification commands (`curl -I`, `openssl s_client`).

#### Targeted Automated Fix Verification (`fix-verifier.ts`)
* When a developer fixes code in their repository, they click **"Verify Fix Now"** in the UI or call `POST /api/findings/[id]/verify`.
* The platform dynamically identifies the exact rule check module that generated the finding.
* It re-executes that single check against the live target endpoint.
* If the vulnerability is no longer reproducible, the finding status automatically transitions to `FIXED`, an immutable event is recorded in the Audit Vault, and the target's security score is recalculated.

---

### 2.5 CI/CD Quality Gate Engine & Developer Workflow (`src/core/cicd/`)
Located in `quality-gate-engine.ts` and `src/app/api/v1/ci/`.

#### Quality Gate Evaluation
Evaluates every pipeline scan against a deterministic `QualityGatePolicy`:
* `minSecurityScore` (default: 80).
* `failOnCritical` (default: true).
* `maxHighFindings` (default: 0).
* `maxMediumFindings` (default: 5).
* `failOnNewFindings` (default: false).

#### Integrations & Outputs
* **OASIS SARIF v2.1.0 (`/api/v1/ci/scans/[id]/sarif`)**: Full SARIF report uploaded directly to GitHub Code Scanning or GitLab Security Dashboard.
* **Pull Request Markdown Summary (`/api/v1/ci/scans/[id]/summary`)**: Clean markdown table posted as a GitHub Actions PR comment.
* **Machine-to-Machine API Keys (`api-key-service.ts`)**: `zx_live_<32hex>` keys hashed with SHA-256, supporting scoped permissions (`scans:create`, `scans:read`, `targets:read`, `ci:execute`).

---

### 2.6 Compliance Audit Vault (`src/core/audit/`)
Located in `audit-vault.ts` and `audit-service.ts`.
* **Tamper-Evident Immutable Log**: Every security event (scans launched, findings verified, risk acceptances, target registrations, role changes) is committed to an append-only PostgreSQL table.
* **Actor Attribution**: Logs actor user ID, email, IP address, user agent, action enum, resource ID, and arbitrary metadata JSON.
* **Cryptographic Integrity Verification (`/api/audit-vault/verify`)**: Validates monotonic timestamp progression and log consistency.
* **Exports**: Direct streaming RFC 4180 CSV export and SIEM JSON format via `/api/audit-vault/export`.

---

### 2.7 Security Academy & AI Developer Playbooks (`src/core/academy/`)
Located in `academy-catalog.ts` and `academy-service.ts`.
* 10 in-depth interactive guides organized across 4 learning tracks:
  1. `ai-code-smells`: Auditing AI-generated web apps and client-side secret leakage.
  2. `api-modern-web`: Overly permissive CORS, essential security headers, Next.js Server Actions authentication.
  3. `injection-sanitization`: SSRF defense-in-depth, modern ORM SQL injection, React hydration XSS.
  4. `identity-rbac-tenancy`: Multi-tenant IDOR isolation, cryptographic session token hashing.
* Each guide contains: Summary, difficulty rating, estimated reading time, CWE/OWASP references, AI pitfall context, dangerous code snippets, remediated code snippets, CLI verification steps, and interactive test quizzes.

---

### 2.8 Attack Surface Mapping (`src/core/surface/`)
Located in `surface-service.ts` and database migration `002_attack_surface.sql`.
* **Discovered Endpoints**: Automatic crawling of web routes, HTTP methods (`GET`, `POST`, etc.), query parameters, status codes, content types, and discovery sources (`CRAWLER`, `ROBOTS_TXT`, `SITEMAP`, `API_DISCOVERY`).
* **Technology Fingerprints**: Signature detection for web frameworks (Next.js, Express, React), servers (Nginx, Cloudflare), languages, and CDNs.

---

### 2.9 Continuous Monitoring & Regressions (`src/core/monitoring/`, `src/core/scheduler/`)
* **Automated Scan Schedules**: Recurring scans with standard cron expressions (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `CUSTOM`).
* **Regression Detector (`regression-detector.ts`)**: Detects security score drops of >= 10 points between consecutive scans, new critical findings, or target verification revocations, firing immediate alerts.

---

### 2.10 Multi-Tenant RBAC & Agency Portfolio (`src/core/rbac/`, `src/core/agency/`, `src/core/teams/`)
* **5-Tier Organization RBAC**:
  * `ORG_OWNER`: Full tenant administrative authority, billing, ownership transfer.
  * `ORG_ADMIN`: Target management, scan execution, team invitations, webhook configs.
  * `ORG_MEMBER`: Scan launching, finding review, fix verification.
  * `ORG_VIEWER`: Read-only access to dashboards, reports, and findings.
  * `ORG_AUDITOR`: Dedicated read-only access to the Compliance Audit Vault and exports.
* **Agency Multi-Client Architecture**:
  * White-label branding (custom company logo, brand color, report footer text).
  * Portfolio dashboard aggregating cross-client security posture, target counts, and critical vulnerability heatmaps.
  * Client stakeholder access grants (`CLIENT_VIEWER`, `CLIENT_MANAGER`).

---

### 2.11 Billing, Entitlements & Subscriptions (`src/core/billing/`)
* **3 Plan Tiers**: `FREE_DEVELOPER`, `TEAM_PRO`, `ENTERPRISE`.
* **Usage Quota Ledgers**: Tracks `MONTHLY_SCANS`, `ACTIVE_TARGETS`, and `TEAM_MEMBERS` per billing cycle.
* **Stripe Integration**: Checkout sessions, Customer Portal billing management, and webhook handling.

---

## 3. Canonical Database Schema (PostgreSQL 16+ / Neon)

All migrations (`001` through `007` in `src/core/db/migrations/`) constitute the relational backbone:

```
┌────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     users      │──────<│   memberships   │>──────│  organizations  │
└────────────────┘       └─────────────────┘       └─────────────────┘
        │                                                   │
        │                                                   ├──────────────┐
        ▼                                                   ▼              ▼
┌────────────────┐                                 ┌────────────────┐ ┌────────────────┐
│   identities   │                                 │    projects    │ │ subscriptions  │
│   (OAuth/Dev)  │                                 └────────────────┘ └────────────────┘
└────────────────┘                                          │              │
        │                                                   ▼              ▼
┌────────────────┐                                 ┌────────────────┐ ┌────────────────┐
│    sessions    │                                 │    targets     │ │ usage_ledgers  │
│ (token-hashed) │                                 └────────────────┘ └────────────────┘
└────────────────┘                                          │
                                         ┌──────────────────┼──────────────────┐
                                         ▼                  ▼                  ▼
                                ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
                                │   scan_jobs    │ │   discovered   │ │   technology   │
                                │ (passive/act)  │ │   endpoints    │ │  fingerprints  │
                                └────────────────┘ └────────────────┘ └────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                               ▼
                ┌────────────────┐              ┌────────────────┐
                │    findings    │              │ scan_schedules │
                │  (redacted)    │              └────────────────┘
                └────────────────┘                       │
                         │                               ▼
                ┌────────┴────────┐             ┌────────────────┐
                ▼                 ▼             │  monitoring_   │
        ┌────────────────┐ ┌─────────────┐      │     alerts     │
        │finding_comments│ │quality_gate │      └────────────────┘
        └────────────────┘ │  _policies  │
                           └─────────────┘
```

### Key Relational Tables Summary

| Table Name | Migration | Primary Purpose | Key Fields |
| :--- | :--- | :--- | :--- |
| `users` | `001` | System user identity | `id`, `email`, `role`, `status`, `created_at` |
| `identities` | `001` | OAuth accounts | `user_id`, `provider` (google, github, mock), `provider_account_id` |
| `sessions` | `001` | Persistent sessions | `user_id`, `session_token_hash`, `ip_address`, `expires_at` |
| `organizations` | `001` | Multi-tenant root | `id`, `name`, `slug`, `is_agency`, `created_by_user_id` |
| `memberships` | `001, 005` | Organization RBAC | `organization_id`, `user_id`, `role` (`ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`, `ORG_VIEWER`, `ORG_AUDITOR`) |
| `targets` | `001` | Monitored endpoints | `target_url`, `hostname`, `verification_status`, `verification_token`, `verification_method`, `verification_scope` |
| `domain_verifications` | `001` | Ownership audit | `target_id`, `token`, `method`, `verified_at` |
| `scan_jobs` | `001` | Scan execution state | `target_id`, `scan_mode`, `status` (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`), `score`, `started_at`, `completed_at` |
| `findings` | `001, 005` | Vulnerability items | `scan_id`, `target_id`, `rule_id`, `title`, `severity`, `confidence`, `status`, `assigned_user_id`, `evidence_json` |
| `audit_logs` | `001` | Immutable compliance | `organization_id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `metadata_json`, `ip_address` |
| `discovered_endpoints` | `002` | Attack surface routes | `target_id`, `url`, `path`, `http_method`, `parameters`, `discovery_source`, `status_code` |
| `technology_fingerprints`| `002` | Stack signatures | `target_id`, `category` (FRAMEWORK, SERVER, CDN_WAF, etc.), `name`, `version`, `confidence` |
| `scan_schedules` | `003` | Recurring cron scans | `target_id`, `name`, `frequency` (DAILY, WEEKLY, etc.), `cron_expression`, `next_run_at`, `is_active` |
| `monitoring_alerts` | `003` | Regression alerts | `target_id`, `alert_type`, `severity`, `title`, `message`, `is_read` |
| `api_keys` | `004` | CI/CD auth tokens | `name`, `key_prefix`, `key_hash`, `scopes`, `status`, `expires_at` |
| `webhooks` | `004` | Event notifications | `url`, `secret`, `events`, `is_active`, `last_status_code` |
| `webhook_deliveries` | `004` | Webhook delivery logs | `webhook_id`, `event_type`, `payload`, `status_code`, `success`, `response_time_ms` |
| `quality_gate_policies`| `004` | CI/CD pass/fail rules | `target_id`, `min_security_score`, `fail_on_critical`, `max_high_findings`, `max_medium_findings` |
| `organization_invitations`| `005` | Team invites | `email`, `role`, `token_hash`, `status` (PENDING, ACCEPTED), `expires_at` |
| `finding_comments` | `005` | Triage threads | `finding_id`, `user_id`, `content`, `comment_type` |
| `subscriptions` | `006` | Tenant plan billing | `plan_id` (FREE_DEVELOPER, TEAM_PRO, ENTERPRISE), `status`, `billing_cycle`, `stripe_customer_id` |
| `usage_ledgers` | `006` | Quota counters | `metric` (MONTHLY_SCANS, ACTIVE_TARGETS, TEAM_MEMBERS), `period_start`, `value` |
| `agency_branding` | `007` | White-label settings | `company_name`, `logo_url`, `primary_color`, `report_footer_text`, `support_email` |
| `agency_client_relationships`| `007`| Managed clients | `agency_organization_id`, `client_organization_id`, `client_name`, `status` |
| `agency_client_grants` | `007` | Stakeholder grants | `relationship_id`, `user_id`, `role` (CLIENT_VIEWER, CLIENT_MANAGER) |

---

## 4. Complete Backend API Surface Catalog

The application exposes 56 API route handlers under `src/app/api/`. Every endpoint is strictly guarded by session cookies or API keys.

```
API Surface Groupings:
├── /api/auth/*             # Session lifecycle, OAuth login, logout, mock dev login
├── /api/targets/*          # Target CRUD, ownership verification, surface crawling, monitoring
├── /api/scans/*            # Scan launch, polling, detail, reports
├── /api/findings/*         # Findings triage, status updates, comments, targeted fix verification
├── /api/v1/ci/*            # Headless CI/CD scans, SARIF v2.1.0, PR markdown summaries
├── /api/quality-gates/*    # Quality gate policy management
├── /api/schedules/*        # Recurring scan schedules & ad-hoc execution
├── /api/monitoring/*       # Score regression alerts
├── /api/audit-vault/*      # Audit query, cryptographic verification, CSV/JSON exports
├── /api/academy/*          # Learning track articles, quizzes
├── /api/teams/*            # Member management, invites, ownership transfer
├── /api/agency/*           # Portfolio overview, managed clients, white-label branding
├── /api/billing/*          # Plan summary, Stripe checkout, billing portal, webhooks
├── /api/api-keys/*         # Machine API key creation, revocation
├── /api/webhooks/*         # Webhook endpoints, testing, delivery history
└── /api/health/*           # Service liveness, readiness, health telemetry
```

### Complete API Endpoints Table

| Route | Method(s) | Description | Primary Payload / Parameters |
| :--- | :--- | :--- | :--- |
| `/api/auth/session` | `GET` | Returns current user session, organization, role | Cookie-based session resolution |
| `/api/auth/login/[provider]` | `GET` | Initiates OAuth flow (Google, GitHub, mock) | `provider` param |
| `/api/auth/callback/[provider]` | `GET` | Handles OAuth callback redirect | Auth code, state |
| `/api/auth/logout` | `POST` | Revokes active session token | Clears `zx_session` cookie |
| `/api/auth/logout-all` | `POST` | Revokes all sessions for user across devices | User ID resolution |
| `/api/targets` | `GET, POST` | List all targets; Register new target | `POST`: `{ targetUrl, verificationMethod, verificationScope }` |
| `/api/targets/[id]` | `GET, DELETE` | Get target details; Delete target | Target ID URL param |
| `/api/targets/[id]/verify` | `POST` | Trigger cryptographic ownership verification | Triggers DNS / HTTP / Meta checks |
| `/api/targets/[id]/surface` | `GET, POST` | List discovered endpoints & tech; Trigger crawl | `POST`: starts async crawler |
| `/api/targets/[id]/monitoring` | `GET` | Historical security scores, trends, alerts, schedules | Target ID URL param |
| `/api/scans` | `GET, POST` | List scan fleet jobs; Launch new scan | `POST`: `{ targetId, scanMode }` |
| `/api/scans/[id]` | `GET` | Get scan status, calculated score, findings | Scan ID URL param |
| `/api/scans/[id]/report` | `GET` | Export technical scan report (JSON/HTML) | Format query param |
| `/api/findings` | `GET` | Query findings with severity, status, search filters | Query params: `severity`, `status`, `search` |
| `/api/findings/[id]` | `GET, PATCH` | Get finding; Update status or accept risk | `PATCH`: `{ status, acceptedRiskReason }` |
| `/api/findings/[id]/assign` | `POST` | Assign engineer to finding | `{ assignedUserId }` |
| `/api/findings/[id]/comments` | `GET, POST` | Get comment thread; Post collaboration note | `POST`: `{ content, commentType }` |
| `/api/findings/[id]/verify` | `POST` | **Targeted Fix Verification Re-Test** | Re-executes single rule on live target |
| `/api/v1/ci/scan` | `POST` | Machine CI scan launcher (API Key auth) | Header: `Authorization: Bearer zx_live_...` |
| `/api/v1/ci/scans/[id]` | `GET` | Poll CI scan execution status and gate result | Machine API Key auth |
| `/api/v1/ci/scans/[id]/sarif` | `GET` | OASIS SARIF v2.1.0 output for GitHub Security | Formatted SARIF JSON |
| `/api/v1/ci/scans/[id]/summary`| `GET` | Formatted Markdown summary for PR comment | Markdown string |
| `/api/quality-gates` | `GET, POST, PUT` | List, create, or update quality gate policy | `{ targetId, minSecurityScore, failOnCritical, maxHighFindings }` |
| `/api/schedules` | `GET, POST` | List recurring schedules; Create schedule | `{ targetId, name, frequency, cronExpression, scanMode }` |
| `/api/schedules/[id]` | `GET, PUT, DELETE`| Get, update, or remove schedule | Schedule ID URL param |
| `/api/schedules/[id]/run` | `POST` | Run scheduled scan immediately | Schedule ID URL param |
| `/api/monitoring/alerts` | `GET, PATCH` | List regression alerts; Mark alert read | Query params: `isRead`, `targetId` |
| `/api/audit-vault` | `GET` | Filter compliance logs (actor, action, date) | Query params: `search`, `action`, `startDate`, `limit`, `offset` |
| `/api/audit-vault/verify` | `GET` | Cryptographic verification of log monotonicity | Returns `{ verified: true, isMonotonic: true }` |
| `/api/audit-vault/export` | `GET` | RFC 4180 CSV / SIEM JSON streaming download | Query param: `format=csv` or `format=json` |
| `/api/academy` | `GET` | List all learning tracks and articles | Returns tracks and article metadata |
| `/api/academy/[slug]` | `GET` | Get full article, code diffs, interactive test | Article slug URL param |
| `/api/teams/members` | `GET` | List active organization team members | Org ID resolution |
| `/api/teams/invitations` | `GET, POST` | List pending invitations; Send invitation | `POST`: `{ email, role }` |
| `/api/teams/invitations/[tokenOrId]` | `GET, DELETE` | Inspect invite; Revoke invite | Invite token or ID URL param |
| `/api/teams/invitations/[tokenOrId]/accept` | `POST` | Accept invite and join organization | Authenticated user |
| `/api/teams/transfer-ownership` | `POST` | Transfer `ORG_OWNER` to another member | `{ targetUserId }` |
| `/api/agency/portfolio` | `GET` | Cross-client security posture portfolio | Aggregated client stats |
| `/api/agency/clients` | `GET, POST` | List managed clients; Provision client | `POST`: `{ clientName, notes }` |
| `/api/agency/clients/[id]/access` | `GET, POST, DELETE`| Manage client stakeholder access grants | `{ userId, role: CLIENT_VIEWER }` |
| `/api/agency/branding` | `GET, POST` | Get or update white-label agency branding | `{ companyName, logoUrl, primaryColor, reportFooterText }` |
| `/api/billing` | `GET` | Current plan, Stripe subscription, quota usages | Returns subscription + ledger stats |
| `/api/billing/checkout` | `POST` | Create Stripe checkout session for upgrade | `{ planId: 'TEAM_PRO', cycle: 'YEARLY' }` |
| `/api/billing/portal` | `POST` | Create Stripe customer billing portal URL | Returns `{ url }` |
| `/api/billing/webhook` | `POST` | Stripe webhook event handler | Stripe signature verification |
| `/api/api-keys` | `GET, POST` | List active API keys; Generate new key | `POST`: `{ name, scopes, expiresInDays }` |
| `/api/api-keys/[id]` | `DELETE` | Revoke API key | Key ID URL param |
| `/api/webhooks` | `GET, POST` | List webhooks; Create webhook subscription | `POST`: `{ name, url, events }` |
| `/api/webhooks/[id]` | `GET, PUT, DELETE`| Get webhook details; Update; Delete | Webhook ID URL param |
| `/api/webhooks/[id]/test` | `POST` | Send mock event payload to webhook endpoint | Returns delivery status code & latency |
| `/api/health` | `GET` | Overall service health | Returns status, uptime |
| `/api/health/live` | `GET` | Kubernetes liveness probe | HTTP 200 OK |
| `/api/health/ready` | `GET` | Kubernetes readiness probe (checks DB pool) | Tests active database query |

---

## 5. Current Frontend Architecture & Visual Makeup

The frontend is built on **Next.js 15 App Router**, **React 19**, and **Vanilla CSS** with zero external utility frameworks (Tailwind is intentionally omitted in favor of strict CSS Custom Property tokens).

### 5.1 Design System Tokens (`src/styles/tokens.css`)
Based on the **Ember & Paper Design System** (warm paper `#FBF8F3`, dark terminal islands `#14161C`, and single ember-orange accent `#FF642D`), the interface uses a high-contrast, data-dense enterprise color system:

#### 1. Core Palette
* **Signature Brand CTA (Orange)**:
  * `--orange-400: #ff642d` (Primary hot action CTA button)
  * `--orange-300: #ff8c43` (Hover state)
  * `--orange-500: #c33909` (Active/pressed state)
  * `--orange-50:  #fff3d9` (Subtle warning/highlight background)
* **Informational & Link Blue**:
  * `--blue-500: #006dca` (Light mode primary action/link)
  * `--blue-400: #008ff8` (Dark mode action/link)
  * `--blue-50:  #e9f7ff` (Subtle badge background)
* **Trend & Success Green**:
  * `--green-400: #009f81` (Verified, passing checks, score 90-100)
  * `--green-300: #00c192` (Dark mode success tone)
  * `--green-50:  #dbfee8` (Light mode success chip background)
* **Critical & Danger Red**:
  * `--red-500: #d1002f` (Critical severity, failed quality gate)
  * `--red-400: #ff4953` (Dark mode critical tone)
  * `--red-50:  #fff0f7` (Light mode danger chip background)
* **Warning Yellow**:
  * `--yellow-400: #d87900` (Medium severity, pending verification)
  * `--yellow-200: #fdc23c` (Dark mode warning tone)
* **Advanced AI & Feature Violet**:
  * `--violet-500: #8649e1` / `--violet-400: #ab6cfe` (AI smells, agency hub highlights)
* **Cool Neutrals**:
  * `--gray-50: #f4f5f9` (Subtle card/table headers in light mode)
  * `--gray-100: #e0e1e9` (Hairline borders in light mode)
  * `--gray-200: #c4c7cf` (Default borders)
  * `--gray-600: #484a54` (Muted captions)
  * `--gray-700: #2b2e38` (Deep secondary text)
  * `--gray-800: #191b23` (High contrast primary ink)
  * `--gray-white: #ffffff`

#### 2. Dual-Theme Semantic Tokens

| Semantic Token | Light Mode (`:root`) | Dark Mode (`[data-theme="dark"]`) | Primary Usage |
| :--- | :--- | :--- | :--- |
| `--ds-bg-page` | `#ffffff` (`--gray-white`) | `#111317` | Canvas background |
| `--ds-bg-subtle` | `#f4f5f9` (`--gray-50`) | `#181a22` | Navigation rail, secondary panels |
| `--ds-bg-card` | `#ffffff` | `#191b24` | Surface cards, modals |
| `--ds-bg-card-hover` | `#fafbfe` | `#212430` | Hovered card state |
| `--ds-text-primary` | `#191b23` (`--gray-800`) | `#f4f5f9` | High-contrast headings and body |
| `--ds-text-secondary`| `#6c6e79` (`--gray-500`) | `#a9abb6` | Subheadings, descriptions |
| `--ds-text-muted` | `#8a8e9b` (`--gray-400`) | `#6c6e79` | Timestamps, table column labels |
| `--ds-border-subtle`| `#e0e1e9` (`--gray-100`) | `#232632` | Hairline dividers |
| `--ds-border-default`| `#c4c7cf` (`--gray-200`) | `#303444` | Card and input borders |
| `--ds-action-brand` | `#ff642d` (`--orange-400`)| `#ff642d` | Primary Hot CTA Pill |
| `--ds-action-brand-hover`| `#ff8c43` | `#ff8c43` | Primary CTA hover |
| `--ds-focus-ring` | `0 0 0 3px rgba(0, 143, 248, 0.35)` | `0 0 0 3px rgba(0, 143, 248, 0.45)` | Accessible focus rings |

#### 3. Standard Severity Matrix

| Severity Level | Text Token | Background Token | Border Token | CVSS Score Range |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | `#ef4444` (`--sev-critical`) | `rgba(239, 68, 68, 0.14)` | `rgba(239, 68, 68, 0.35)` | 9.0 – 10.0 |
| **HIGH** | `#f97316` (`--sev-high`) | `rgba(249, 115, 22, 0.14)` | `rgba(249, 115, 22, 0.35)` | 7.0 – 8.9 |
| **MEDIUM** | `#eab308` (`--sev-medium`) | `rgba(234, 179, 8, 0.14)` | `rgba(234, 179, 8, 0.35)` | 4.0 – 6.9 |
| **LOW** | `#3b82f6` (`--sev-low`) | `rgba(59, 130, 246, 0.14)` | `rgba(59, 130, 246, 0.35)` | 0.1 – 3.9 |
| **INFORMATIONAL** | `#64748b` (`--sev-info`) | `rgba(100, 116, 139, 0.14)`| `rgba(100, 116, 139, 0.35)`| 0.0 |

#### 4. Typography, Spacing, and Elevation
* **Font Sans**: `'Inter', system-ui, -apple-system, sans-serif`
* **Font Mono**: `'JetBrains Mono', 'Fira Code', monospace`
* **Spacing Scale (4px Grid)**: `--ds-space-1: 4px`, `--ds-space-2: 8px`, `--ds-space-3: 12px`, `--ds-space-4: 16px`, `--ds-space-5: 24px`, `--ds-space-6: 32px`, `--ds-space-7: 48px`, `--ds-space-8: 64px`, `--ds-space-9: 96px`, `--ds-space-10: 128px`.
* **Border Radii**: `--ds-radius-sm: 4px`, `--ds-radius-md: 8px`, `--ds-radius-lg: 16px`, `--ds-radius-pill: 999px`.
* **Shadows**:
  * `--ds-shadow-1: 0 1px 2px rgba(25, 27, 35, 0.06)`
  * `--ds-shadow-2: 0 4px 12px rgba(25, 27, 35, 0.08)`
  * `--ds-shadow-3: 0 12px 32px rgba(25, 27, 35, 0.14)`

---

### 5.2 Component Hierarchy & Structure

```
src/components/
├── auth/
│   ├── AuthProvider.tsx            # Context provider for session, user, login/logout state
│   ├── LoginForm.tsx               # OAuth buttons (Google, GitHub), Dev Localhost login
│   └── ProtectedRoute.tsx          # Client-side guard checking authenticated session
├── dashboard/
│   ├── CommandBanner.tsx           # Fleet greeting banner with live stats & quick actions
│   ├── DashboardHeader.tsx         # Workspace switcher, breadcrumbs, search, user avatar menu
│   ├── FindingsAccordionCard.tsx   # Collapsible finding card, CWE, CVSS, evidence JSON inspector
│   ├── FrameworkRemediationModal.tsx # Multi-framework diffs (Next/Express/Nginx) & fix verification
│   ├── LaunchScanModal.tsx         # Modal for selecting target and scan mode (passive vs active)
│   ├── QuickScanLauncher.tsx       # Inline target selector and instant scan trigger
│   ├── ScansExecutionTable.tsx     # Scan execution table with status pills, scores, durations
│   ├── SeverityBadge.tsx           # 5-tier colored badge chip
│   ├── TargetsTable.tsx            # Target inventory table, verification pills, action menus
│   └── VerificationCenter.tsx      # Step-by-step DNS/HTTP/Meta instructions & verify trigger
├── layout/
│   ├── AnnouncementBar.tsx         # Dismissible top ink strip with CTA
│   ├── Header.tsx                  # Floating pill nav with platform drawer & Brand button observer
│   └── Footer.tsx                  # Giant cropped wordmark, live system status & categorized links
├── landing/
│   ├── Hero.tsx                    # Live typing URL-to-terminal hero with tabs
│   ├── StickyStory.tsx             # Verify. Detect. Defend. lifecycle narrative
│   ├── BentoGrid.tsx               # AI code mistakes categorization
│   ├── BeforeAfterSplit.tsx        # Multi-framework code diffs
│   ├── WorksWithMarquee.tsx        # Framework strip
│   ├── CicdBand.tsx                # Terminal island with CI/CD tabs
│   ├── StatsAndStatus.tsx          # Real catalog counts and live status
│   ├── VerificationProofCard.tsx   # Targeted fix verification
│   ├── AcademyPreview.tsx          # Dynamic card grid fed by Security Academy catalog
│   ├── PricingTeaser.tsx           # Compact pricing plans preview
│   ├── FaqAccordion.tsx            # Technical FAQ accordion
│   └── FinalCtaCard.tsx            # Split callout card
├── theme/
│   └── ThemeToggle.tsx             # Theme controller with localStorage sync
└── ui/
    ├── Modal.tsx                   # Accessible dialog overlay with Esc key & backdrop click
    └── StaggeredText.tsx           # Smooth stagger entrance animation
```

---

## 6. Frontend Dynamic Data Architecture (The "No Hardcoding" Rule)

> **CRITICAL DIRECTIVE**: The frontend must NEVER hardcode mock counts, static target URLs, dummy finding counts, or static company names. Every screen must consume live data from the backend through typed models and pure adapter functions.

### 6.1 The Adapter Layer Pattern (`src/adapters/adapters.ts`)

The adapter layer ensures clean separation between backend models and UI presentation:
1. **Pure Functions**: Adapters translate raw database entities or API responses into clean component props.
2. **Defensive Defaults**: Never throw on missing fields. Every adapter employs optional chaining and fallback values (`0`, `'N/A'`, `'UNKNOWN'`).
3. **Decoupled Contracts**: If a backend field changes, only the adapter is updated—components remain untouched.

```
┌─────────────────────────────────┐
│     Backend Database & APIs     │
│  (targets, scans, findings,     │
│   academy, audit_logs, ledgers) │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│       Typed Adapter Layer       │
│     (src/adapters/adapters.ts)  │
│                                 │
│  • adaptArticlesToResources()   │
│  • adaptPlans()                 │
│  • adaptTargetToRow()           │
│  • adaptStats()                 │
└─────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     Neutral UI Components       │
│  (Hero, StatsAndStatus, Bento,  │
│   AcademyPreview, PricingTeaser)│
└─────────────────────────────────┘
```

#### Adapter Function Signatures
```typescript
// 1. Translates live Academy catalog articles into marketing resource cards
export function adaptArticlesToResources(articles: AcademyArticle[], limit = 6): ResourceCardProps[];

// 2. Translates real scan execution records into live leaderboard rows
export function adaptScanToLeaderboardRow(scan: ScanJobRecord, rank: number): LeaderboardRow;

// 3. Translates target inventory into table rows with computed verification badges
export function adaptTargetToLeaderboardRow(target: Target, rank: number): LeaderboardRow;

// 4. Formats fleet metrics into high-impact stats cards
export function adaptStats(
  totalScans: number,
  avgScore: number,
  activeTargets: number,
  testsGreen: number
): StatItem[];

// 5. Generates solutions showcase items dynamically from active scanner check modules
export function adaptSolutionsFromChecks(checks: ScanCheck[]): SolutionItem[];
```

---

## 7. Page-by-Page Dynamic UI Blueprint (Mapping Frontend to Backend)

This blueprint details how every single screen in the platform connects dynamically to backend APIs, database models, and adapters.

### 7.1 Marketing Landing Page (`/` -> `src/app/page.tsx`)
* **Purpose**: High-conversion landing page presenting platform capabilities, scanner benchmarks, and Academy resources.
* **Component Composition**:
  1. `<AnnouncementBar />`: Dismissible top notification linked to `/academy`.
  2. `<Header />`: Floating pill nav with platform drawer & single brand CTA button observer.
  3. `<Hero />`: Live typing URL-to-terminal hero with tabs and sample output.
  4. `<StickyStory />`: Verify. Detect. Defend. lifecycle narrative.
  5. `<BentoGrid />`: Mistakes AI tools leave behind with 6 category cards.
  6. `<BeforeAfterSplit />`: Next.js / Express / Nginx code diffs.
  7. `<WorksWithMarquee />`: Framework marquee strip.
  8. `<CicdBand />`: Dark terminal island with CI/CD tabs.
  9. `<StatsAndStatus />`: Real catalog counts and live system status.
  10. `<VerificationProofCard />`: Targeted fix verification explainer.
  11. `<AcademyPreview />`: Dynamically populated from `ACADEMY_ARTICLES`.
  12. `<PricingTeaser />`: Config-driven plan cards with billing toggle.
  13. `<FaqAccordion />`: Technical answers to safety and ownership.
  14. `<FinalCtaCard />`: Split callout card.
  15. `<Footer />`: Giant cropped wordmark, live system status, and categorized links.
* **Backend Wiring**:
  * Consumes `ACADEMY_ARTICLES` directly or via `GET /api/academy`.
  * Session state dynamically inspected via `GET /api/auth/session` (via `useAuth()`).

---

### 7.2 Security Academy Hub (`/academy` -> `src/app/academy/page.tsx`)
* **Purpose**: Searchable, filterable security knowledge hub with 10 deep-dive interactive playbooks.
* **Features & Controls**:
  * Real-time search query input (matches titles, summaries, tags, rule IDs, and CWEs).
  * Category pills (`AI Code Smells`, `API Security`, `Injection Defenses`, `Auth & Sessions`, `Security Headers`).
  * Learning track selector (`ai-code-smells`, `api-modern-web`, `injection-sanitization`, `identity-rbac-tenancy`).
  * Difficulty level filter (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`).
  * Dynamic result counter: `"Showing X of Y guides"`.
  * Article card layout: Track badge, difficulty chip, estimated reading time, CWE pill, summary, and action link.
* **Backend Wiring**:
  * Fetches from `GET /api/academy`.
  * Dynamic session state: Navbar shows user avatar / "Launch Console" vs "Sign in".

---

### 7.3 Academy Article Deep Dive (`/academy/[slug]` -> `src/app/academy/[slug]/page.tsx`)
* **Purpose**: Full technical playbook for a specific vulnerability class.
* **Layout Structure**:
  * Breadcrumb navigation (`Academy / Track Name / Article Title`).
  * Metadata bar: Difficulty badge, reading time, CWE link, OWASP category badge, related rule pills (`ZX-*`).
  * Section 1: Executive Summary & Real-World Impact.
  * Section 2: AI Coding Assistant Pitfall Analysis (how tools like Cursor or v0 introduce this flaw).
  * Section 3: Dangerous Code Example (syntax-highlighted code block with line callouts).
  * Section 4: Remediated Code Example (production-grade defensive patch).
  * Section 5: Copy-Paste CLI Verification Commands (`curl`, `nmap`, `openssl`).
  * Section 6: Interactive Knowledge Check: Multiple-choice quiz question with instant feedback, explanation, and option validation.
  * Bottom CTA: "Launch Scan for this Vulnerability" linking directly to the dashboard scan launcher.
* **Backend Wiring**:
  * Fetches from `GET /api/academy/[slug]`.

---

### 7.4 Authentication & Login (`/login` -> `src/app/(auth)/login/page.tsx`)
* **Purpose**: Secure multi-provider authentication.
* **Layout Structure**:
  * Top-left "Back to Home" navigation button.
  * Top-right floating `<ThemeToggle />`.
  * Centered authentication card (`<LoginForm />`):
    * GitHub OAuth button (`GET /api/auth/login/github`).
    * Google OAuth button (`GET /api/auth/login/google`).
    * Dev Localhost Quick Login (for automated tests and local development).
    * Error alert banner for expired or invalid callback tokens.
    * Return URL redirection support (`?returnTo=/dashboard/...`).

---

### 7.5 Dashboard Overview (`/dashboard` -> `src/app/(dashboard)/dashboard/page.tsx`)
* **Purpose**: High-level command center showing fleet health, recent activity, and quick launcher.
* **Components & Widgets**:
  1. `<CommandBanner />`: Welcome greeting, user email/role, overall fleet security score gauge (0-100), and quick action buttons ("Register Target", "Launch Scan", "Query Audit Vault").
  2. `<QuickScanLauncher />`: Dropdown to select any registered target, toggle scan mode (Passive vs Active), and execute with one click (`POST /api/scans`).
  3. **4 Metric Cards Strip**:
     * **Monitored Targets**: Total registered target count.
     * **Open Vulnerabilities**: Breakdown pills by severity (`CRIT`, `HIGH`, `MED`, `LOW`).
     * **Subsystems Operational**: 10/10 Core security subsystems nominal indicator.
     * **Build Gate Status**: CI/CD Quality Gate status (`PASSED` or `FAILED`).
  4. **Subsystem Defense Status Strip**:
     * SSRF Egress Firewall (Multi-A/AAAA Pinning Active).
     * Edge Rate Limiter (Sliding Window Protection).
     * Compliance Audit Vault (Tamper-Evident SHA-256 Logs).
     * Scan Worker Pool (Concurrency 4 · Watchdog Armed).
  5. **Platform Modules Navigation Grid**: Direct links to Scanners, Academy, Agency Hub, and Audit Vault.
* **Backend Wiring**:
  * Parallel fetch: `GET /api/targets`, `GET /api/findings`, `GET /api/health`.

---

### 7.6 Target Inventory & Registration (`/dashboard/targets` -> `src/app/(dashboard)/dashboard/targets/page.tsx`)
* **Purpose**: Full attack surface management: register endpoints, monitor status, and trigger verification challenges.
* **Components & Workflows**:
  * Target count summary banner.
  * **"Register New Target" Modal**:
    * Target URL input (e.g., `https://api.example.com`).
    * Verification Method selector (`DNS_TXT`, `HTTP_HEADER`, `HTML_META`).
    * Verification Scope selector (`EXACT_HOST`, `DOMAIN`, `SUBDOMAIN_WILDCARD`, `URL_PATH`).
    * Submits to `POST /api/targets`.
  * **`<TargetsTable />`**:
    * Columns: Target Hostname & URL, Verification Status pill (`VERIFIED` in emerald, `UNVERIFIED` in yellow, `PENDING` in cyan, `REVOKED` in red), Verification Method, Scope, Last Verified Date, Actions.
    * Action dropdown: "Verify Ownership Now" (`POST /api/targets/[id]/verify`), "Attack Surface" (`/dashboard/targets/[id]/surface`), "Monitoring & Schedules" (`/dashboard/targets/[id]/monitoring`), "CI/CD Gates" (`/dashboard/targets/[id]/ci-cd`), "Quick Scan", "Delete Target".
  * **`<VerificationCenter />`**:
    * Step-by-step instructions panel showing the exact DNS TXT hostname and value, HTTP header name and value, or HTML meta tag to copy-paste.
    * Single-click copy buttons for challenge tokens.
    * Live "Check Verification Now" button with spinner.

---

### 7.7 Target Attack Surface (`/dashboard/targets/[id]/surface`)
* **Purpose**: Discovered web routes, API endpoints, parameters, and technology fingerprinting.
* **Components**:
  * Target URL header with breadcrumbs.
  * "Run Attack Surface Crawl" button (`POST /api/targets/[id]/surface`).
  * Technology Stack Grid: Detected servers, frameworks, CDNs, and languages with confidence ratings.
  * Discovered Endpoints Table:
    * HTTP Method chip (`GET`, `POST`, `PUT`, `DELETE`).
    * Path (e.g., `/api/v1/auth/login`).
    * Discovery Source (`CRAWLER`, `ROBOTS_TXT`, `SITEMAP`, `API_DISCOVERY`).
    * Response Status Code (e.g., `200`, `401`, `403`).
    * Response Time (ms).

---

### 7.8 Target Continuous Monitoring & Schedules (`/dashboard/targets/[id]/monitoring`)
* **Purpose**: Historical score trends, recurring automated scans, and security regression alerts.
* **Components**:
  * Security Score History chart: Visual trendline of scores over time.
  * Regression Alerts Table:
    * Alert type (`SECURITY_SCORE_DROP`, `NEW_CRITICAL_FINDING`, etc.).
    * Severity pill.
    * Description and timestamp.
    * "Mark as Read" action (`PATCH /api/monitoring/alerts`).
  * Recurring Scan Schedules Manager:
    * "Add Schedule" modal: Frequency (`DAILY`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `CUSTOM`), cron expression, scan mode (`PASSIVE` vs `ACTIVE`).
    * Schedules table: Name, Cron, Next Run Time, Last Run Status, "Run Now" trigger button (`POST /api/schedules/[id]/run`), delete button.

---

### 7.9 Target CI/CD Quality Gate Configuration (`/dashboard/targets/[id]/ci-cd`)
* **Purpose**: Configure build-breaking rules and copy CI/CD pipeline configuration snippets.
* **Components**:
  * Policy Configuration Form:
    * Minimum Security Score slider (0-100, default: 80).
    * "Fail Build on Critical Findings" toggle (default: true).
    * Maximum High Findings allowed (numeric input, default: 0).
    * Maximum Medium Findings allowed (numeric input, default: 5).
    * "Fail on New Findings" toggle.
    * "Save Policy" button (`PUT /api/quality-gates`).
  * Copy-Paste Pipeline Snippets Tabs:
    * **GitHub Actions**: Full `.github/workflows/zerivex-gate.yml` workflow file.
    * **GitLab CI**: Complete `.gitlab-ci.yml` job definition.
    * **cURL**: Direct shell command using machine API key.

---

### 7.10 Scan Fleet & Live Jobs (`/dashboard/scans` -> `src/app/(dashboard)/dashboard/scans/page.tsx`)
* **Purpose**: Scan execution history, active job polling, and launcher modal.
* **Components**:
  * "Launch New Scan" button opening `<LaunchScanModal />`.
  * Auto-polling indicator (polls every 3 seconds while scans are `RUNNING` or `QUEUED`).
  * `<ScansExecutionTable />`:
    * Scan Job ID (monospace link).
    * Target Hostname.
    * Mode pill (`PUBLIC_PASSIVE` in cyan, `VERIFIED_ACTIVE` in violet).
    * Status pill (`RUNNING` with pulse animation, `COMPLETED` in emerald, `FAILED` in red).
    * Security Score Badge (colored by score bracket: 90-100 A+ green, 80-89 A blue, 70-79 B yellow, <70 F red).
    * Started / Duration timestamps.
    * Action: "View Deep Dive Report" (`/dashboard/scans/[id]`).

---

### 7.11 Scan Deep Dive & Findings Report (`/dashboard/scans/[id]` -> `src/app/(dashboard)/dashboard/scans/[id]/page.tsx`)
* **Purpose**: Comprehensive technical audit report for a completed scan.
* **Layout Structure**:
  * Top Header: Target URL, scan mode badge, completion timestamp, "Re-run Scan" button, "Export Report" button.
  * Score Banner: Large circular/pill score gauge (e.g., `85 / 100 Grade A`), findings total counter.
  * Filters: Severity filter (`ALL`, `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`), text search.
  * `<FindingsAccordionCard />` List:
    * Title, severity badge, rule ID (`ZX-*`), confidence rating.
    * Affected endpoint / URL path.
    * CWE ID and OWASP classification chips.
    * Collapsible Redacted Evidence Drawer: Formatted JSON viewer displaying sanitized HTTP request/response proofs.
    * Action Buttons:
      * "View Remediation Diff": Opens `<FrameworkRemediationModal />`.
      * "Update Status / Accept Risk": Opens status update modal (`PATCH /api/findings/[id]`).

---

### 7.12 Findings Hub & Remediation Center (`/dashboard/findings` -> `src/app/(dashboard)/dashboard/findings/page.tsx`)
* **Purpose**: Global cross-target vulnerability triage, assignee management, collaboration notes, and automated fix verification.
* **Features & Modals**:
  * Cross-target search and filtering by severity and status (`OPEN`, `CONFIRMED`, `FALSE_POSITIVE`, `ACCEPTED_RISK`, `FIXED`).
  * **Collaboration Modal**:
    * Engineer assignment dropdown (`POST /api/findings/[id]/assign`).
    * Comment thread displaying timestamped notes from team engineers (`GET/POST /api/findings/[id]/comments`).
  * **Risk Acceptance Modal**: Requires a mandatory documented business justification before moving status to `ACCEPTED_RISK`.
  * **`<FrameworkRemediationModal />`**:
    * Summary of the vulnerability and security impact.
    * Multi-Framework Code Diff tabs: **Next.js**, **Express**, **Nginx**.
    * Copy-paste CLI verification command.
    * **"Verify Fix Now" Button**: Re-invokes `POST /api/findings/[id]/verify` to execute a targeted re-test on the target server. Displays live diagnostic result and automatically marks finding `FIXED` on success.

---

### 7.13 Compliance Audit Vault (`/dashboard/audit-vault` -> `src/app/(dashboard)/dashboard/audit-vault/page.tsx`)
* **Purpose**: Immutable, tamper-evident audit log for SOC 2, ISO 27001, and enterprise compliance.
* **Components**:
  * Audit Log Filter Bar: Filter by actor email, action type, resource type, date range, and search text.
  * "Verify Hash Chain Integrity" button: Calls `GET /api/audit-vault/verify` to confirm monotonic timestamps and log immutability.
  * "Export Logs" dropdown: Instant streaming download of RFC 4180 CSV (`/api/audit-vault/export?format=csv`) or SIEM JSON (`/api/audit-vault/export?format=json`).
  * Audit Entries Table: Timestamp, Actor (name + email), Action pill, Resource type and ID, Client IP address, Inspect Metadata button.
  * JSON Metadata Drawer: Inspects raw event context payloads.

---

### 7.14 Team Management & RBAC (`/dashboard/team` -> `src/app/(dashboard)/dashboard/team/page.tsx`)
* **Purpose**: Manage organization roster, roles, and pending invitations.
* **Components**:
  * Team Roster Table: Avatar, Display Name, Email, Role badge (`ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`, `ORG_VIEWER`, `ORG_AUDITOR`), Joined Date.
  * "Invite Team Member" Modal:
    * Email address input.
    * Role selector (`ORG_ADMIN`, `ORG_MEMBER`, `ORG_VIEWER`, `ORG_AUDITOR`).
    * Submits to `POST /api/teams/invitations`. Generates a shareable token-hashed invitation link with single-click copy.
  * Pending Invitations Table: Invitee email, role, expiration date, "Revoke Invite" button.
  * Transfer Organization Ownership workflow (Owner-only).

---

### 7.15 Agency Multi-Client Hub (`/dashboard/agency` -> `src/app/(dashboard)/dashboard/agency/page.tsx`)
* **Purpose**: Multi-client portfolio management and white-label branding for cybersecurity agencies and MSPs.
* **Components**:
  * Tab 1: **Portfolio Summary**:
    * Aggregated metrics strip: Total Managed Clients, Total Targets, Total Scans, Mean Security Score, Critical Findings Heatmap.
    * Managed Clients Grid/Table: Client Name, Account Manager, Status, Monitored Targets, Latest Security Score, Critical/High counts, "Manage Client" link.
    * "Provision New Client" modal (`POST /api/agency/clients`).
  * Tab 2: **White-Label Branding**:
    * Company Name input.
    * Custom Agency Logo URL.
    * Primary Brand Color picker (affects generated PDF/HTML reports).
    * Custom Report Footer Text.
    * Support Contact Email.
    * "Save Branding" button (`POST /api/agency/branding`).

---

### 7.16 Billing, Subscriptions & Quotas (`/dashboard/billing` -> `src/app/(dashboard)/dashboard/billing/page.tsx`)
* **Purpose**: Plan tiers, usage quota progress bars, and Stripe customer portal link.
* **Components**:
  * Current Plan Summary card: Tier name (`FREE_DEVELOPER`, `TEAM_PRO`, `ENTERPRISE`), billing status, renewal date.
  * Quota Usage Gauges:
    * Monitored Targets: Current vs Max limit (e.g., `3 / 10 targets used`).
    * Monthly Scans: Current vs Max limit (e.g., `45 / 500 scans used`).
    * Team Members: Current vs Max limit (e.g., `2 / 5 members used`).
  * Plan Comparison Cards: Free Developer vs Team Pro vs Enterprise with feature checklists and upgrade CTA buttons (`POST /api/billing/checkout`).
  * "Manage Billing in Stripe" button (`POST /api/billing/portal`).

---

### 7.17 Developer Settings (`/dashboard/settings/*`)
* **API Keys (`/dashboard/settings/api-keys`)**:
  * List active API keys (`zx_live_...`), scopes, creation dates, last used IP/timestamp.
  * "Generate API Key" modal with scope toggles (`scans:create`, `scans:read`, `targets:read`, `ci:execute`).
  * Single-reveal secret key display modal with copy button.
  * Revoke key action (`DELETE /api/api-keys/[id]`).
* **Webhooks (`/dashboard/settings/webhooks`)**:
  * Webhook subscriptions table (`url`, subscribed events, status, last delivery response code).
  * "Add Webhook" modal (destination URL, event selection checkboxes).
  * "Send Test Event" trigger button (`POST /api/webhooks/[id]/test`).
  * Webhook Deliveries Log drawer showing HTTP status codes, latencies, and payload signatures.
* **Account Security & Sessions (`/dashboard/settings/security`)**:
  * User profile details, role authorizations.
  * "Sign Out of All Devices" button (`POST /api/auth/logout-all`).

---

## 8. Summary Checklist for Creating UI Specifications

When writing UI specification documents or prompts for AI design tools:
* [x] **Zero Hardcoded Values**: Every card, table, or stat must explicitly specify which backend API endpoint and adapter function provides its data.
* [x] **Adhere to Ember & Paper Design System**: Warm paper (`--bg-paper: #FBF8F3`), dark terminal islands (`#14161C`), and single ember-orange accent (`#FF642D` with `#191B23` ink text for 5.9:1 AA contrast).
* [x] **Support Both Themes**: Ensure all components seamlessly support Light Mode (default) and Deep Obsidian Dark Mode via CSS variables.
* [x] **Reflect Live Capabilities**: Include the 14 Check Scanner engines, 4 Cryptographic Target Ownership methods, 31+ Rule Remediation Catalog, CI/CD Quality Gates, Compliance Audit Vault, and Security Academy.
* [x] **Respect User Constraints**: Exclude deprecated launch readiness artifacts from user-facing screens and uphold edge authentication protection across all `/dashboard/*` routes.
