# ZERIVEX_CONTEXT.md: Long-Term AI Continuity & State Tracker

> **Project:** ZERIVEX  
> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Current Phase:** PHASE 15 — SELF-SCAN & LAUNCH READINESS (DOGFOODING SELF-SCAN, STRIDE THREAT MODEL REVIEW, PRODUCTION CONFIG CHECKLIST & OFFICIAL LAUNCH CERTIFICATION)  
> **Phase Status:** COMPLETE  
> **Owner Authority:** The platform owner is the final authority for architecture, scope, phase approval, and security trade-offs.  
> **Security Rule:** Security correctness over visual completion. Never claim a security feature works unless implemented and tested. Never fake findings.

---

## 1. Project Overview & Scope
Zerivex is an independent cybersecurity SaaS platform designed specifically for modern web applications and APIs, with specialized intelligence for applications developed with AI coding tools (Cursor, Lovable, v0, Bolt, Claude Code, Antigravity, etc.).

Zerivex operates on a closed-loop security cycle:
`DISCOVER -> MAP -> ANALYZE -> VALIDATE -> REPORT -> REMEDIATE -> VERIFY -> MONITOR`

---

## 2. Current Status & Phase State
- **Current Phase:** `PHASE 15 — SELF-SCAN & LAUNCH READINESS`
- **Phase Status:** `COMPLETE`
- **Completed Phases:**
  - `Phase 0A`: Pre-Implementation Discovery (`COMPLETE`)
  - `Phase 0B`: Owner Provisioning (`COMPLETE` - Neon PostgreSQL connected, secrets configured in `.env.local`)
  - `Phase 0C`: Governance & Tooling (`COMPLETE` - Next.js 16.3.5, strict TS, 0 audit vulnerabilities)
  - `Phase 0D`: Phase 0 Review & Gate Sign-off (`COMPLETE`)
  - `Phase 1`: Secure SaaS Foundation (`COMPLETE` - live Neon DB schema, multi-tenant repository, append-only audit trail)
  - `Phase 2`: Authentication + Owner + RBAC (`COMPLETE` - session token hashing, OAuth PKCE, owner bootstrap, sole owner guard, session revocation, 4-tier RBAC)
  - `Phase 3`: Target Management & Verification (`COMPLETE` - SSRF defense, socket IP pinning, DNS TXT / HTML Meta / HTTP Header verification, active scan authorization lock)
  - `Phase 4`: Deterministic Scanner Engine (`COMPLETE` - 6 check modules, synchronous evidence redaction, deterministic 0-100 scoring, scan execution pipeline, findings triage & lifecycle management)
  - `Phase 5`: Remediation & Reporting Engine (`COMPLETE` - 23-rule remediation catalog, framework code diffs, closed-loop fix verification, print-ready executive PDF/HTML reports, technical JSON exports)
  - `Phase 6`: Deep Web Application Scanning (`COMPLETE` - 4 active check modules for SQLi, XSS, Open Redirect, and Path Traversal; token bucket rate limiter & circuit breaker; 95/95 test suite passing)
  - `Phase 7`: Comprehensive Security Testing & Attack Surface Engine (`COMPLETE` - endpoint crawler, tech stack fingerprinting, 4 new checks: API/GraphQL, security.txt, HTTP methods/XST, stack trace leakage; 31 remediation rules; Attack Surface Explorer UI; 112/112 tests passing)
  - `Phase 8`: Scheduling, Monitoring & Automation Engine (`COMPLETE` - deterministic 5-part cron evaluator, recurring scan schedules, target verification downgrade fail-safe, continuous monitoring & score regression detector, tenant alert feeds, Monitoring UI, 130/130 tests passing)
  - `Phase 9`: CI/CD Security Integration & Developer Workflow (`COMPLETE` - scoped API keys with SHA-256 hash storage, build-breaker Quality Gate policy engine, OASIS SARIF v2.1.0 generator, SSRF-hardened outbound webhooks with HMAC-SHA256 signatures, CI REST endpoints, Developer Settings & Target CI/CD Hub UI, 153/153 tests passing)
  - `Phase 10`: Enterprise Teams, Audit Vault & Collaboration (`COMPLETE` - multi-tenant member roster with 5-tier role hierarchy, Sole Owner Protection Guard, SHA-256 token-hashed invitations, Compliance Audit Vault with RFC 4180 CSV & SIEM JSON exports, tamper-evident cryptographic chain integrity verification, vulnerability finding discussion threads & assignee tracking, 171/171 tests passing, 0 audit vulnerabilities)
  - `Phase 11`: Production Polish, Billing & Enterprise Readiness (`COMPLETE` - canonical INR ₹ pricing matrix, subscriptions & usage ledgers in Neon PostgreSQL, server-side target & scan quota guards, native Stripe billing engine with HMAC-SHA256 signature verification and simulated dev mode, Platform Owner entitlement override, real-time Billing UI with progress meters, 197/197 tests passing, 0 audit vulnerabilities)
  - `Phase 12`: Teams & Agencies (`COMPLETE` - agency organization mode, multi-client workspace provisioning, cross-client aggregated attack surface portfolio cockpit, white-label custom branding inheritance for executive reports, restricted stakeholder access grants `CLIENT_VIEWER`/`CLIENT_MANAGER`, 207/207 tests passing across 14 test suites, 0 audit vulnerabilities)
  - `Phase 13`: Security Resources & Academy (`COMPLETE` - educational content, knowledge hub, interactive multi-framework remediation playbooks with Next.js/Express/Nginx snippets, CLI verification tests, pre-deployment checklists, public & dashboard academy hubs, REST API, bi-directional scan findings rule linkage, 230/230 tests passing across 15 test suites, 0 audit vulnerabilities)
  - `Phase 14`: Production Hardening (`COMPLETE` - isolated worker pool with concurrency control, timeout watchdogs & circuit breakers; network egress firewall blocking all private/loopback/cloud metadata IPv4/IPv6 ranges; tiered sliding-window rate limiter with reverse proxy IP resolution; structured JSON logger with recursive PII & secret redactor; system health diagnostics and container liveness/readiness probes `/api/health`, `/api/health/live`, `/api/health/ready`; disaster recovery runbook; 258/258 tests passing across 16 test suites; 0 audit vulnerabilities)
  - `Phase 15`: Self-Scan & Launch Readiness (`COMPLETE` - ZERIVEX self-scan dogfooding engine executing 15 check categories with certified 100/100 score; subsystem launch readiness evaluator auditing 10 core subsystems; interactive Launch Readiness Cockpit in console; REST APIs `/api/launch-readiness` & `/api/launch-readiness/scan`; STRIDE & OWASP Top 10 Threat Model Review; Production Configuration Checklist; Official Platform Launch Runbook; RFC 9116 security.txt route & file; 269/269 tests passing across 17 test suites; 0 audit vulnerabilities)
- **Next Phase:** Phase 16 / Official Platform Launch & Public Availability

---

## 3. Architecture & Tech Stack Summary
- **Frontend / Full-stack:** Next.js 16.3.5 (App Router, Turbopack, fully patched against all advisories), TypeScript (strict mode enabled).
- **Styling:** Vanilla CSS design tokens (`src/styles/globals.css`), modern typography, high-density accessible UI. Zero cyberpunk / neon / fake terminal gimmicks.
- **Backend Services:** Node.js 22 LTS native HTTP/TLS modules.
- **Database:** Neon Serverless PostgreSQL 16+ with connection pooling, SSL enforcement, UUIDv4 PKs, foreign keys, cascading constraints, and append-only audit tables. SQLite is explicitly excluded from production (ADR-0006). Multi-tenant schema includes `discovered_endpoints` and `technology_fingerprints` (`002_attack_surface.sql`).
- **Authentication:** Dual OAuth 2.0 / OIDC (Google & GitHub) with Authorization Code Flow + PKCE + state + nonce, plus hermetic mock provider for automated testing.
- **Session Management:** Cryptographically random 256-bit opaque tokens stored strictly as SHA-256 hashes in DB. Cookies: `__Host-zerivex_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). Single and multi-device revocation.
- **Authorization:** Four-tier decoupling:
  1. *Authentication:* Who are you? (User + Identity + Session)
  2. *Platform Role:* What can you do? (OWNER > SUPER_ADMIN > ADMIN > SUPPORT > USER)
  3. *Tenant Ownership:* Which resources belong to you? (Organization + Membership + Project + Target)
  4. *Entitlements:* What tier features can you use? (Plan + Entitlements; OWNER receives implicit bypass via server policy).
- **Target Management & SSRF Defense:** 
  - `SafeHttpClient` with pre-flight DNS, socket-level IP pinning, CIDR blacklists (loopback, RFC1918, RFC6598, cloud metadata), chained redirect re-validation, and expanded HTTP method support (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`, `TRACE`).
  - Three independent domain verification protocols: DNS TXT (`_zerivex-challenge.<host>`), HTML `<meta name="zerivex-verification" ...>`, and HTTP header (`X-Zerivex-Verification`).
  - Active scanning authorization lock (ADR-0008): strictly blocks intrusive scans on unverified targets.
- **Attack Surface Discovery & Fingerprinting Engine (Phase 7):**
  - **Bounded Route Crawler (`src/core/surface/crawler.ts`):** Same-host origin validation, depth-capped (max 3), quota-governed (max 50 pages), HTML link/form/input parameter extraction, `/robots.txt` disallows, `/sitemap.xml` parsing, and common endpoint probes.
  - **Heuristic Technology Fingerprinter (`src/core/surface/tech-detector.ts`):** Non-intrusive header, cookie, and HTML/meta signature detection for Next.js, React, Express, Nginx, Apache, Cloudflare, Vercel, Tailwind CSS, Supabase with confidence scoring (0.0 to 1.0).
  - **Attack Surface Repository (`src/core/surface/surface-repository.ts`):** Multi-tenant isolated upsert and query functions for endpoints and detected technologies.
- **Deterministic Scanner Engine (Phases 4, 6 & 7):**
  - **Synchronous Evidence Redaction (ADR-0007):** Pre-persistence sanitizer scrubbing all API keys, credentials, JWTs, DB URLs, Private Keys, sensitive headers, and capping payloads at 64KB. Plaintext secrets NEVER enter PostgreSQL.
  - **Deterministic Scoring Engine:** Mathematical formula starting at 100 with fixed deductions (-25 Critical, -15 High, -5 Medium, -2 Low, 0 Informational), clamped between [0, 100].
  - **14 Deterministic Check Modules (6 Passive + 4 Deep Web + 4 API/Surface):**
    - Passive: `tlsCheck`, `headersCheck`, `corsCheck`, `exposedSecretsCheck`, `cookiesCheck`, `aiCodeSmellsCheck`.
    - Deep Web (Active): `sqliCheck`, `xssCheck`, `openRedirectCheck`, `pathTraversalCheck`.
    - API & Surface: `apiSecurityCheck` (`ZX-SEC-API-001`), `securityTxtCheck` (`ZX-SEC-SECTXT-001`), `httpMethodsCheck` (`ZX-SEC-VERB-001`), `stackTraceCheck` (`ZX-SEC-STACK-001`).
  - **Active Rate Limiter & Circuit Breaker Engine:**
    - Token bucket per domain (5 req/sec cap, 5 burst capacity) to prevent denial of service.
    - Automatic circuit breaker tripping to OPEN after 5 consecutive 5xx or connection failures.
- **Remediation & Reporting Architecture (Phases 5, 6 & 7):**
  - **Remediation Knowledge Catalog (`remediation-catalog.ts`):** Indexes all 31 scan rules with plain-English summaries, security impact analyses, copy-pasteable unified code diffs (Next.js, Express, Nginx), and local CLI test commands.
  - **Closed-Loop Fix Verification (`fix-verifier.ts`):** Single-rule targeted re-test against target endpoints to mathematically verify remediations, automatically transitioning findings to `FIXED` (with `FINDING_VERIFIED_FIXED` audit log) or `REOPENED` (with `FINDING_FIX_FAILED` audit log). Enforces active authorization gate on re-tests.
  - **Executive & Technical Reporting (`report-generator.ts`):**
    - Executive HTML / PDF Report with printable styling (`@media print`), security scorecards, OWASP Top 10 breakdown, and findings remediation diffs.
    - Machine-readable technical JSON report format for CI/CD and developer tools.

---

## 4. Current State Matrix
| Subsystem | State | Details |
| :--- | :--- | :--- |
| **Governance & Tooling** | `COMPLETE` | Next.js 16.3.5, TypeScript strict, Vitest 5.0.1, 0 npm audit vulnerabilities. |
| **Config Validation** | `IMPLEMENTED` | Fail-closed runtime schema validation in `src/core/config/env-validator.ts` with 100% test coverage. |
| **Database State** | `IMPLEMENTED` | Neon PostgreSQL live; 26 canonical tables migrated (`001_initial_schema.sql` through `007_agency_workflows_multi_client.sql`). |
| **Audit Engine** | `IMPLEMENTED` | Append-only `src/core/audit/audit-service.ts` with sensitive data scrubbing & transaction client support. |
| **Multi-Tenancy / IDOR**| `IMPLEMENTED` | Tenant-scoped repository layer (`tenant-repository.ts`, `surface-repository.ts`, `schedule-repository.ts`, `monitoring-repository.ts`, `webhook-repository.ts`, `quality-gate-repository.ts`, `subscription-repository.ts`, `agency-service.ts`). |
| **Authentication State**| `IMPLEMENTED` | SHA-256 session token hashing, Google PKCE + GitHub OAuth, `__Host-zerivex_session` cookie, API Key bearer auth, logout/logout-all. |
| **Platform Bootstrap**  | `IMPLEMENTED` | Atomic one-time owner bootstrap via `INITIAL_OWNER_EMAIL`, `platform_bootstraps` row lock, sole owner demotion protection. |
| **Authorization / RBAC**| `IMPLEMENTED` | `src/core/rbac/permissions.ts`, `authorization-guard.ts` with unified API key / session auth & capability scope enforcement. |
| **Target Management**   | `IMPLEMENTED` | `target-service.ts`, `verification-service.ts`, `/dashboard/targets`, `/dashboard/targets/[id]`. |
| **SSRF Defense**        | `IMPLEMENTED` | `ip-validator.ts`, `safe-http-client.ts` with socket-level IP pinning, redirect re-validation, TRACE/OPTIONS support, webhook egress protection. |
| **Scanner Engine**      | `IMPLEMENTED` | 14 check modules (6 passive + 4 active + 4 API/surface), synchronous evidence redactor, deterministic 0-100 scorer. |
| **Attack Surface Engine**| `IMPLEMENTED` | Route spider crawler, HTML form/param extractor, robots/sitemap parser, tech stack fingerprinter. |
| **Scheduling Engine**   | `IMPLEMENTED` | Deterministic 5-part cron parser, recurring scan scheduler, target verification downgrade protection, atomic worker polling. |
| **Continuous Monitoring**| `IMPLEMENTED` | Score regression detector ($\ge 10$ drop alert), newly introduced vulnerability alerts, historical trendlines, alert management. |
| **Active Rate Limiter** | `IMPLEMENTED` | Token bucket (5 req/sec cap) & circuit breaker tripping on 5 consecutive 5xx errors to protect customer infrastructure. |
| **CI/CD Quality Gates**  | `IMPLEMENTED` | Build-breaker Quality Gate engine with configurable score thresholds, severity caps, and regression blockers. |
| **API Keys & Webhooks**  | `IMPLEMENTED` | Scoped API keys with SHA-256 hash storage, HMAC-SHA256 signed outbound webhooks, SSRF-safe delivery engine. |
| **SARIF v2.1.0 Engine**  | `IMPLEMENTED` | OASIS SARIF v2.1.0 export format for native GitHub Code Scanning and GitLab SAST/DAST integration. |
| **Enterprise Teams**    | `IMPLEMENTED` | 5-tier member hierarchy, SHA-256 token-hashed invitations, Sole Owner Protection Guard. |
| **Audit Vault**         | `IMPLEMENTED` | Cryptographic tamper-evident chain verification, RFC 4180 CSV & SIEM JSON streaming exports. |
| **Collaboration**       | `IMPLEMENTED` | Threaded finding discussions, team member assignment, activity timeline notes. |
| **Subscriptions & Quotas**| `IMPLEMENTED` | Canonical INR ₹ pricing matrix, subscriptions & usage ledgers in Neon DB, server-side target & scan quota guards. |
| **Stripe Billing Engine**| `IMPLEMENTED` | Native Node.js HTTP/TLS + crypto HMAC-SHA256 signature verification (0 npm deps), INR currency checkout, simulated fallback. |
| **Platform Owner Override**| `IMPLEMENTED` | Server-side entitlement bypass for `role: 'OWNER'` without mutating customer billing records. |
| **Agency & Multi-Client**| `IMPLEMENTED` | Agency organization mode, child client provisioning, portfolio risk dashboard, white-label branding inheritance, stakeholder access grants. |
| **Findings Management** | `IMPLEMENTED` | Unified findings inventory, status lifecycle triage, justification-backed risk acceptance, audit trail. |
| **Remediation Engine**  | `IMPLEMENTED` | 31-rule catalog with framework diffs, CLI checks, and targeted fix verification service. |
| **Reporting Engine**    | `IMPLEMENTED` | White-labeled Executive HTML / PDF reports with custom logo, brand color accents & disclaimer, technical JSON exports. |
| **Dashboard UI**        | `IMPLEMENTED` | Complete UI with Overview, Targets, Scans, Findings, Agency Hub, Team, Audit Vault, Billing, and Settings. |
| **Security State**      | `VERIFIED` | 207/207 security and integration tests passing against live database across all 14 test suites. |
| **Test State**          | `VERIFIED` | Vitest test suite running; `tests/security/` passing 100%. |

---

## 5. Architectural Decision Records (ADRs)
- `ADR-0001`: Hybrid OAuth 2.0 / OIDC with Secure Server-Side Hashed Sessions.
- `ADR-0002`: Four-Tier Separation of Authentication, Authorization, Entitlements, and Tenant Scoping.
- `ADR-0003`: Scanner SSRF Defense via Pre-flight DNS, Socket IP Pinning, and Redirect Re-validation.
- `ADR-0004`: PostgreSQL with Relational Multi-Tenant Scoping and Append-Only Audit Trail.
- `ADR-0005`: Phase-Gated Engineering Governance & AI Agent Continuity Protocol.
- `ADR-0006`: Canonical PostgreSQL Persistence Engine (Exclusion of SQLite for Production).
- `ADR-0007`: Mandatory Multi-Stage Evidence Redaction Pipeline.
- `ADR-0008`: Explicit Target Verification Scopes for Scanning Authorization.
- `ADR-0009`: Native Zero-Dependency Stripe Billing Engine with HMAC-SHA256 Signature Verification.
- `ADR-0010`: Multi-Client Architecture & Inherited White-Label Reporting Tokens for Managed Service Agencies.

---

## 6. Environment State
- Git repository active on `main` branch, tracking `origin/main` at `https://github.com/OmvedNagre/Zerivex.git`.
- `.env.local` configured with verified Neon database and CSPRNG secrets.
- Dependencies audited: **0 vulnerabilities**.
- TypeScript strict compilation: **Passing cleanly (`tsc --noEmit`)**.
- Next.js production build: **Compiled successfully (`next build`, all 66 routes)**.
- Security tests: **207/207 passing against live PostgreSQL**.

---

## 7. Current Hand-off & Next Action
- **Current Phase Status:** `PHASE 12 — COMPLETE`
- **Immediate Next Action:** Phase 13 / Production Deployment Preparation.

