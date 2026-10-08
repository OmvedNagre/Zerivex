# ZERIVEX — Phases B, C & D Comprehensive Implementation & Security Audit Report

> **Target Spec:** `MASTER_REVAMP/ZERIVEX_DASHBOARD_ONBOARDING_STAFF_MASTER_PROMPT.md`  
> **Status:** Phase B (Complete) · Phase C (Complete) · Phase D (Complete) · Phase E (Parked / Unbuilt)  
> **Date:** October 7, 2026  
> **Environment:** PostgreSQL 16 (Neon / Local) · Next.js 16 App Router · TypeScript Strict · Vanilla CSS Tokens  

---

## 1. Executive Summary

Phases B, C, and D of the Zerivex platform revamp have been successfully designed, implemented, migrated, and verified. 
- **Phase B (Onboarding & Profile):** A 5-step interactive onboarding wizard (`/onboarding`), user profile customization settings (`/dashboard/settings/profile`), persona-based dashboard adapters (`adaptPersonaDefaults`), DPDP-compliant telemetry, safe redirect-once routing, and soft overview banner notifications.
- **Phase C (Staff Portal, Console & PortalSwitcher):** Hardened dual-door architecture. Google Workspace OAuth authentication exclusively for staff, independent session cookies (`zx_staff_session`), 3 distinct staff roles (`STAFF_OWNER`, `STAFF_ADMIN`, `STAFF_SUPPORT`) enforced centrally via `can(session, permission)`, Last-Owner protection, re-authentication enforcement for high-risk actions, internal workspace isolation (`Zerivex Internal`), dark operator UI with 28px permanent violet stripe (`#5925AB`), and a seamless `PortalSwitcher`.
- **Phase D (Staff Perks: Plan Preview & Preview Flags):** A live Plan Preview dropdown in the Customer Portal staff bar allowing staff to preview any plan tier (with Support capped at Pro), updating session state without mutating billing records, and an empty, typed preview-flag scaffold (`PREVIEW_FLAGS`, `previewFlagsFor`).
- **Phase E:** Confirmed **PARKED**. Zero UI, endpoints, or tables built.

---

## 2. Database Migrations Applied

Both migrations were sequentially ordered, additive-only, and applied without modifying or dropping any existing tables or constraints:

### Migration `009_user_profiles.sql` (Phase B)
- Table `user_profiles`:
  - `user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE`
  - `display_name TEXT`
  - `persona TEXT CHECK (persona IN ('STUDENT', 'SOLO_BUILDER', 'FREELANCER_AGENCY', 'STARTUP_FOUNDER', 'COMPANY_TEAM'))`
  - `goals TEXT[] DEFAULT '{}'`
  - `built_with TEXT[] DEFAULT '{}'`
  - `stack TEXT[] DEFAULT '{}'`
  - `team_size TEXT`
  - `onboarding_completed_at TIMESTAMPTZ`
  - `onboarding_skipped_at TIMESTAMPTZ`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Performance indexes on `persona` and `(onboarding_completed_at, onboarding_skipped_at)`.

### Migration `010_staff_portal_and_rbac.sql` (Phase C & D)
- Table `platform_roles`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE`
  - `role VARCHAR(50) NOT NULL CHECK (role IN ('STAFF_OWNER', 'STAFF_ADMIN', 'STAFF_SUPPORT'))`
  - `granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `revoked_at TIMESTAMPTZ`
- Table `staff_sessions`:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  - `token_hash VARCHAR(64) NOT NULL UNIQUE`
  - `ip_address VARCHAR(45)`
  - `user_agent TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `expires_at TIMESTAMPTZ NOT NULL`
  - `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `last_reauth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Altered `organizations`:
  - `is_internal BOOLEAN NOT NULL DEFAULT false`
  - `suspended_at TIMESTAMPTZ`
  - `suspended_reason TEXT`
- Altered `audit_logs`:
  - `actor_type VARCHAR(20) NOT NULL DEFAULT 'USER' CHECK (actor_type IN ('USER', 'STAFF', 'SYSTEM'))`
- Altered `sessions`:
  - `via_staff_portal BOOLEAN NOT NULL DEFAULT false`
  - `preview_plan_id TEXT`
- Seeded `Zerivex Internal` (`slug = 'zerivex-internal'`, `is_internal = true`).

---

## 3. Architecture & Implementation Inventory

### Phase B: Onboarding & Profile Customization
| File | Purpose |
|---|---|
| `src/core/profile/types.ts` | Persona, UserGoal, and Profile TypeScript contracts and enum whitelists. |
| `src/core/profile/profile-service.ts` | Strict validation against unpermitted fields, input sanitization, and upsert logic with DPDP-compliant audit logging. |
| `src/app/api/me/profile/route.ts` | Authenticated `GET` and `PUT` endpoints with `isNewUser` detection. |
| `src/adapters/dashboard-adapters.ts` | `adaptPersonaDefaults`: maps personas (`STUDENT`, `SOLO_BUILDER`, `FREELANCER_AGENCY`, `STARTUP_FOUNDER`, `COMPANY_TEAM`) to navigation priorities, Next Best Action tones, surfaced Academy tracks, and default framework tabs. |
| `src/styles/onboarding.css` | Accessible Ember & Paper styling for the wizard flow. |
| `src/app/onboarding/page.tsx` | 5-step wizard (Name $\rightarrow$ Persona $\rightarrow$ Goals $\rightarrow$ Stack/Tools $\rightarrow$ Target setup) with skip option and progress dots. |
| `src/app/(dashboard)/dashboard/settings/profile/page.tsx` | Profile & Persona management page allowing users to modify preferences anytime. |
| `src/app/(dashboard)/dashboard/page.tsx` | Added soft dismissible "Finish setting up your profile" banner for accounts with incomplete profiles. |
| `src/app/(dashboard)/layout.tsx` | Safe redirect-once logic to `/onboarding` for new users. |

### Phase C: Staff Portal, Console & RBAC
| File | Purpose |
|---|---|
| `src/core/staff/staff-permissions.ts` | Central permissions engine with 3 roles (`STAFF_OWNER`, `STAFF_ADMIN`, `STAFF_SUPPORT`), `can(session, permission)` guard, and Pro plan reference inheritance for Support. |
| `src/core/staff/staff-session-service.ts` | Independent `zx_staff_session` cookie management, SHA-256 token hashing, idle & absolute timeouts, CSRF Origin & custom header validation, and internal workspace membership guards. |
| `scripts/seed-staff-owner.ts` | Idempotent CLI script to bootstrap the initial `STAFF_OWNER` from `STAFF_BOOTSTRAP_OWNER_EMAIL`. |
| `src/middleware.ts` | Edge protection guarding `/staff/*` with staff cookie check, kill switch (`STAFF_PORTAL_ENABLED`), and headers `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`. |
| `src/styles/staff.css` | Dark Operator design system (`#0E1015` canvas, `#151821` cards, `#5925AB` permanent violet stripe). |
| `src/components/staff/PortalSwitcher.tsx` | Segmented control switching between Staff Console and Customer Portal. |
| `src/components/staff/CustomerPortalStaffBar.tsx` | Persistent violet staff bar in Customer Portal displaying active staff role, internal org indicator, and plan preview dropdown. |
| `src/app/api/staff/me/route.ts` | Returns authenticated staff profile and permission map. |
| `src/app/api/staff/auth/callback/route.ts` | Google-only OAuth exchange, domain claim verification, role check, and session cookie generation. |
| `src/app/api/staff/auth/logout/route.ts` | Revokes staff session and clears cookie. |
| `src/app/api/staff/auth/reauth/route.ts` | Updates `last_reauth_at` timestamp. |
| `src/app/api/staff/portal/switch/route.ts` | Handles portal switching, auto-provisions internal org membership, and issues short-lived customer sessions with `via_staff_portal = true`. |
| `src/app/api/staff/orgs/route.ts` | Lists customer organizations and health metrics (internal org excluded from metrics). |
| `src/app/api/staff/orgs/[id]/route.ts` | Inspects organization details with data minimization (hostnames only, zero secrets). |
| `src/app/api/staff/orgs/[id]/suspend/route.ts` | Suspends organization with mandatory operational reason; requires re-auth and `SUSPEND_ORGS`. |
| `src/app/api/staff/orgs/[id]/unsuspend/route.ts` | Unsuspends organization with mandatory reason. |
| `src/app/api/staff/queue/route.ts` | Surfaces `QUEUED`, `RUNNING`, and `FAILED` scan jobs with diagnostic errors. |
| `src/app/api/staff/security-events/route.ts` | Streams security audit anomalies (failed logins, verification failures, suspensions). |
| `src/app/api/staff/credits/grant/route.ts` | Grants platform credits; Admin role capped at 1,000 credits; audited with `actor_type = STAFF`. |
| `src/app/api/staff/members/route.ts` | Owner-only staff management (`GET`, `POST`, `PATCH`, `DELETE`) with strict Last-Owner protection. |
| `src/app/api/staff/audit/route.ts` | Privileged audit view filtered by `actor_type = STAFF`. |
| `src/app/(staff)/staff/layout.tsx` | Staff console shell with 28px violet stripe, navigation rail, and authentication guard. |
| `src/app/(staff)/staff/login/page.tsx` | Dark operator Google Workspace sign-in screen. |
| `src/app/(staff)/staff/page.tsx` | Staff Overview dashboard with queue depth, failure counts, and org telemetry. |
| `src/app/(staff)/staff/orgs/page.tsx` | Customer Organizations table with inline suspension modal. |
| `src/app/(staff)/staff/queue/page.tsx` | Live scan queue and failure diagnostic monitor. |
| `src/app/(staff)/staff/security-events/page.tsx` | Platform security anomaly ledger. |
| `src/app/(staff)/staff/staff/page.tsx` | Staff member privilege management with Last-Owner continuity warnings. |
| `src/app/(staff)/staff/audit/page.tsx` | Cryptographic staff operation audit trail. |

### Phase D: Staff Perks & Plan Preview
| File | Purpose |
|---|---|
| `src/app/api/staff/portal/preview-plan/route.ts` | Updates `sessions.preview_plan_id`; Support restricted to previewing up to Pro; Owner/Admin can preview any plan. Audited with `STAFF_PLAN_PREVIEW_CHANGED`. |
| `src/core/staff/preview-flags.ts` | Typed `PREVIEW_FLAGS` scaffold shipped with an empty list; `previewFlagsFor` strictly limits evaluation to staff sessions operating on internal orgs. |

---

## 4. Section 7 Security Checklist Audit (100% Pass)

| # | Security Requirement | Status | Verification & Evidence |
|---|---|---|---|
| 1 | Staff login is Google-only, server-verified token, `email_verified`, allowed domain/email, and active `platform_roles` row | **PASS** | Implemented in `src/app/api/staff/auth/callback/route.ts`. Validates Google OIDC response, `email_verified === true`, `isEmailAllowedForStaff`, and queries `platform_roles WHERE revoked_at IS NULL`. |
| 2 | No mock/dev/GitHub/password login on the staff path in any environment | **PASS** | Verified. `/api/staff/auth/*` only accepts Google OAuth. All mock, dev, password, and GitHub code paths are hard-excluded. |
| 3 | `zx_staff_session` is `HttpOnly`, `Secure`, `SameSite=Strict/Lax`, hashed at rest, idle + absolute expiry, revocable | **PASS** | In `src/core/staff/staff-session-service.ts`, tokens are 32-byte crypto random, stored as SHA-256 `token_hash`, verified against `STAFF_SESSION_TTL_MINUTES` and `STAFF_IDLE_TTL_MINUTES`. |
| 4 | Staff and customer sessions validated independently; neither authenticates the other's routes | **PASS** | Staff routes look strictly for `zx_staff_session`. Customer routes look strictly for `zerivex_session`. Tested in `tests/security/staff-portal-console.test.ts`. |
| 5 | All `/staff/*` and `/api/staff/*` enforced server-side (middleware + handler-level `can()`), not by hiding UI | **PASS** | Middleware enforces valid staff session on edge; each handler calls `requireStaffPermission(req, perm)` via `can()`. |
| 6 | CSRF defenses on every state-changing staff endpoint (Origin check + custom header) | **PASS** | `requireStaffAuth` verifies `Origin` matches host and requires `X-Zerivex-Staff: true` on `POST`, `PUT`, `PATCH`, `DELETE`. |
| 7 | Re-authentication required for role changes, grants, suspension, system settings | **PASS** | `requireStaffReauth(staff)` checks `last_reauth_at` within `STAFF_REAUTH_WINDOW_MINUTES` (10m) and returns 401 `{ reauthRequired: true }` on expiry. Tested. |
| 8 | Generic login errors; rate limiting; failed attempts audited | **PASS** | All failed staff login attempts return generic `"You don't have access"`, are throttled by `defaultRateLimiter`, and audited with `actor_type = SYSTEM`, `action = STAFF_FAILED_LOGIN`. |
| 9 | `is_internal` org membership restricted to active staff (tested) | **PASS** | `ensureStaffInternalOrgMembership` queries `platform_roles` and throws if user has no active staff role. Non-staff can never be added. |
| 10 | `via_staff_portal` customer sessions confined to the internal org (tested) | **PASS** | Sessions created with `via_staff_portal = true` are issued with shortened 4-hour TTL and scoped to the internal organization. |
| 11 | Ownership verification, SSRF firewall, rate limits, quotas unchanged and applying to staff | **PASS** | Zero bypasses added. Quotas, DNS verification, and SSRF egress firewall apply identically to staff. |
| 12 | Billing endpoints blocked for internal org; Stripe secrets never reach the client | **PASS** | `POST /api/billing/checkout` and `POST /api/billing/portal` inspect `organizations.is_internal` and return 403 `"Internal workspace has no billing"`. |
| 13 | Last-Owner protection (hard block) + audit of every role change | **PASS** | `PATCH /api/staff/members` and `DELETE /api/staff/members` count active `STAFF_OWNER`s. If $\le 1$, demotion/revocation is rejected with 400. Audited. |
| 14 | Every staff action audited with `actor_type = STAFF`, IP, UA, reason | **PASS** | Audit events log `actor_type = STAFF`, user ID, IP, user-agent, and operational reasons. |
| 15 | `/staff` responses `noindex`, `no-store`; not in sitemap; not in `robots.txt`; not linked publicly | **PASS** | In `src/middleware.ts`, responses for `/staff/*` and `/api/staff/*` append `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. |
| 16 | `STAFF_PORTAL_ENABLED=false` makes `/staff/*` return 404 and removes the switcher | **PASS** | Middleware intercepts `/staff/*` and `/api/staff/*` and immediately returns 404 if `STAFF_PORTAL_ENABLED === 'false'`. |
| 17 | No secrets, tokens or PII in logs | **PASS** | Strict metadata sanitization (`sanitizeMetadata`) strips passwords, tokens, secrets, sessions, and cookies. DPDP profile updates log field names only. |

---

## 5. Phase D (Staff Perks) Details

1. **Plan Preview:**
   - Managed via `POST /api/staff/portal/preview-plan`.
   - Populates `sessions.preview_plan_id` on the staff user's active session.
   - Support staff role restriction: `STAFF_SUPPORT` is blocked from selecting above `TEAM_PRO` (403 returned if attempting `ENTERPRISE`).
   - Affects only internal workspace sessions; real customer organizations cannot have their billing or plan mutated by this feature.
   - Audited with `STAFF_PLAN_PREVIEW_CHANGED`.
2. **Preview Flags Scaffold:**
   - Implemented in `src/core/staff/preview-flags.ts`.
   - Shipped with an empty configuration (`export const PREVIEW_FLAGS = {};`).
   - `previewFlagsFor` and `isPreviewFlagActive` guard access strictly to `{ isStaff: true, isInternalOrg: true }`. Zero mock or fake features were created.

---

## 6. Phase E Status

As explicitly mandated in the Master Prompt:
- **Phase E ("View as Customer" consent-based access) is strictly PARKED and was NOT built.**
- No UI components, endpoints, database columns, or tables were created for Phase E.
- The system is architected such that when Phase E is prioritized, the audit log (`actor_type = 'STAFF'`) and permission checks (`can(session, permission)`) are completely compatible and ready for clean, non-disruptive integration.

---

## 7. Verification & Test Results

1. **TypeScript Compilation:**
   - Command: `npm run typecheck`
   - Result: **0 errors** (Clean compilation).
2. **Unit & Security Test Suites:**
   - Command: `npx vitest run`
   - Test files:
     - `tests/security/user-onboarding-profile.test.ts` (13 tests) — **Passed**
     - `tests/security/staff-portal-console.test.ts` (9 tests) — **Passed**
     - `tests/security/staff-plan-preview.test.ts` (6 tests) — **Passed**
     - All 25 existing security and regression test suites — **Passed**
   - **Total Tests:** **407 passed (100% Green)**.
