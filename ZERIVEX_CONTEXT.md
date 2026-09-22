# ZERIVEX_CONTEXT.md: Long-Term AI Continuity & State Tracker

> **Project:** ZERIVEX  
> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Current Phase:** PHASE 0A — PRE-IMPLEMENTATION DISCOVERY  
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
- **Current Phase:** `PHASE 0A — PRE-IMPLEMENTATION DISCOVERY`
- **Phase Status:** `READY_FOR_REVIEW`
- **Previous Phase:** N/A (Project initiation)
- **Next Phase:** `PHASE 0B / PHASE 1 — SECURE SAAS FOUNDATION` (Blocked on Owner Approval & Provisioning)

---

## 3. Architecture & Tech Stack Summary
- **Frontend / Full-stack:** Next.js 14+ (App Router), TypeScript (strict mode enabled).
- **Styling:** Vanilla CSS design tokens, modern typography (Outfit & Inter), high-density accessible UI. Zero cyberpunk / neon / fake terminal gimmicks.
- **Backend Services:** Node.js 20+ LTS native HTTP/TLS modules.
- **Database:** PostgreSQL (Neon / local PostgreSQL) with strict relational schema, UUIDv4 PKs, foreign keys, cascading constraints, and append-only audit tables.
- **Authentication:** Dual OAuth 2.0 / OIDC (Google & GitHub) with Authorization Code Flow + PKCE + state + nonce.
- **Session Management:** Cryptographically random 256-bit opaque tokens stored as SHA-256 hashes in DB. Cookies: `__Host-zerivex_session` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`).
- **Authorization:** Four-tier decoupling:
  1. *Authentication:* Who are you? (User + Identity + Session)
  2. *Platform Role:* What can you do? (OWNER > SUPER_ADMIN > ADMIN > SUPPORT > USER)
  3. *Tenant Ownership:* Which resources belong to you? (Organization + Membership + Project + Target)
  4. *Entitlements:* What tier features can you use? (Plan + Entitlements; OWNER receives implicit bypass via server policy).
- **Scanner Engine:** Isolated deterministic scanner engine with strict SSRF defense (pre-flight DNS, socket-level IP pinning, CIDR blacklisting, redirect re-validation).

---

## 4. Current State Matrix
| Subsystem | State | Details |
| :--- | :--- | :--- |
| **Database State** | `PLANNED` | Relational schema designed in `docs/ARCHITECTURE.md`. Awaiting connection string in `docs/SETUP_REQUIREMENTS.md`. |
| **API State** | `PLANNED` | Standardized envelope `{ success, data/error }` defined. Endpoints mapped. |
| **Authentication State**| `PLANNED` | OAuth flow, session token hashing, state machine, and one-time owner bootstrap designed. |
| **Authorization State** | `PLANNED` | Server-side RBAC & tenant scoping guards specified. No client-side bypasses. |
| **Scanner State** | `PLANNED` | SafeHttpClient with IP pinning and 6 core check modules architected. |
| **Subscription State**  | `PLANNED` | Abstract billing and entitlement interface designed. |
| **Security State** | `SPECIFIED`| Threat model documented. SSRF defense, tenant isolation, and audit logging detailed. |
| **Test State** | `SPECIFIED`| Security test suite structure defined (`tests/security/`). |

---

## 5. Architectural Decision Records (ADRs)
- `ADR-0001`: Hybrid OAuth 2.0 / OIDC with Secure Server-Side Hashed Sessions.
- `ADR-0002`: Four-Tier Separation of Authentication, Authorization, Entitlements, and Tenant Scoping.
- `ADR-0003`: Scanner SSRF Defense via Pre-flight DNS, Socket IP Pinning, and Redirect Re-validation.
- `ADR-0004`: PostgreSQL with Relational Multi-Tenant Scoping and Append-Only Audit Trail.
- `ADR-0005`: Phase-Gated Engineering Governance & AI Agent Continuity Protocol.

---

## 6. Known Issues & Known Security Risks
- *Risk 1 (External dependency):* Live Google/GitHub OAuth testing requires client credentials from developer portals. *Mitigation:* In-memory Mock OAuth Provider will be included in the test harness for zero-friction automated security tests.
- *Risk 2 (SSRF TOCTOU):* DNS rebinding during HTTP requests. *Mitigation:* Socket IP pinning in `SafeHttpClient` connects directly to pre-validated IP address, bypassing secondary DNS resolution.

---

## 7. Environment State
- Repository initialized with Git (`main` branch).
- `.gitignore` configured to strictly block `.env`, `.env.local`, credentials, and keys.
- `.env.example` created with variable templates (no secrets).
- `docs/SETUP_REQUIREMENTS.md` created with grouped external service dependencies.

---

## 8. Completed Work
- [x] Initialized Git repository on `main`.
- [x] Configured `.gitignore` for secret prevention.
- [x] Created `.env.example`.
- [x] Completed Phase 0A pre-implementation discovery (`docs/SETUP_REQUIREMENTS.md`).
- [x] Created ADR-0001 through ADR-0005.
- [x] Established continuity governance (`ZERIVEX_CONTEXT.md` & `HANDOFF.md`).

---

## 9. Current Hand-off & Next Action
- **Current Phase Status:** `PHASE 0A — READY FOR REVIEW`
- **Immediate Next Action:** Present Pre-Implementation Discovery to Owner, await environment configuration & formal approval to proceed to Phase 1.
