# ZERIVEX_CONTEXT.md: Long-Term AI Continuity & State Tracker

> **Project:** ZERIVEX  
> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Current Phase:** PHASE 0D — PHASE 0 REVIEW & GATE SIGN-OFF  
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
- **Current Phase:** `PHASE 0D — PHASE 0 REVIEW & GATE SIGN-OFF`
- **Sub-Phase History:**
  - `Phase 0A`: Pre-Implementation Discovery (`COMPLETE`)
  - `Phase 0B`: Owner Provisioning (`IN_PROGRESS` - Awaiting `.env.local` credentials)
  - `Phase 0C`: Governance & Skeleton Initialization (`COMPLETE` - 0 audit vulnerabilities, Vitest tests passing, `next build` passing)
  - `Phase 0D`: Final Phase 0 Review (`READY_FOR_REVIEW`)
- **Phase Status:** `READY_FOR_REVIEW`
- **Next Phase:** `PHASE 1 — SECURE SAAS FOUNDATION` (Blocked on Owner Approval & Provisioning)

---

## 3. Architecture & Tech Stack Summary
- **Frontend / Full-stack:** Next.js 16.3.5 (App Router, Turbopack, fully patched against all advisories), TypeScript (strict mode enabled).
- **Styling:** Vanilla CSS design tokens (`src/styles/globals.css`), modern typography, high-density accessible UI. Zero cyberpunk / neon / fake terminal gimmicks.
- **Backend Services:** Node.js 22 LTS native HTTP/TLS modules.
- **Database:** PostgreSQL (Neon / local PostgreSQL) with strict relational schema, UUIDv4 PKs, foreign keys, cascading constraints, and append-only audit tables. SQLite is explicitly excluded from production (ADR-0006).
- **Authentication:** Dual OAuth 2.0 / OIDC (Google & GitHub) with Authorization Code Flow + PKCE + state + nonce.
- **Session Management:** Cryptographically random 256-bit opaque tokens stored as SHA-256 hashes in DB. Cookies: `__Host-zerivex_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`).
- **Authorization:** Four-tier decoupling:
  1. *Authentication:* Who are you? (User + Identity + Session)
  2. *Platform Role:* What can you do? (OWNER > SUPER_ADMIN > ADMIN > SUPPORT > USER)
  3. *Tenant Ownership:* Which resources belong to you? (Organization + Membership + Project + Target)
  4. *Entitlements:* What tier features can you use? (Plan + Entitlements; OWNER receives implicit bypass via server policy).
- **Scanner Engine:** Isolated deterministic scanner engine with strict SSRF defense (pre-flight DNS, socket-level IP pinning, CIDR blacklisting, redirect re-validation), explicit target verification scopes (ADR-0008), and synchronous evidence redaction (ADR-0007).

---

## 4. Current State Matrix
| Subsystem | State | Details |
| :--- | :--- | :--- |
| **Governance & Tooling** | `COMPLETE` | Next.js 16.3.5, TypeScript strict, Vitest 5.0.1, 0 npm audit vulnerabilities. |
| **Config Validation** | `IMPLEMENTED` | Fail-closed runtime schema validation in `src/core/config/env-validator.ts` with 100% test coverage. |
| **Database State** | `PLANNED` | PostgreSQL canonical schema designed. Ready for Phase 1 migration execution. |
| **API State** | `PLANNED` | Standardized envelope `{ success, data/error }` defined. Endpoints mapped. |
| **Authentication State**| `PLANNED` | OAuth flow, session token hashing, state machine, and one-time owner bootstrap designed. |
| **Authorization State** | `PLANNED` | Server-side RBAC & tenant scoping guards specified. No client-side bypasses. |
| **Scanner State** | `PLANNED` | SafeHttpClient with IP pinning, 6 check modules, and evidence redactor architected. |
| **Subscription State**  | `PLANNED` | Abstract billing and entitlement interface designed. |
| **Security State** | `VERIFIED` | 14-point Threat Model Traceability Matrix active; initial security tests passing. |
| **Test State** | `IMPLEMENTED` | Vitest test suite running; `tests/security/config.test.ts` passing. |

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
- Git repository active on `main` branch.
- Dependencies audited: **0 vulnerabilities**.
- TypeScript strict compilation: **Passing cleanly**.
- Next.js production build: **Compiled successfully**.
- Security tests: **4/4 passing**.

---

## 7. Current Hand-off & Next Action
- **Current Phase Status:** `PHASE 0D — READY FOR REVIEW`
- **Immediate Next Action:** Obtain Platform Owner sign-off on Phase 0 and proceed to **Phase 1: Secure SaaS Foundation**.
