# ZERIVEX — Dashboard, Onboarding & Staff Portal Master Prompt (Part 2)

> **Attach with:** `ZERIVEX_SYSTEM_AND_UI_ARCHITECTURE_SPEC.md`, `ZERIVEX_Master_Pricing_Monetization_Prompt.md`, and Part 1 (`ZERIVEX_UI_MASTER_PROMPT.md`).
> **Agent:** Antigravity (Gemini flash, high) with the *impeccable* and *GSAP* skills.
> **Builds on Part 1:** the marketing site, pricing page, tokens ("Ember & Paper"), Lucide icons, Radix `ui/` kit, Lenis (marketing only) already exist. **Reuse them. Do not redo them.**
> **Goal:** fix and redesign everything *after login*, add a hover-expand sidebar, add new-user onboarding, split the product into a **Customer Portal** and a **Staff Console**, and give staff a **PortalSwitcher**.

---

## 0. HOW YOU MUST WORK

1. **Phases A → B → C → D, in order.** Phase E is a **parked spec: do not build it** (Section 9).
2. **Stop gates.** Before you start **Phase B** and before you start **Phase C**, post a short plan (files, migrations, endpoints, risks) and **wait for my "go"**. Phases B and C change the backend; Phase A does not.
3. **Never guess** file names, routes, fields, enums or API shapes. Run `ls`, `rg`, open the real files. If the repo differs from the spec, say so.
4. **Backend rules differ per phase:**
   - **Phase A: frontend only.** No changes in `src/core/`, `src/app/api/`, migrations.
   - **Phases B, C, D: additive backend only.** New migrations (next numbers after the last one; the spec says `001–007`, so likely `008+`; verify), new tables/columns with safe defaults, new endpoints. **Never** drop, rename or loosen anything existing. Never weaken any existing guard (ownership verification, SSRF egress firewall, rate limits, RBAC, audit logging, edge auth on `/dashboard/*`).
5. **All existing tests (269) must stay green**, plus every new feature needs new tests (Section 10).
6. **Security-sensitive code (Phase C) must follow Section 7 exactly.** If anything is ambiguous, choose the safer option and flag it in your report.
7. **No Tailwind.** Vanilla CSS + tokens + the Part 1 `ui/` kit. Lucide icons only (no emoji or glyph icons). No theme toggle (single light theme for customers).
8. **Hydration-safe:** never read `localStorage`, `window`, cookies via JS, or `Date.now()` during render. Use a mounted flag or `useSyncExternalStore` with a server snapshot.
9. **Truthfulness rule from Part 1 still applies:** never show unimplemented capabilities as working; use "Coming soon" or hide.
10. **Report format after every phase** (max 15 lines): files changed · migrations · what works · checks run + results · open questions.
11. Use the *impeccable* skill for a critique/polish pass at the end of each phase. Where its defaults conflict with this document, this document wins.

---

## 1. WHAT IS WRONG TODAY (from the current dashboard screenshots)

Fix all of these. Each has an ID so you can reference it in reports.

**Correctness (highest priority)**
- **D1. Overview contradicts the rest of the product.** Overview shows *100/100, Grade A+, "Zero active defects", Open vulnerabilities 0/0/0/0, Build Gate PASSED*, while Findings shows **55 findings with 6 open Critical/High** and Scans shows a **fleet mean of 80** (several sites at 69). A security product must never say "all clear" when it isn't. Likely cause: adapters default failed/missing/filtered data to `0` and render it as green. **Find the root cause, fix it, and add tests.**
- **D2. "Build Gate PASSED"** is shown even when no quality-gate policy may exist. If no policy is configured, show **"Not configured"** (neutral), not PASSED.

**Visual and consistency**
- **D3.** Dashboard feels like another product: black slabs on a cream page, blue primary buttons (Register & Scan Target, Run Scan), a gold "Control Center" pill, white pill buttons, an unstyled grey "Launch New Scan" button.
- **D4. Contrast failures:** page subtitles and the green mono eyebrow labels are almost invisible on cream.
- **D5. Bugs:** search icon overlaps the "F" in "Filter by target or host…"; "Launch New Scan" button is unstyled and clipped at the right edge; a faint ghost caption sits inside the Scans table header ("Fleet Scan Execution History…"); the **scan mode chip "ACTIVE" collides with the status filter "Active"** (status filter means in-progress, mode means verified-active).
- **D6. Information design:** Findings shows the same issue repeated (e.g. `/env` on one host ×4); the severity chip says HIGH and the confidence chip also says HIGH with no label; Targets has 8 identical-looking rows (Verified / Exact Host / DNS TXT) with no score or issue count; a trash icon sits directly beside "Details"; API Keys and Webhooks are not reachable from the Modules menu; the user chip says **OWNER** (confusing next to the platform owner concept).
- **D7. Overview is long and jargon-heavy** ("Empirical posture", "perimeter watch", "Deterministic AST & probe findings"), and the "Platform Security Modules" grid just duplicates the navigation.
- **D8. Unknown "Control Center" link** in the top nav. Find out what it is. If it is internal/admin, **remove it from the customer UI** (it moves to the Staff Console, with a server-side guard). If it is a customer feature, restyle it like any other nav item.
- **D9.** Dev/mock login: confirm it is hard-disabled in production builds (check `NODE_ENV` and the existing gate). It must never be reachable on the staff path under any condition.

---

## 2. PHASE MAP

| Phase | What | Backend | Gate |
|---|---|---|---|
| **A** | Truth fixes, restyle, hover sidebar, page improvements, plain-English copy | None | none |
| **B** | New-user onboarding + profile | Additive (1 table, 2 endpoints) | **plan first, wait for "go"** |
| **C** | Staff login, Staff Console, internal workspace, **PortalSwitcher**, 3 staff roles | Additive (roles, sessions, flags) | **plan first, wait for "go" + security checklist** |
| **D** | Staff perks: **Plan Preview**, preview-flag scaffold | Small additive | none |
| **E** | "View as customer" (consent-based support access) | **PARKED. Do not build.** | n/a |

---

## 3. SHARED DESIGN RULES (customer dashboard)

- **Tokens:** use Part 1's `tokens.css` (Ember & Paper). Page canvas `--ds-bg-page`; cards `--ds-bg-card` white with `--ds-border-subtle` hairline and `--ds-radius-lg`; shadow `--ds-shadow-1/2`.
- **Dark is for code only:** terminal/log/evidence/JSON/diff panels use `--ds-bg-ink`. Tables, stat cards, forms and modals are **light**.
- **One button system** (from `ui/Button`): `brand` (ember, ink text, **max one per viewport**), `secondary` (white + border), `ghost`, `danger`. **Remove** all blue primaries, gold pills, and unstyled buttons. "Run Scan" is `secondary` per row; the page-level main action ("Launch New Scan", "Register New Target") is the single `brand` button.
- **Text contrast:** subtitles use `--ds-text-secondary` (`#484A54`); eyebrow labels use `--ds-text-muted` or ink at 12 px uppercase, never pale green. Minimum 4.5:1.
- **Status chips:** icon + text, never color alone. Severity chips use `--sev-*` tokens plus Lucide icons (`OctagonAlert`, `TriangleAlert`, `CircleAlert`, `Info`).
- **Every table/card:** loading skeleton, empty state (icon + sentence + one action), **error state ("Couldn't load this. Retry")**. See D1: **errors and loading never render as zeros or green.**
- **Lenis stays OFF in the dashboard and staff console.**

---

# PHASE A: DASHBOARD TRUTH, RESTYLE, SIDEBAR (frontend only)

## A1. Truthfulness fixes (do first; add tests)

1. Trace how Overview computes: fleet score, grade, "Zero active defects", open-vulnerability counts, Build Gate, "verified targets". Document the real data source for each in your report.
2. **Scoring:** find the backend's real scoring logic. Fleet score = whatever the backend defines (likely mean of the latest completed scan score per target). Use exactly that. Never display a score the backend did not produce.
3. **Rules to enforce in adapters and components:**
   - Loading → skeleton. Error → "Couldn't load" with Retry. **Never default to 0 / A+ / PASSED.**
   - "Zero active defects" / green "all clear" only when: data loaded successfully AND at least one completed scan exists AND open findings (not FIXED / FALSE_POSITIVE / ACCEPTED_RISK) = 0.
   - If any open Critical/High exists, the headline state is **"Needs attention: N critical/high open"** (amber/red), and the grade cannot read as A+.
   - No completed scans yet → "No scans yet" (neutral) with a CTA.
   - Build Gate: `PASSED` / `FAILED` only if a policy exists and the latest evaluation exists; else `Not configured` (neutral, with "Set up a gate" link).
4. Tests: adapter unit tests for each state (loading, error, no data, partial, healthy, issues present) and a regression test reproducing the screenshot (score 100 with 6 open high → must **not** render "Zero active defects").
5. **"How is this calculated?"** popover on the score ring that explains the real formula as implemented. Read it from the code; do not invent a formula. If the formula is not documented, summarize what the code does and say so.

## A2. Restyle the whole dashboard to Ember & Paper

Apply Section 3 to **every** page (Overview, Targets, Targets/[id]/surface, monitoring, ci-cd, Scans, Scans/[id], Findings, Audit Vault, Team, Agency, Billing, Settings/*). Fix **D3, D4, D5** completely. Specific fixes:
- Input with leading icon: use padding-inline-start ≥ 40 px so the icon never overlaps text.
- Page header pattern everywhere: `eyebrow (12px, muted) → H1 → one-line description (secondary color) → [primary brand action at right]`.
- Remove the ghost caption in the Scans table header.
- Rename **scan mode** labels: `PUBLIC_PASSIVE` → "Passive", `VERIFIED_ACTIVE` → "Active (verified)". Rename the **status** filter pill "Active" → "In progress" (covers `QUEUED` + `RUNNING`). Filters: *All · In progress · Completed · Failed*.
- Rename the user role chip: show **"Workspace owner"**, **"Admin"**, **"Member"**, **"Viewer"**, **"Auditor"** (display names for the `ORG_*` roles). Never show a bare "OWNER".

## A3. Hover-expand sidebar (replaces the top nav inside `/dashboard/*`)

**Behavior**
- **Collapsed (default):** 72 px rail, Lucide icons only, tooltips (Radix Tooltip) on hover/focus.
- **Hover/focus:** after **~120 ms hover intent** the rail expands to **248 px as an overlay** (it floats over the content; the content area keeps a fixed 72 px left margin so tables and layouts **do not jump**). Labels, group headings and badges fade in.
- **Leave:** after **~200 ms** it collapses back. Keyboard: opens on `:focus-within`, `Esc` collapses, arrow keys move between items.
- **Pin toggle** (Lucide `Pin`/`PinOff`) at the bottom keeps it expanded; when pinned, content shifts. Persist the pin only **after mount** (localStorage), hydration-safe.
- **Mobile (<768 px):** no hover. Replace with a bottom tab bar (Overview, Targets, Scans, Findings, More) where "More" opens a `vaul` drawer with the full grouped menu.
- Active item: ember left bar + `--ds-bg-subtle` background + `aria-current="page"`. Badges (count dots): open Critical/High on Findings, unread alerts, scans in progress on Scans. Badges come from real data; hide on error.
- `prefers-reduced-motion`: no width animation (instant switch).
- Wrap in `<nav aria-label="Dashboard">`. Contrast and focus ring rules from Part 1.

**Menu structure (all links must resolve to real routes; create the small aggregate pages marked NEW)**

| Group | Items (Lucide icon) |
|---|---|
| *Protect* | Overview (`LayoutDashboard`) · Targets (`Crosshair`) · Scans (`ScanSearch`) · Findings (`ShieldAlert`) |
| *Automate* | Automation (`CalendarClock`) **NEW**: tabs *Schedules* and *CI gates*, aggregated from `GET /api/schedules` and `GET /api/quality-gates`, each row linking to the per-target page |
| *Learn* | Academy (`GraduationCap`) → `/academy` |
| *Organization* | Team (`Users`) · Agency (`Building2`) · Audit Vault (`ScrollText`) · Billing (`CreditCard`) |
| *Developer* | API keys (`KeyRound`) · Webhooks (`Webhook`) |
| *Account* (bottom) | Profile & sessions (`UserRound`) · Help · Pin toggle |

- **Role- and plan-aware:** hide what the user's `ORG_*` role cannot use (e.g. Viewer: no launch buttons; Auditor: Audit Vault focus). For features the **plan** lacks, show the item with a `Lock` icon that opens a contextual `UpgradeNudge` (Part 1, Section 9), not a dead link. The server still enforces everything.
- In Phase B, persona may reorder and collapse groups (Section 5). Everything stays reachable via a **"All modules"** list.

**New slim top bar (inside the main content area):** breadcrumbs · `⌘K` command palette (`cmdk`: pages + registered targets + "Launch scan") · alerts bell (popover listing `GET /api/monitoring/alerts`, with "Mark as read") · **plan chip** (e.g. "Free · 1 scan left this week", read from `GET /api/billing` via `adaptPlans`) · avatar menu (profile, sessions, sign out). Remove the old top nav entirely.

**Workspace switcher** at the top of the sidebar (name of the current organization; dropdown only if the user belongs to several).

## A4. Page-by-page improvements (still frontend-only, using existing endpoints)

**Overview (restructure; replaces the current long page)**
1. **Next Best Action card** (one large card). Computed from real state in this order, first match wins (goal-based tweaks arrive in Phase B):
   no targets → *Add your first site* · targets but none verified → *Verify ownership of <host>* · verified but no completed scan → *Run your first scan* · open Critical/High → *Fix the top issue: <title>* (links to its remediation) · no CI gate → *Add a CI quality gate* · otherwise → *Schedule a weekly scan*.
   On data error: "Couldn't work out your next step. Retry." (never a guess).
2. **Score ring** (with "How is this calculated?"), grade, trend vs previous scan when available.
3. **Fix these first:** top 3 open findings by severity, deduped (see Findings), each with a "See the fix" button opening the remediation modal.
4. **Recent scans** (last 5) with status, score, link to the report.
5. **Engine health:** a single small status dot + label from `GET /api/health` (link to details). **Remove** the SSRF/Rate Limiter/Vault/Worker Pool strip and the "Platform Security Modules" grid from the customer dashboard.
6. Keep the Quick Scan launcher as a compact bar (single `brand` button "Scan"). The first-run checklist (existing) stays, restyled; it hides when all 5 steps are done.

**Targets**
- Columns: **Site** (hostname + URL, copy/open icons) · **Status** pill · **Score** (latest completed scan) · **Open issues** (mini severity counts) · **Last scan** (relative) · **Actions**.
- Score/issues/last-scan come from joining `GET /api/targets`, `GET /api/scans`, `GET /api/findings` in an adapter keyed by `targetId` (single fetch each, no per-row requests). Missing data → "n/a".
- Verification method/scope move into the details drawer/page (they are identical across rows today).
- Actions: primary **Run scan** (secondary button) + a `⋯` menu (Details, Attack surface, Monitoring & schedules, CI/CD gates, Verify ownership, **Delete**). **Delete** opens a **type-to-confirm dialog** (type the hostname). Remove the loose trash icon.
- Empty state for zero targets with a big "Register your first site" brand button.

**Scans**
- Fix D5 items. Add a compact trend sparkline per row only if score history exists in the response. Live polling (3 s) stays; the RUNNING row has a subtle pulse.
- Keep "Sync" as a ghost icon button.

**Findings**
- **Group duplicates** in the adapter: key = `target + rule_id + normalized endpoint path`. A group card shows: severity chip, title, "seen in N scans" (and first/last seen), one endpoint, rule ID chip, CWE chip, OWASP chip. Expanding reveals each occurrence. Actions on a group apply to the **latest occurrence by default**; add an optional "Apply to all N" action that calls the existing per-finding endpoints **sequentially with progress and partial-failure handling** (never claim success if any call failed).
- Label the second chip: **"Confidence: High"** (not a bare HIGH).
- Severity stats header: 4 light cards (Open critical/high · Needs triage · Accepted risk · Fixed & verified) from real data; zero-state copy is neutral, never celebratory unless data truly supports it.
- Filters: severity, status, target, search. Keep the Framework Remediation modal and "Verify Fix Now" (shows the real diagnostic result).

**Audit Vault / Team / Agency / Billing / Settings:** restyle with the shared rules; keep every feature from the spec. Add API keys and Webhooks to the sidebar. On Billing use *Usage and billing meters* from Part 1.

## A5. Plain-English copy pass (apply across the dashboard)

| Current | Replace with |
|---|---|
| Security Posture Command Center | Welcome back, `<name>` (H1), subtitle: "Here's where your sites stand." |
| Empirical posture / Zero active defects | Security score / No open issues (only when true, see A1) |
| Verified domains under perimeter watch | Sites you've verified |
| Deterministic AST & probe findings | Open issues by severity |
| Subsystems operational 10/10 | Scanner status (small dot, details on click) |
| Authorized Targets & Domains | Your sites |
| Register and cryptographically verify domain ownership… | Add your site, prove it's yours, then scan it. |
| Security Assessment Scans | Scans |
| Security Findings Inventory | Findings |
| Total scope endpoints | Sites added |

Keep technical IDs (rule IDs, CWE, OWASP) as small secondary chips. Every technical term gets a one-line human translation on first appearance (tooltip is fine).

**Phase A acceptance:** D1–D9 resolved or reported · no blue/gold/grey off-system buttons · sidebar works (mouse, keyboard, mobile) · Overview never shows green/zeros on error · tests green · screenshots at 1440 and 390 px for Overview, Targets, Scans, Findings.

---

# PHASE B: ONBOARDING & PROFILE  *(post a plan and wait for "go")*

## B1. Purpose
When a **new** customer signs up, ask a few questions so the product is configured for them. Persona changes **defaults only**; nothing is ever locked, and everything is editable later.

## B2. Backend (additive)
- Migration `0xx_user_profiles.sql`: table `user_profiles` (`user_id` PK/FK to `users`, `display_name`, `persona` enum-like text (`STUDENT`, `SOLO_BUILDER`, `FREELANCER_AGENCY`, `STARTUP_FOUNDER`, `COMPANY_TEAM`), `goals` text[], `built_with` text[], `stack` text[], `team_size` text nullable, `onboarding_completed_at`, `onboarding_skipped_at`, `created_at`, `updated_at`). Use the same conventions as existing migrations.
- Endpoints: `GET /api/me/profile`, `PUT /api/me/profile` (validate with the project's existing validation library; whitelist enum values; max lengths; reject unknown fields). Workspace rename: reuse an existing organization endpoint if there is one; otherwise add a minimal additive `PATCH` restricted to `ORG_OWNER`.
- Audit-log `PROFILE_UPDATED` (no answers in the log payload beyond field names).
- **Existing users:** do **not** force them through the wizard. If they have no profile, show a dismissible "Finish setting up your profile" card on Overview.
- Privacy (India DPDP Act context; this is engineering guidance, not legal advice): collect only what is below, say **why** each question is asked, make everything except the name skippable, allow editing/clearing in Settings → Profile, and never put free-text personal data in logs or analytics.

## B3. Flow (`/onboarding`, 4 short steps + a finish step; skippable; progress dots; Back/Next)
1. **"What should we call you?"**: name (prefilled from OAuth), optional workspace name.
2. **"What best describes you?"** (large selectable cards, Lucide icons): Student · Solo builder · Freelancer / agency · Startup founder · Company engineering or security team.
3. **"What do you want to do first?"** (multi-select chips): Check my app · Learn security · Protect client sites · Set up a CI gate · Show customers we're secure.
4. **"How did you build it?"**: tools (Cursor, Lovable, v0, Bolt, Claude Code, Hand-coded, Other: use text chips, not third-party logos) + stack (Next.js, Express, Nginx, Other).
5. **Finish: "Add your first site"**: reuse the Part 1 hero URL flow (`/dashboard/targets?new=<url>` opens the Register modal). Button "Skip for now" goes to Overview.

**Routing:** middleware/layout redirects authenticated users with **no profile and a recent account** to `/onboarding` **once**; `onboarding_skipped_at` or `completed_at` ends redirects permanently (no loops). Keep edge auth behavior unchanged.

## B4. What the answers change (defaults only)

| Persona | Sidebar emphasis | Next Best Action tone | Academy track surfaced first |
|---|---|---|---|
| Student | Protect + Learn expanded; Organization collapsed under "More" | encouraging, learning-first | `ai-code-smells` |
| Solo builder | Protect + Automate + Learn | action-first | `ai-code-smells` |
| Freelancer / agency | Agency promoted (locked with upgrade nudge if the plan lacks it) | client-focused | `api-modern-web` |
| Startup founder | Protect + Automate + Team + Billing | CI gate and team prompts | `api-modern-web` |
| Company team | Organization + Developer promoted (Audit Vault, Team, API keys, Webhooks) | compliance and CI prompts | `identity-rbac-tenancy` |

- **Goals** reorder the Next Best Action ties (e.g. "Set up a CI gate" moves *Add a CI gate* earlier once a site is verified; "Learn security" suggests an Academy guide).
- **Stack** sets the **default framework tab** (Next.js / Express / Nginx) in the remediation modal and Academy code blocks. "Other" keeps Next.js default.
- **Team size** only affects hints (e.g. "Invite a teammate"); entitlements are decided by the server's plan, never by this answer.
- Settings → **Profile** page lets users change every answer; the sidebar updates immediately.

**Phase B acceptance:** new account sees the wizard once; existing accounts see only the soft card; all answers persist across devices; persona visibly changes defaults but nothing is hidden permanently ("All modules" always available); tests for validation, redirect-once logic and adapters.

---

# PHASE C: STAFF PORTAL, STAFF CONSOLE, PORTALSWITCHER  *(post a plan and wait for "go")*

## C1. Concept
Two doors, two identities, one codebase:
- **Customers** → `/login` (GitHub/Google) → `/dashboard` (Ember & Paper).
- **Zerivex staff** → `/staff/login` (not linked anywhere public; `noindex`) → `/staff` console (dark operator look with a violet staff stripe).
- **PortalSwitcher** (staff only): switches a staff member between the **Staff Console** and the **Customer Portal**. In the Customer Portal they use the real product inside the **Zerivex Internal workspace** (never real customers' data).

## C2. Roles (3), enforced from one central permission table

| Permission | Owner | Admin | Support |
|---|---|---|---|
| Customer Portal tools | all **implemented** tools | all **implemented** tools | **Pro-plan** tools only (inherits Pro's entitlements by reference) |
| View customer orgs (plan, usage, status) | ✅ | ✅ | ✅ read-only |
| Suspend / unsuspend an org (reason required) | ✅ | ✅ | ❌ |
| View scan queue and failures | ✅ | ✅ | ✅ view |
| View security events (blocked SSRF, failed verifications, regression alerts) | ✅ | ✅ | ✅ view |
| Grant credits / plan overrides | ✅ | ✅ limited (capped amount, reason required) | ❌ |
| Manage staff and roles | ✅ | ❌ | ❌ |
| System settings, Stripe configuration | ✅ | ❌ | ❌ |
| Plan Preview (Phase D) | any plan | any plan | up to Pro |

- "All tools" means all **implemented** tools; anything "Coming soon" stays hidden or labelled Coming soon, even for Owner.
- Ownership verification, the SSRF egress firewall, rate limits and quotas **apply to staff exactly as to customers.** No role may scan a site it hasn't verified.
- Put the map in one file (e.g. `src/core/staff/staff-permissions.ts`): `STAFF_PERMISSIONS: Record<StaffRole, Permission[]>` and `entitlementsForStaff(role)`. Support's entitlements **reference** the `pro` plan config (so changes to Pro flow through). UI and API both ask `can(session, permission)`; **never** write `if (role === 'support')` in components or handlers.

## C3. Backend (additive; new migrations)
- `platform_roles`: `id`, `user_id` (unique, FK `users`), `role` (`STAFF_OWNER` | `STAFF_ADMIN` | `STAFF_SUPPORT`), `granted_by_user_id`, `created_at`, `revoked_at` nullable. One identity, one platform role (no separate staff user table).
- `staff_sessions`: `id`, `user_id`, `token_hash` (SHA-256, same pattern as customer sessions), `ip_address`, `user_agent`, `created_at`, `expires_at`, `last_seen_at`, `last_reauth_at`. Separate from `sessions`.
- `organizations.is_internal boolean NOT NULL DEFAULT false`, plus a seed/CLI script that creates the **"Zerivex Internal"** organization (`is_internal = true`).
- `audit_logs.actor_type` text NOT NULL DEFAULT `'USER'` (values `USER` | `STAFF` | `SYSTEM`). Existing rows stay `USER`.
- `sessions.via_staff_portal boolean NOT NULL DEFAULT false` (customer-session flag for staff using the Customer Portal) and `sessions.preview_plan_id` text nullable (Phase D).
- **Bootstrap:** a one-time CLI script (e.g. `scripts/seed-staff-owner.ts`) reading `STAFF_BOOTSTRAP_OWNER_EMAIL` creates the first `STAFF_OWNER`. **No HTTP endpoint may create the first owner.**
- New env vars (validated in `src/core/config`): `STAFF_ALLOWED_EMAIL_DOMAINS` and/or `STAFF_ALLOWED_EMAILS`, `STAFF_SESSION_TTL_MINUTES` (default 480 absolute), `STAFF_IDLE_TTL_MINUTES` (default 30), `STAFF_REAUTH_WINDOW_MINUTES` (default 10), `STAFF_PORTAL_ENABLED` (kill switch).

## C4. Staff authentication
- `/staff/login`: **Google only.** Accept a login only if **all** are true: ID token verified server-side · `email_verified` is true · the Workspace domain claim (`hd`) is in `STAFF_ALLOWED_EMAIL_DOMAINS` (or the email is in `STAFF_ALLOWED_EMAILS`) · an **active** `platform_roles` row exists. Enforce 2-Step Verification in the **Google Workspace admin console** (the app cannot enforce it; document this in the README).
- **No** GitHub login, **no** mock/dev login, **no** password on the staff path, in any environment (D9).
- Errors are generic ("You don't have access") and never reveal whether an email is on the allowlist. Rate-limit the endpoint with the existing limiter. Log failed attempts as `actor_type = SYSTEM` events.
- Cookie `zx_staff_session`: `HttpOnly`, `Secure`, `SameSite=Strict` (use `Lax` only if the OAuth return breaks, and say so), host-only, token stored hashed. Idle and absolute expiry from env. Sign-out revokes the row.
- **Re-authentication** for sensitive actions (role changes, credit grants, org suspension, system settings): require `last_reauth_at` within `STAFF_REAUTH_WINDOW_MINUTES`; otherwise start a fresh Google sign-in round trip that updates `last_reauth_at`. Check Google's docs for supported OAuth parameters before implementing.
- **CSRF:** every state-changing staff endpoint verifies the `Origin` header matches the app origin **and** requires a custom request header. Staff and customer cookies are validated independently (a customer cookie must never authenticate `/staff/*`, and vice versa).
- Staff routes: `src/app/(staff)/staff/*` and `src/app/api/staff/*`. Edge middleware requires a valid staff session for `/staff/*` (except `/staff/login` and its OAuth callback). Responses on `/staff/*` carry `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. Do **not** add `/staff` to `robots.txt` (that would advertise it). Do not link `/staff/login` from any public page or the sitemap.

## C5. Staff Console (`/staff`) — dark "operator" look + violet stripe
- **Theme:** dark surfaces (`#0E1015` canvas, `#151821` cards, `#262A36` borders, `#E9EAF0` text), accent **violet** (`--violet-400 #AB6CFE`), **not** ember, so no one confuses it with the customer UI. A permanent **violet "STAFF" stripe** across the very top (`--violet-600 #5925AB`, white text, 28 px) showing role and email. Same Lucide icons, same `ui/` kit (with a `data-surface="staff"` token override).
- **Left rail:** the same hover-expand sidebar component, staff items only. Top of rail: **PortalSwitcher**.
- **Pages (build only what real data supports; otherwise "Coming soon"):**
  1. **Overview:** counts of orgs, scans in the last 24 h, failed scans, queue depth (from existing tables). Internal org excluded from customer metrics.
  2. **Organizations:** table (name, plan, status, members, targets, scans this month, created). Org detail: plan, usage vs limits, targets (hostnames only), members (emails), recent audit events. **Support = read-only.** Admin/Owner can **Suspend/Unsuspend** (reason required, audited, re-auth required). A suspended org's customer users see a clear banner and cannot launch scans; their data is retained. *(Add an additive `organizations.suspended_at`/`suspended_reason` if none exists.)*
  3. **Scan queue & failures:** `QUEUED/RUNNING/FAILED` scan jobs with error summaries.
  4. **Security events:** blocked SSRF attempts, failed ownership verifications, regression alerts. Show only if the data is actually recorded; else "Coming soon".
  5. **Billing events:** Stripe webhook failures only if recorded; else "Coming soon".
  6. **Credits & grants** (Owner; Admin limited): grant credits/plan override with reason and cap; every grant is audited (`actor_type = STAFF`). Only if the credit/ledger system exists in the repo; else "Coming soon".
  7. **Staff** (Owner only): list staff, grant a role (existing user email must pass the allowlist), change role, revoke. **Rules:** at least one Owner must always exist (hard block), warn when only one Owner remains (recommend ≥ 2), cannot demote/revoke yourself if you are the last Owner, every change needs re-auth and is audited.
  8. **Audit:** staff-actor audit view (filter by actor, action, date). Uses the existing audit APIs with `actor_type` filtering.
- Every staff action writes an audit event with `actor_type = STAFF`, actor id/email, IP, user agent and reason.

## C6. Internal workspace & Customer Portal for staff
- "Zerivex Internal" is a normal organization with `is_internal = true`. On first switch, the server creates the staff user's membership there automatically: Owner/Admin → `ORG_OWNER`/`ORG_ADMIN` equivalents, Support → `ORG_MEMBER`.
- **Hard rule (server-side):** only users with an **active** `platform_roles` row can be members of an `is_internal` org. Enforce in the membership-creation/invitation code paths and add a test. Customers can never be invited into it.
- **One entitlement resolver** (`resolveEntitlements(org, session)`): normal orgs → plan entitlements from config (unchanged). `is_internal` org + valid staff session → `entitlementsForStaff(role)` (Owner/Admin: all implemented tools; Support: Pro's entitlements by reference). Quotas still count against the internal org's ledger with **generous but real** limits so staff see genuine limit behavior.
- **Billing disabled for internal orgs:** `POST /api/billing/checkout` and `/portal` return a clear 403 ("Internal workspace has no billing"); the Billing page shows an info card instead of plan-purchase buttons.
- **Metrics hygiene:** exclude `is_internal` orgs from any public or aggregate metric, pricing-conversion analytics and customer-facing numbers (or tag events `internal: true` and filter downstream).
- Switching to the Customer Portal issues a normal customer session (`zx_session`) for the same `user_id` with `via_staff_portal = true` and a **shorter TTL**, scoped to the internal org only: requests with `via_staff_portal = true` must be rejected if they reference any org other than the internal one. The staff session must also remain valid.

## C7. PortalSwitcher
- **Visibility:** rendered only when the **server** says the session has an active staff role (via `GET /api/staff/me` or equivalent). Never hide it with CSS only. Customers must get no trace of it in HTML, JS bundle logic that fetches staff data, or API responses.
- **Placement:** top of the sidebar as a two-state segmented control: `Staff Console` ⇄ `Customer Portal` (Lucide `ShieldCheck` / `UserRound`). Collapsed rail: single icon button + tooltip "Switch to Customer Portal" / "Switch to Staff Console".
- **Customer Portal staff bar:** a thin violet bar on top of every page: "STAFF MODE · Zerivex Internal · {Role}" + "Back to console" link (+ preview-plan indicator in Phase D).
- **Behavior:** one click, no re-login; it remembers the last portal; each switch is audited (`STAFF_PORTAL_SWITCHED`, with direction).
- If the staff role is revoked mid-session, the next request invalidates both the staff session and any `via_staff_portal` customer session.

**Phase C acceptance:** all items in Section 7 pass · staff and customer cookies cannot cross · a customer cannot reach `/staff/*` or `/api/staff/*` (401/403/redirect) · Support cannot call Admin/Owner endpoints (server-checked) · internal org cannot gain non-staff members · last-Owner protection works · permission-matrix tests pass · existing 269 tests green.

---

# PHASE D: STAFF PERKS

## D-1. Plan Preview (Owner/Admin: any plan; Support: up to Pro)
- A dropdown in the staff bar of the Customer Portal: *Free · Starter · Pro · Team* (from `adaptPlans`, never hardcoded).
- Stores `sessions.preview_plan_id`; the entitlement resolver uses that plan's entitlements **only** for `is_internal` orgs with a valid staff session. It can never affect a real customer org.
- Violet bar shows "Previewing: Starter". Lets staff test upgrade nudges, usage meters and locked items without touching billing.
- Audit `STAFF_PLAN_PREVIEW_CHANGED`.

## D-2. Internal preview-flag scaffold (no features yet)
- Add a typed `PREVIEW_FLAGS` config and a `previewFlagsFor(session)` helper that returns flags only for staff sessions on the internal org. Components can wrap not-yet-public features with `<PreviewOnly flag="…">` that renders a "Preview · not available to customers" badge. Ship with an **empty flag list**; build no fake features.

---

# PHASE E: "VIEW AS CUSTOMER" — PARKED (DO NOT BUILD NOW)

**My recommendation to the product owner:** worth building later, once there are real customers and support volume. It makes support faster, and, done with consent and customer-visible logs, it becomes a **trust feature**. Not now: it adds risk and is unnecessary while staff can reproduce issues in the internal workspace.

**Rules the future implementation must follow (design nothing in A–D that blocks this):**
- **Opt-in by the customer:** an org setting "Allow Zerivex support to view my workspace" (default **off**), changeable only by `ORG_OWNER`.
- **Staff must supply a reason and a ticket ID**; access is **read-only** and **time-boxed** (about 30 minutes, extendable only with a new reason).
- Allowed roles: Owner, Admin, Support (Support limited to read-only views).
- **Customer-visible audit:** every session appears in the customer's own audit vault ("Support viewed your workspace on …, reason …, by …").
- Sensitive data stays masked (secrets, evidence payloads, API keys never shown). No scanning, scan launching or setting changes while viewing.
- Kill switch via env flag; a persistent banner in the viewed session ("Support view · read-only").

**For now:** only make sure the audit log supports `actor_type = STAFF` and that guards are written as reusable `can(session, permission)` checks. **Do not add UI, endpoints or tables for this feature.**

---

# 7. SECURITY CHECKLIST (Phase C must satisfy every line; list pass/fail in your report)

- [ ] Staff login is Google-only, server-verified token, `email_verified`, allowed domain/email, **and** active `platform_roles` row
- [ ] No mock/dev/GitHub/password login on the staff path in any environment
- [ ] `zx_staff_session` is `HttpOnly`, `Secure`, `SameSite=Strict` (or documented `Lax`), hashed at rest, idle + absolute expiry, revocable
- [ ] Staff and customer sessions validated independently; neither authenticates the other's routes
- [ ] All `/staff/*` and `/api/staff/*` enforced **server-side** (middleware + handler-level `can()`), not by hiding UI
- [ ] CSRF defenses on every state-changing staff endpoint (Origin check + custom header)
- [ ] Re-authentication required for role changes, grants, suspension, system settings
- [ ] Generic login errors; rate limiting; failed attempts audited
- [ ] `is_internal` org membership restricted to active staff (tested)
- [ ] `via_staff_portal` customer sessions confined to the internal org (tested)
- [ ] Ownership verification, SSRF firewall, rate limits, quotas unchanged and applying to staff
- [ ] Billing endpoints blocked for internal org; Stripe secrets never reach the client
- [ ] Last-Owner protection (hard block) + audit of every role change
- [ ] Every staff action audited with `actor_type = STAFF`, IP, UA, reason
- [ ] `/staff` responses `noindex`, `no-store`; not in sitemap; not in `robots.txt`; not linked publicly
- [ ] `STAFF_PORTAL_ENABLED=false` makes `/staff/*` return 404 and removes the switcher
- [ ] No secrets, tokens or PII in logs
- [ ] README section documenting env vars, bootstrap script, Workspace 2-Step Verification requirement

---

# 8. CENTRAL DATA & ADAPTER RULES (all phases)

- Every number, plan name, limit, count, score and status comes from an API/config through a **typed adapter** in `src/adapters/`. Components never touch raw responses.
- Adapter outputs carry an explicit **state**: `{ status: 'loading' | 'error' | 'empty' | 'ready', data? }`. Components must render each state; **`error` is never presented as zero or success.**
- New adapters expected: `adaptOverview`, `adaptNextBestAction`, `adaptTargetsTable` (join), `adaptFindingGroups`, `adaptNavBadges`, `adaptProfile`, `adaptPersonaDefaults`, `adaptStaffOrgs`, `adaptStaffMe`.
- Display-name maps (role names, scan modes, statuses) live in one `labels.ts`.

---

# 9. TESTS & QA

**Keep green:** all existing tests, lint, typecheck, build.

**Add**
- *Phase A:* adapter state tests (loading/error/empty/ready), the D1 regression (score 100 + 6 open high must not render "Zero active defects"), findings grouping, targets join, next-best-action ordering, sidebar keyboard/hover-intent logic (unit-level), role-aware nav filtering.
- *Phase B:* profile validation (enum whitelist, max lengths, unknown fields), redirect-once logic (no loops), persona-defaults mapping, stack → default framework tab.
- *Phase C:* **permission-matrix test** (every role × every permission, allowed/denied), cookie isolation (customer cookie ≠ staff access and vice versa), internal-org membership guard, `via_staff_portal` confinement, last-Owner protection, bootstrap script idempotency, billing block for internal org, audit event written for each staff action, CSRF rejection without Origin/custom header, re-auth gating.
- *Phase D:* preview plan affects only internal org + staff sessions; Support cannot select above Pro.

**Manual QA:** screenshots at 1440 px and 390 px for every redesigned page; keyboard-only run through sidebar, command palette and onboarding; contrast check on subtitles, chips and staff stripe (staff stripe white on `#5925AB` is about 9:1); test with reduced motion on.

---

# 10. DEFINITION OF DONE

- [ ] D1–D9 each resolved (or reported with reason)
- [ ] Customer dashboard fully Ember & Paper; single button system; no off-system colors
- [ ] Hover-expand sidebar (overlay, hover intent, keyboard, pin, mobile tab bar) + slim top bar with ⌘K, alerts, plan chip
- [ ] Overview restructured; never shows green/zeros on error; Next Best Action from real state
- [ ] Findings grouped, Targets enriched, Scans fixed, plain-English copy applied
- [ ] Onboarding wizard + Settings → Profile; existing users only see a soft card
- [ ] Staff door, console, three roles from one permission table, internal workspace, PortalSwitcher, staff stripe
- [ ] Plan Preview works for the internal org only; preview-flag scaffold shipped empty
- [ ] Security checklist (Section 7) fully passed and reported
- [ ] "View as customer" **not** built; nothing in A–D blocks it
- [ ] No Tailwind, no emoji icons, no theme toggle, Lenis not in dashboard/staff
- [ ] Final report lists deviations, assumptions, and anything left as "Coming soon"

---

# APPENDIX: ROUTE & ENDPOINT MAP (verify against the repo before building)

**Existing (do not change):** everything in spec §4 (`/api/auth/*`, `/api/targets/*`, `/api/scans/*`, `/api/findings/*`, `/api/billing/*`, `/api/audit-vault/*`, `/api/teams/*`, `/api/agency/*`, `/api/api-keys/*`, `/api/webhooks/*`, `/api/monitoring/*`, `/api/schedules/*`, `/api/quality-gates/*`, `/api/health/*`).

**New pages (frontend):** `/dashboard/automation` (Phase A), `/dashboard/settings/profile` and `/onboarding` (Phase B), `/staff/login`, `/staff`, `/staff/orgs`, `/staff/orgs/[id]`, `/staff/queue`, `/staff/security-events`, `/staff/billing-events`, `/staff/credits`, `/staff/staff`, `/staff/audit` (Phase C).

**New endpoints (additive):**
- Phase B: `GET/PUT /api/me/profile` (+ optional minimal org-rename `PATCH` if none exists)
- Phase C: `GET /api/staff/me` · `POST /api/staff/auth/callback` (Google) · `POST /api/staff/auth/logout` · `POST /api/staff/auth/reauth` · `POST /api/staff/portal/switch` · `GET /api/staff/orgs`, `GET /api/staff/orgs/[id]`, `POST /api/staff/orgs/[id]/suspend|unsuspend` · `GET /api/staff/queue` · `GET /api/staff/security-events` · `POST /api/staff/credits/grant` · `GET/POST/PATCH/DELETE /api/staff/members`
- Phase D: `POST /api/staff/portal/preview-plan`

Every new endpoint: authenticate → authorize via `can(session, permission)` → validate input → perform → audit → respond. Never trust client-supplied roles, plans or org ids.
