# ZERIVEX_CONTEXT.md: Long-Term AI Continuity & State Tracker

> **Project:** ZERIVEX  
> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Current Phase:** PHASE 3 — TARGET MANAGEMENT & VERIFICATION  
> **Phase Status:** READY_FOR_REVIEW  
> **Owner Authority:** The platform owner is the final authority for architecture, scope, phase approval, and security trade-offs.  
> **Security Rule:** Security correctness over visual completion. Never claim a security feature works unless implemented and tested. Never fake findings.

---

## 1. Project Overview & Scope
Zerivex is an independent cybersecurity SaaS platform designed specifically for modern web applications and APIs, with specialized intelligence for applications developed with AI coding tools (Cursor, Lovable, v0, Bolt, Claude Code, Antigravity, etc.).

Zerivex operates on a closed-loop security cycle:
`DISCOVER -> MAP -> ANALYZE -> VALIDATE -> REPORT -> REMEDIATE -> VERIFY -> MONITOR`

---

## 2. Current Status & Phase State
- **Current Phase:** `PHASE 3 — TARGET MANAGEMENT & VERIFICATION`
- **Phase Status:** `READY_FOR_REVIEW`
- **Completed Phases:**
  - `Phase 0A`: Pre-Implementation Discovery (`COMPLETE`)
  - `Phase 0B`: Owner Provisioning (`COMPLETE` - Neon PostgreSQL connected, secrets configured in `.env.local`)
  - `Phase 0C`: Governance & Tooling (`COMPLETE` - Next.js 16.3.5, strict TS, 0 audit vulnerabilities)
  - `Phase 0D`: Phase 0 Review & Gate Sign-off (`COMPLETE`)
  - `Phase 1`: Secure SaaS Foundation (`COMPLETE` - live Neon DB schema, multi-tenant repository, append-only audit trail)
  - `Phase 2`: Authentication + Owner + RBAC (`COMPLETE` - session token hashing, OAuth PKCE, owner bootstrap, sole owner guard, session revocation, 4-tier RBAC)
  - `Phase 3`: Target Management & Verification (`COMPLETE` - SSRF defense, socket IP pinning, DNS TXT / HTML Meta / HTTP Header verification, active scan authorization lock)
- **Next Phase:** `PHASE 4 — DETERMINISTIC SCANNER ENGINE` (Blocked on Owner Review & Sign-off)

---

## 3. Architecture & Tech Stack Summary
- **Frontend / Full-stack:** Next.js 16.3.5 (App Router, Turbopack, fully patched against all advisories), TypeScript (strict mode enabled).
- **Styling:** Vanilla CSS design tokens (`src/styles/globals.css`), modern typography, high-density accessible UI. Zero cyberpunk / neon / fake terminal gimmicks.
- **Backend Services:** Node.js 22 LTS native HTTP/TLS modules.
- **Database:** Neon Serverless PostgreSQL 16+ with connection pooling, SSL enforcement, UUIDv4 PKs, foreign keys, cascading constraints, and append-only audit tables. SQLite is explicitly excluded from production (ADR-0006).
- **Authentication:** Dual OAuth 2.0 / OIDC (Google & GitHub) with Authorization Code Flow + PKCE + state + nonce, plus hermetic mock provider for automated testing.
- **Session Management:** Cryptographically random 256-bit opaque tokens stored strictly as SHA-256 hashes in DB. Cookies: `__Host-zerivex_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`). Single and multi-device revocation.
- **Authorization:** Four-tier decoupling:
  1. *Authentication:* Who are you? (User + Identity + Session)
  2. *Platform Role:* What can you do? (OWNER > SUPER_ADMIN > ADMIN > SUPPORT > USER)
  3. *Tenant Ownership:* Which resources belong to you? (Organization + Membership + Project + Target)
  4. *Entitlements:* What tier features can you use? (Plan + Entitlements; OWNER receives implicit bypass via server policy).
- **Target Management & SSRF Defense:** 
  - `SafeHttpClient` with pre-flight DNS, socket-level IP pinning, CIDR blacklists (loopback, RFC1918, RFC6598, cloud metadata), and chained redirect re-validation.
  - Three independent domain verification protocols: DNS TXT (`_zerivex-challenge.<host>`), HTML `<meta name="zerivex-verification" ...>`, and HTTP header (`X-Zerivex-Verification`).
  - Active scanning authorization lock (ADR-0008): strictly blocks intrusive scans on unverified targets.

---

## 4. Current State Matrix
| Subsystem | State | Details |
| :--- | :--- | :--- |
| **Governance & Tooling** | `COMPLETE` | Next.js 16.3.5, TypeScript strict, Vitest 5.0.1, 0 npm audit vulnerabilities. |
| **Config Validation** | `IMPLEMENTED` | Fail-closed runtime schema validation in `src/core/config/env-validator.ts` with 100% test coverage. |
| **Database State** | `IMPLEMENTED` | Neon PostgreSQL live; 13 canonical tables migrated (`001_initial_schema.sql`). |
| **Audit Engine** | `IMPLEMENTED` | Append-only `src/core/audit/audit-service.ts` with sensitive data scrubbing & transaction client support. |
| **Multi-Tenancy / IDOR**| `IMPLEMENTED` | Tenant-scoped repository layer (`src/core/db/repositories/tenant-repository.ts`). |
| **Authentication State**| `IMPLEMENTED` | SHA-256 session token hashing, Google PKCE + GitHub OAuth, `__Host-zerivex_session` cookie, logout/logout-all. |
| **Platform Bootstrap**  | `IMPLEMENTED` | Atomic one-time owner bootstrap via `INITIAL_OWNER_EMAIL`, `platform_bootstraps` row lock, sole owner demotion protection. |
| **Authorization / RBAC**| `IMPLEMENTED` | `src/core/rbac/permissions.ts`, `authorization-guard.ts` with server-side role/permission guards & CSRF defense. |
| **Target Management**   | `IMPLEMENTED` | `target-service.ts`, `verification-service.ts`, `/dashboard/targets`, `/dashboard/targets/[id]`. |
| **SSRF Defense**        | `IMPLEMENTED` | `ip-validator.ts`, `safe-http-client.ts` with socket-level IP pinning and redirect re-validation. |
| **Admin & Security UI** | `IMPLEMENTED` | `/login`, `/dashboard`, `/dashboard/settings/security`, `/dashboard/targets`, `/admin` control center. |
| **Scanner State** | `PLANNED` | 6 check modules, safe client runner, and evidence redactor architected for Phase 4. |
| **Subscription State**  | `PLANNED` | Abstract billing and entitlement interface designed. |
| **Security State** | `VERIFIED` | 37/37 security tests passing against live database across config, isolation, session, RBAC, and targets. |
| **Test State** | `VERIFIED` | Vitest test suite running; `tests/security/` passing 100%. |

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

---

## 6. Environment State
- Git repository active on `main` branch, tracking `origin/main` at `https://github.com/OmvedNagre/Zerivex.git`.
- `.env.local` configured with verified Neon database and CSPRNG secrets.
- Dependencies audited: **0 vulnerabilities**.
- TypeScript strict compilation: **Passing cleanly (`tsc --noEmit`)**.
- Next.js production build: **Compiled successfully (`next build`)**.
- Security tests: **37/37 passing against live PostgreSQL**.

---

## 7. Current Hand-off & Next Action
- **Current Phase Status:** `PHASE 3 — READY FOR REVIEW`
- **Immediate Next Action:** Obtain Platform Owner sign-off on Phase 3 and proceed to **Phase 4: Deterministic Scanner Engine**.
