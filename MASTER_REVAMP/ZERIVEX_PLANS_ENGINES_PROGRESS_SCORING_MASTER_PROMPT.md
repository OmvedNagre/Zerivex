# ZERIVEX — Plans, Engines, Live Scan Progress & Scoring (Part 3)

> **Attach with:** Part 1 (`ZERIVEX_UI_MASTER_PROMPT.md`), Part 2 (`ZERIVEX_DASHBOARD_ONBOARDING_STAFF_MASTER_PROMPT.md`), the architecture spec, the pricing prompt, `ZERIVEX_SCANNER_ENGINES_AND_CAPABILITIES_AUDIT.md` and `ZERIVEX_MODEL_TIERING_AND_MONETIZATION_RECOMMENDATIONS.md`.
> **Agent:** Antigravity (Gemini flash, high) with *impeccable* and *GSAP* skills.
> **Reuse everything from Parts 1–2** (tokens, `ui/` kit, Lucide, adapters, sidebar, Ember & Paper). Do not rebuild it.
> **Goal:** (1) merge Free + Starter into one **Starter (₹0)** plan and make plans genuinely differ, (2) tier the scanner engines by plan on the **server**, (3) show a **real-time Analysis Progress screen** and a persisted **Engine Receipt**, (4) make the **score accurate**, (5) fix the sidebar lock/plan-chip details, (6) keep marketing, pricing and dashboard perfectly in sync with what the code really does.

---

## 0. HOW YOU MUST WORK

1. **Phase 0 → F → G → H → I → J, in order.** Part 2's Phases B, C and D are **already built** (see the Phase B–D report). Phase 0 verifies and hardens that work before anything is built on top of it. Phase J applies the staff-portal changes in Section 7.
2. **Stop gates:** you must post a plan and **wait for my "go"** before (a) starting Phase G, (b) writing any scoring code in Phase H (see H1), and (c) running any data migration that changes existing rows.
3. **Never guess** file names, enums, routes or API shapes. Run `ls`, `rg`, open the real files. If the repo contradicts the documents (it already does in places, see Section 2), trust the **code** and report the difference.
4. **Backend:** additive only. New migrations after the latest number (verify; likely `008+`; if Part 2 migrations were added, continue after them). Never drop or loosen existing guards (ownership verification, SSRF firewall, rate limits, RBAC, audit, edge auth).
5. **All existing tests must stay green** (currently **407** per the Phase B–D report). Every new behavior gets tests.
6. **Server enforces; UI explains.** Engine gating, quotas and plan checks happen in the scan runner and API handlers, never only in the UI.
7. Rules carried over: no Tailwind · Lucide icons only · no emoji/glyph icons · hydration-safe (no `window`/`localStorage`/`Date.now()` in render) · no fake or simulated results · "Coming soon" for anything unimplemented · one `brand` button per viewport · contrast at least 4.5:1 · reduced-motion respected.
8. **UI vocabulary:** say **"engines"** or **"checks"**. **Never say "models"** (it implies AI; ZERIVEX's scanner is deterministic and AI analysis is Coming soon). **Never show "V1–V4"** to customers.
9. **Report format after each phase** (max 15 lines): files changed · migrations · what works · tests run + results · open questions.
10. Run an *impeccable* critique/polish pass on every screen you touch. Where its defaults conflict with this document, this document wins.

---

## 1. DECISIONS

| # | Topic | Status | Decision |
|---|---|---|---|
| 1 | Entry plan | **Locked** | Free and Starter merge into **Starter, ₹0**. Plans become **Starter · Pro · Team · Enterprise**. Show "₹0" with microcopy "free, no card needed" (keep the word *free* in microcopy and CTAs; the plan name is Starter). |
| 2 | AI Smells | **Locked** | `check-ai-code-smells` is included in Starter. Starter = **7 engines**. |
| 3 | Starter limits | **Locked** | Starter has a modest monthly scan limit (**start with 8/month, configurable**). **"Verify Fix Now" re-tests are NOT counted** against the scan limit (protected by a per-finding daily cap + the existing rate limiter). |
| 4 | Score model | **PENDING owner approval** | Implement only after H1's evidence review and my "go". |
| 5 | Naming | **Locked** | "Engines"; no V1–V4 in customer UI. |
| 6 | Sidebar lock | **Locked** | `Lock`/`LockOpen` toggle at the **top** of the sidebar replaces the bottom "pin". Plan gating uses **plan pills** ("Pro", "Team"), not a lock icon. |
| 7 | Hosting / live transport | **PENDING** | Use **database-backed progress + polling** now (works on serverless and long-running servers). Keep the transport behind one hook so streaming can be added later. |
| 8 | Existing accounts | **Interpreted default** | Existing **data and history are always preserved**. Existing accounts are **mapped to the new plans** and new rules apply to **new** scans. Exceptions can be granted later through staff plan overrides (Part 2, Phase C). If this default is wrong I will tell you. |

**Open product questions (report, do not decide):** Should solo developers get a CI gate on Pro (docs currently place CI gates, webhooks and API keys on Team)? Is a one-time "deep scan pack" wanted later?

---

## 2. TRUTHFULNESS RECONCILIATION (do first, in Phase F0)

The audit and the marketing copy **disagree with each other**. Fix the copy to match the code.

1. **Open `check-exposed-secrets` and report what it really does.** The audit says it probes `/.env`, `/.git/HEAD`, `/.git/config` with content-signature checks. The architecture spec, the landing hero terminal ("Client bundle AST scan flagged…") and the "Secrets & Tokens" bento card ("AST parser inspects bundled chunks for high-entropy tokens") describe **bundle/AST scanning**. Unless the code actually does that, **remove those claims**.
2. **`check-ai-code-smells` is HTTP probing** of debug/seed routes and GraphQL introspection, not repo analysis and not hardcoded-salt detection. Rewrite the "AI Code Smells" bento card to: *"Leftover debug routes, seed endpoints and open GraphQL introspection."*
3. Audit **every** marketing and dashboard string against the code: hero terminal sample lines, bento cards, "Verify, Detect, Defend" bullets, pricing rows, engine descriptions, Academy-to-rule mappings, FAQ answers. Produce a table (claim → file → real behavior → action) in your Phase F report.
4. Any sample output stays labeled **"Sample output"** and may only describe engines that exist.
5. Hosting recon (report only): how scans are executed (in-process worker pool after the response? separate worker?), whether a scan can be killed by a serverless timeout, and where the watchdog lives. Do not redesign; just report so the progress design is safe.

---

# PHASE 0: VERIFY & HARDEN PHASES B–D  *(do this before Phase F)*

The Phase B–D report claims "100% pass" on the security checklist. That is a **self-report**. A reviewer read it and flagged the points below. For each item: **read the code, state in your report whether the concern is confirmed or not, fix it if confirmed, and add a test.** Do not fix by guessing; do not weaken any existing guard.

**0.1 Re-authentication must be real (highest priority).** The report says `POST /api/staff/auth/reauth` "updates the `last_reauth_at` timestamp". If it only bumps the timestamp when called with the staff cookie, then re-auth protects nothing (a stolen session could re-authorize itself). Required behavior: re-auth is a **fresh Google sign-in round trip** (start endpoint → Google → callback), and the callback must verify it is the **same Google account** as the session's user and that the sign-in is fresh, before updating `last_reauth_at`. Check Google's docs for the supported OAuth parameters. **Test:** calling the re-auth endpoint with only the cookie, Origin and custom header must NOT extend the window; sensitive actions still return `reauthRequired`.

**0.2 No fake credit grants.** `POST /api/staff/credits/grant` ("Admin capped at 1,000") exists, but no credit ledger table was added and the audit says none exists. Find out what this endpoint actually changes. If it only writes an audit row, it is a **fake feature**: make it return `501 Coming soon`, hide any UI for it, keep the cap logic behind a feature flag, and update its tests. Re-enable only when a real ledger exists.

**0.3 Plan caps are tied to legacy IDs.** Support's "Pro inheritance" and the Plan Preview cap currently point at `TEAM_PRO` (₹3,999), which after the plan merge becomes **TEAM**. The spec says Support is **Pro-level only** and may preview **up to Pro**. Re-point both to `PRO` using `PLAN_RANK` (done as part of Phase F). **Tests:** Support cannot preview Team or above; Support's entitlements equal Pro's, not Team's. Also make sure stored `sessions.preview_plan_id` values and the seeded "Zerivex Internal" org plan resolve through `LEGACY_PLAN_ALIASES`.

**0.4 Is Plan Preview actually enforced?** Verify where `sessions.preview_plan_id` is **read**. If nothing consumes it, the preview is cosmetic. Also verify the Customer Portal really enforces role-based entitlements (Owner/Admin: all implemented tools; Support: Pro tools), not just labels. **Tests:** preview Starter → a server request for an active scan is denied; preview Pro → allowed; Support session cannot use a Team-only feature.

**0.5 `via_staff_portal` confinement per request.** The report says these sessions are "scoped" when issued. Verify that **every** customer API handler rejects a `via_staff_portal` session that references any organization other than the internal one (IDOR-style test with a real second org), and that revoking or demoting a platform role invalidates **both** the staff session and any `via_staff_portal` customer session on the next request.

**0.6 Owner login with a personal Gmail.** Verify `isEmailAllowedForStaff` supports **exact emails** (`STAFF_ALLOWED_EMAILS`, lowercase, `email_verified` true) and does **not** require a Workspace `hd` claim. Add startup config validation that **refuses** public mail domains in `STAFF_ALLOWED_EMAIL_DOMAINS` (`gmail.com`, `googlemail.com`, `outlook.com`, `hotmail.com`, `yahoo.com`, `icloud.com`, `proton.me`, etc.). Never hardcode the owner email anywhere (tests use `owner@example.test`).

**0.7 Cookie flags.** The report says "SameSite=Strict/Lax". State exactly which is set. Use `Strict` unless the OAuth return breaks, and document why if `Lax`.

**0.8 Last-Owner protection race.** The report says it counts active owners and rejects if ≤ 1. Two simultaneous demotions can both pass that check. Do the count and update inside **one transaction with a row lock** (or equivalent) so the system can never reach zero owners. **Test** with concurrent requests.

**0.9 Test coverage map.** The staff suite has 9 tests for a large surface. Produce a table: *spec test → test file/name* for each of: full permission matrix (every role × every permission), cookie isolation (both directions), internal-org membership guard, `via_staff_portal` confinement, last-owner protection (incl. race), bootstrap idempotency, billing block for the internal org, CSRF rejection (missing Origin and missing custom header), audit event written for each staff action, re-auth gating, failed-login audit + generic error. **Add every missing test.**

**0.10 Edge guard actually runs.** The guard lives in `src/middleware.ts` and the project is on **Next.js 16**. I believe Next 16 renamed `middleware` to `proxy` (the old name is deprecated). Verify which file name your installed version actually executes, and add an integration test: unauthenticated `GET /staff` and `GET /api/staff/me` are rejected/redirected; with `STAFF_PORTAL_ENABLED=false` both return 404; `/staff/*` responses carry `noindex` and `no-store`.

**0.11 Missing pages and wording.** The spec lists an org-detail page (the API exists, the page does not), plus Credits and Billing-events pages. Add minimal pages or remove their nav links so nothing links to a missing page; Credits and Billing events show "Coming soon". Rename "Cryptographic staff operation audit trail" to **"Staff activity log"** (the audit log is tamper-evident at most; do not claim cryptographic guarantees). Do not describe the profile feature as "DPDP-compliant" anywhere in UI or docs; say it collects minimal data and explains why.

**Phase 0 acceptance:** each item reported as confirmed or not confirmed · confirmed items fixed with tests · the test-coverage map delivered · all tests green (407 plus new ones).

---

# PHASE F: PLANS, ENGINE REGISTRY, ENTITLEMENTS

## F1. Single plan config (extend, don't replace)
Extend the existing billing types/config (`src/core/billing/types.ts` and the pricing config from the pricing prompt) to this shape. **Keep existing field names where they exist**, add new ones.

```ts
type PlanId = 'STARTER' | 'PRO' | 'TEAM' | 'ENTERPRISE';
const PLAN_RANK: Record<PlanId, number> = { STARTER: 1, PRO: 2, TEAM: 3, ENTERPRISE: 4 };

interface PlanDefinition {
  id: PlanId; name: string; tagline: string; badge?: string;
  pricing: { monthlyInr: number; yearlyInr: number; currency: 'INR' };   // ENTERPRISE: custom
  limits: {
    maxSites: number; maxMonthlyScans: number; maxTeamMembers: number;
    historyDays: number;
    crawl: { enabled: boolean; maxDepth: number; maxPages: number };    // read current crawler limits from code
    fixRetestDailyCapPerFinding: number;                                 // start at 10
  };
  features: {                                                            // only implemented ones can be true
    fixDiffs: boolean; fixRetests: boolean;                              // retests never count toward scan quota
    activeVerifiedTests: boolean; scheduledScans: boolean; alerts: boolean;
    findingCollaboration: boolean; ciGates: boolean; sarif: boolean;
    webhooks: boolean; apiKeys: boolean; auditVault: boolean; agencyHub: boolean;
  };
  display: { highlighted?: boolean };
}
```

**Starting values (all configurable, nothing hardcoded in code or JSX):**

| | Starter | Pro | Team | Enterprise |
|---|---|---|---|---|
| Price (₹/month) | **0** | 1,499 | 4,999 | custom |
| Engines | **7 of 14** (passive) | **14 of 14** (incl. 4 active, need verified ownership) | 14 of 14 | 14 of 14 |
| Sites | 1 | 3 | 15 | custom |
| Scans / month | 8 | 50 | 250 | custom |
| Team members | 1 | 3 | 10 | custom |
| History | 30 days | 90 days | 365 days | 730 days |
| Crawler | off | on (current code defaults) | deeper | deeper |
| Fix diffs + free fix re-tests | yes | yes | yes | yes |
| Active verified tests | no | **yes** | yes | yes |
| Scheduled scans + alerts | no | yes | yes | yes |
| Collaboration | no | yes | yes | yes |
| CI gates, SARIF, webhooks, API keys, audit vault, agency hub | no | no | **yes** | yes |

If a row's capability is not implemented in the code (e.g. **email** alerts, SSO), it must read **Coming soon**, not a checkmark. In-app alerts (bell) exist; email alerts only if the code sends email.

## F2. Engine registry: the single source of truth
Create `src/core/scanner/engine-registry.ts` (**pure module, no server-only imports**, so server components and the pricing page can import it). Every engine has:

```ts
interface EngineDefinition {
  id: string;                    // existing check id, e.g. 'check-tls'
  displayName: string;           // plain English
  doingLine: string;             // shown while running: "Checking …"
  doneLine?: (n: number) => string;
  class: 'PASSIVE' | 'ACTIVE';
  minPlan: PlanId;               // 'STARTER' | 'PRO' (Team and Enterprise inherit Pro)
  needsVerifiedOwnership: boolean;
  needsDiscoveredInputs: boolean;  // active engines need crawler-found parameters
  category: 'TRANSPORT' | 'HEADERS' | 'COOKIES' | 'CORS' | 'FILES' | 'DISCLOSURE' | 'API' | 'AI_SMELLS' | 'INJECTION' | 'REDIRECT' | 'TRAVERSAL';
  ruleIdPrefix: string;          // verify against the code (docs differ: ZX-CK vs ZX-CKI)
  weight: number;                // used by scoring coverage (Phase H)
  version: string;               // engine version recorded in every receipt
}
const ROADMAP_ENGINES = [ /* API schema fuzzing, authenticated session scan, AI repo analysis: status 'COMING_SOON' */ ];
```

- The 14 engines and their plan assignment are in **Appendix A**.
- `ROADMAP_ENGINES` hold the three future capabilities. They are **never counted** in "N of 14" and render only as "Coming soon" pills in the pricing matrix and receipt footer.
- **Everything reads the registry:** scan runner gating, progress screen, receipt, pricing comparison matrix, marketing counters ("14 engines", "7 on Starter"), Academy links, nav badges. Delete any other hardcoded engine list or count.
- Pure helper functions (unit-tested): `enginesForPlan(planId)`, `planFor Engine`, `planEnginePreview(planId, { targetVerified })` returning, per engine, `AVAILABLE | LOCKED_BY_PLAN | LOCKED_UNVERIFIED` with precedence **plan first** (if both apply: `lockedBy: 'PLAN'`, `requiredPlan`, `alsoRequiresVerification: true`).

## F3. Entitlement resolver
One function `resolveEntitlements(org, session)` (Part 2's staff overrides plug in here later). Returns plan limits, features and `engineIds`. Every quota check, engine decision, UI lock and pricing row derives from it. **No `if (plan === 'pro')` anywhere.**

## F4. Legacy plan migration (gate: ask before running the data migration)
- Legacy IDs: `FREE_DEVELOPER`, `TEAM_PRO` (₹3,999), `ENTERPRISE`. Add `LEGACY_PLAN_ALIASES` so old values still resolve: `FREE_DEVELOPER → STARTER`, `ENTERPRISE → ENTERPRISE`, `TEAM_PRO → TEAM`.
- **Before migrating, query for paying subscribers** (`subscriptions` with a Stripe customer/active status on `TEAM_PRO`). If any exist, **stop and ask me**: they pay ₹3,999 today and must never be silently re-priced. Existing Stripe subscriptions keep their current Stripe price until the customer changes plan.
- Migration is a reversible data script (store the old value in a `legacy_plan_id` column). History, findings, scans, targets are untouched. Existing targets above a new site limit stay available but no new ones can be added (pricing prompt §19 wording).
- Search and replace all customer-facing strings: `Free Developer`, `FREE_DEVELOPER`, `Team Pro`, `TEAM_PRO` → plan names from config.
- Stripe: do **not** create Stripe objects. Read price IDs from env. If a paid plan's price ID is missing, its CTA shows a safe "Contact us" state instead of failing at checkout.

## F5. Quotas
- Scan quota counts only **new full scans**. **Fix re-tests do not count**, but are limited by `fixRetestDailyCapPerFinding` plus the existing rate limiter.
- Enforce in the API handler before a scan job is created (atomic, race-safe, as the pricing prompt §20 requires). On denial return a structured error the UI converts into a contextual `UpgradeNudge` (Part 1 §9).
- Credits/operation weights (pricing prompt §9–11) are **out of scope here**. Leave a typed slot for "cost preview" and show nothing if the credit system does not exist.

**Phase F acceptance:** one plan config, one engine registry, resolver used everywhere · legacy strings gone · copy-vs-code table delivered and marketing fixed · tests: registry helpers, resolver per plan, quota enforcement (including race), re-test exemption and daily cap, legacy alias mapping · all existing tests green.

---

# PHASE G: LIVE SCAN PROGRESS, EXECUTION TELEMETRY, ENGINE RECEIPT  *(post a plan, wait for "go")*

## G1. Data model (additive)
Use a **normalized table** (engines finish in parallel and update independently; a single JSON column would race):

- `scan_engine_runs`: `id`, `scan_id` (FK), `engine_id`, `engine_version`, `status`, `findings_count` default 0, `inputs_tested` nullable int, `started_at`, `finished_at`, `duration_ms`, `lock_reason` nullable, `locked_by` nullable (`PLAN` | `VERIFICATION`), `required_plan` nullable, `error_code` nullable. Unique `(scan_id, engine_id)`.
- On `scan_jobs`: `stage` (`PREPARING` | `DISCOVERING` | `RUNNING_ENGINES` | `SCORING` | `DONE`), `stage_updated_at`, `plan_snapshot` JSONB (plan id, name, engine ids at scan start), `last_heartbeat_at`, `manifest_summary` JSONB (counts for list views).
- Status enum: `QUEUED | RUNNING | PASSED | FINDINGS_DETECTED | NO_INPUTS | LOCKED_BY_PLAN | LOCKED_UNVERIFIED | ERROR | TIMED_OUT`.
- **Existing scans have no rows.** The UI must render them with "Engine details not recorded for this older scan" (never invent a receipt).

## G2. Scan runner changes (`scan-runner.ts`, keep the existing worker pool and rate limiter)
1. **Plan first:** resolve entitlements and build the planned list from the registry (`planEnginePreview`). Insert all 14 rows **at job start**: allowed engines `QUEUED`, others `LOCKED_BY_PLAN` / `LOCKED_UNVERIFIED` with `lock_reason`, `required_plan`. Save `plan_snapshot`. A mid-scan upgrade never changes a running scan.
2. **Stages:** update `stage` as it moves: `PREPARING` (ownership + SSRF validation) → `DISCOVERING` (only if the plan allows the crawler and an allowed active engine needs inputs) → `RUNNING_ENGINES` → `SCORING` → `DONE`. Persist `stage_updated_at`.
3. **Per engine:** set `RUNNING` + `started_at` just before running; on completion set the final status, `finished_at`, `duration_ms`, `findings_count`. Wrap with a per-engine timeout (config, default 20 s; `TIMED_OUT`) and catch errors (`ERROR`, never silently pass). Keep `Promise.allSettled`-style parallelism.
4. **`NO_INPUTS`:** active engines that find nothing to test (no discovered parameters) must report it. Add a backward-compatible way for engines to report it (e.g. an optional `context.reportInputs(n)` callback) so you do **not** have to rewrite all 14 engines or break tests. `NO_INPUTS` is **not** a pass.
5. **Heartbeat:** update `last_heartbeat_at` on every engine start/finish and about every 5 s while running (clear the timer in `finally`). Integrate with the existing watchdog; do not duplicate it.
6. **Gating happens only here** (server). Never trust the client.
7. A scan with any `ERROR`/`TIMED_OUT` engine completes as **incomplete** (flag on the job); it must not look like a clean pass.
8. Audit event `SCAN_COMPLETED` includes manifest **counts** and engine versions (no evidence payloads).

## G3. API (additive; all org-scoped; no evidence payloads)
- `POST /api/scans` (existing) additionally returns `plannedManifest` immediately.
- `GET /api/scans/[id]/progress` → `Cache-Control: no-store`:
```ts
interface ScanProgress {
  scanId: string; status: 'QUEUED'|'RUNNING'|'COMPLETED'|'FAILED';
  stage: 'PREPARING'|'DISCOVERING'|'RUNNING_ENGINES'|'SCORING'|'DONE';
  startedAt: string; heartbeatAt: string | null; stale: boolean;      // stale computed server-side (default 30 s)
  plan: { id: PlanId; name: string }; targetVerified: boolean;
  summary: { planned: number; assessed: number; passed: number; withFindings: number;
             noInputs: number; locked: number; errored: number; coveragePct: number };
  issuesSoFar: { critical: number; high: number; medium: number; low: number };   // counts only
  engines: Array<{ id: string; name: string; doingLine: string; class: 'PASSIVE'|'ACTIVE';
                   status: string; findingsCount: number; durationMs: number | null;
                   lockedBy: 'PLAN'|'VERIFICATION'|null; requiredPlan?: PlanId; alsoRequiresVerification?: boolean }>;
  score?: { value: number; version: number };                          // present only when DONE
}
```
- `GET /api/engines` → registry + per-plan availability for the current org (and optional `targetId`), used by the pre-scan preview and the pricing/billing pages.
- **Security:** a user can only read progress for scans in their own org (IDOR test). Rate-limit with the existing limiter. Staff access (Part 2) goes through `can()`.

## G4. Analysis Progress screen (same URL as the report: `/dashboard/scans/[id]`)
After **Register & Scan Target**, **Run Scan** (Targets table), **Launch New Scan** and the Quick Scan bar, navigate straight to this page. State machine: `QUEUED/RUNNING` → **ProgressView**; `COMPLETED` → completion summary + report + receipt on the same page (no hard redirect); `FAILED` → failure view with reason and "Retry".

**ProgressView (Ember & Paper; a dark terminal-style island is allowed for the engine log only):**
- **Header:** hostname · chip "Scanning with **Starter** · 7 engines" (from `plan_snapshot`) · real elapsed time (now − `startedAt`).
- **Stage stepper:** Preparing → Discovering → Engines → Scoring → Done, from `stage` (skip "Discovering" visually if not applicable).
- **Progress bar = assessed engines ÷ planned engines.** "4 of 7 engines complete." **No time-based or padded progress. Never add artificial delays.** A 3-second scan shows 3 seconds.
- **Engine list (always all 14, in two groups):** "Running on your plan" and "Not assessed on this scan". Row = Lucide category icon · name · line (`doingLine` while running, result text when done) · status chip (icon + text) · duration · findings count. Animate state changes subtly with GSAP (reduced-motion: instant).
- **Issues found so far:** four severity counters from `issuesSoFar`. **Do not show a provisional score** (a "100" before engines finish would be misleading). The score appears only when `DONE`.
- **Not-assessed rows:** `Not assessed` + a pill: **"Pro"** (plan) or **"Verify ownership"** (verification). Icon `CircleMinus` (fallback `MinusCircle`; check the installed Lucide version). **No Lock icon here** (Lock now means the sidebar toggle).
- **One contextual nudge card per screen**, chosen by precedence: plan lock → "N checks didn't run on this scan. Pro adds active tests for injection, XSS, redirects and traversal." [Upgrade to Pro]; unverified target on a plan that allows active → "Verify ownership (free, about 2 minutes) to unlock 4 active engines." [Verify ownership].
- **Pre-scan preview** in Launch Scan modal and Quick Scan: "This scan runs 7 engines. 7 aren't included on Starter." from `GET /api/engines`.
- **Failure/edge states:** polling error → inline banner "Connection lost, retrying…" with last known state (never fake progress; manual Retry after repeated failures); `stale` → "Taking longer than usual…"; `ERROR`/`TIMED_OUT` engines show "Re-run this engine" (reuse the targeted re-test path; not counted against quota).
- **Leaving the page is safe:** scans continue server-side. The nav badge and bell reflect scans in progress; a toast fires when a scan completes while the user is elsewhere.
- **Accessibility:** one `aria-live="polite"` region that announces **stage changes and completion only** (not every update). Text status for every state (never color only). Reduced-motion: no animated radar or shimmer.
- **Transport:** hook `useScanProgress(scanId)` polls `GET /api/scans/[id]/progress` every **1 s** while RUNNING/QUEUED, backs off to 3 s after 60 s, stops on terminal states, pauses when the tab is hidden, resumes on focus. Keep transport inside the hook so streaming can replace it later without touching components.

## G5. Engine Receipt (post-scan, persisted)
On the completed scan page: "**Engine Receipt**": summary line (e.g. "7 of 14 engines assessed · Starter · Target: verified/unverified"), a **coverage meter**, and the 14-row table (status, findings, duration, engine version). Footer: "Coming soon" pills for the three roadmap engines. It reads `scan_engine_runs`, so it is identical to what the progress screen showed. Older scans without rows show the "not recorded" note.

**Phase G acceptance:** engines gated server-side by plan and verification · all 14 rows persisted per scan · progress API org-isolated · progress screen driven only by persisted state (kill the tab and reopen: same state) · no fake delays · receipt appears on completed scans · tests (Section 8) · all existing tests green.

---

# PHASE H: ACCURATE SCORING  *(gated: owner is still deciding)*

## H1. Evidence review (NO scoring code changes yet)
1. **Document the current algorithm exactly** from the code: inputs, severity weights, caps, floors, how repeats are handled, how skipped engines are treated, where the score is stored and displayed (Overview, Targets, Scans, report). Explain how it produced *100/A+* for an account with open Critical/High findings (Part 2, D1).
2. **Re-score the real stored scans offline** with the proposed v2 model (Appendix B), **without modifying data**, and give me a table: scan, old score, v2 score, open findings by severity, coverage. Highlight any surprising results.
3. Give me 5–8 worked examples (a clean Starter scan, a Starter scan with 1 High, a scan with 1 Critical, a scan with 50 duplicate Lows, a scan with an engine error, a Pro scan with active engines locked by verification).
4. List the parameters I can change (Appendix B) and the options for: grade ceiling by coverage (on/off), accepted-risk weight, cap thresholds.
5. **Stop and wait for my "go" and parameter choices.**

## H2. Implementation (only after "go")
- **Two numbers, clearly different:**
  - **Scan score:** a fixed record of one scan, stored with the scan. Shown on Scans and the report.
  - **Current posture:** recomputed **on read** from currently open findings of each target's latest completed scan (server endpoint, e.g. `GET /api/posture`), so verified fixes, false positives and accepted risk move it immediately. Shown on Overview and the Targets table. Fleet posture = the backend-defined aggregation over scanned targets; unscanned targets are listed as "not scanned", never counted as 100.
- **Real time:** posture refetches on window focus, after any finding/scan mutation, and every 30 s on Overview. Never computed in the browser.
- **Rules (defaults in Appendix B):** severity base penalties · confidence multipliers · **dedupe** per `(rule_id, normalized endpoint)` · per-engine penalty cap · **severity caps** (open Critical ⇒ cannot exceed the Critical cap, open High ⇒ High cap) · **only verified `FIXED` clears a finding**; manual status changes cannot raise the score by themselves · `FALSE_POSITIVE` counts 0 · `ACCEPTED_RISK` at a reduced weight and flagged · **unassessed engines are never counted as passed**.
- **Coverage is always displayed next to the score:** "91 · 7 of 14 engines". Coverage = assessed engine weight ÷ total weight. `NO_INPUTS`, locked, `ERROR`, `TIMED_OUT` are not assessed. An incomplete scan shows an "Incomplete" chip.
- **Explainable and reproducible:** store `score_version` and `score_breakdown` JSONB on every scan (`base`, `penalties[]`, `caps[]`, `coverage`, `final`). The "How is this calculated?" popover renders **this stored breakdown** (never a hand-written formula).
- **Legacy:** existing scores are marked `score_version = 1 (legacy)` and **not recomputed**. Trend charts show a marker "Scoring updated" at the version change.
- **Adapters:** loading/error never render as 100 or green (Part 2, A1 stays in force). Scans table column header becomes "Scan score"; Overview/Targets say "Current posture".
- **Tests:** golden fixtures with exact expected scores · monotonic property tests (adding a finding never raises the score; a verified fix never lowers it) · cap tests · dedupe tests · coverage tests · determinism (same input, same output) · legacy rows untouched.

**Phase H acceptance:** H1 report approved · scoring pure, versioned, tested · Overview contradiction impossible (a test reproduces "6 open High, expects no A+/'Zero active defects'") · breakdown popover reads stored data.

---

# PHASE I: PRICING, MARKETING, DASHBOARD SYNC & SIDEBAR

## I1. Pricing page and billing page (config-driven, no retyped numbers)
- `/pricing` (Part 1 §8): plans are now Starter · Pro · Team + Enterprise strip. **Remove the separate Free strip** (Starter is the free plan). Hero row = Starter, Pro (highlighted), Team. Starter's card shows "₹0", microcopy "Free, no card needed", CTA **"Start with Starter"** (signed-out) / "Your plan" (current).
- **Rewrite copy that said "Free":** hero H1 e.g. "Start free. Upgrade when you need active testing, automation or a team." Remove "Free plan includes…" strings; derive limits from config ("Starter includes {maxMonthlyScans} scans a month").
- **Comparison table:** add an **Engines** section generated from the registry (14 rows × plans, ✓ from `minPlan`, "Coming soon" rows from `ROADMAP_ENGINES`), then limits and features from config. Card key lines: "7 of 14 engines" / "14 of 14 engines + active verified tests".
- Dashboard **Billing** page: same adapter; usage meters (sites, scans this month, members); plan cards; downgrade explainer (pricing prompt §19). Internal/staff handling stays as Part 2.
- Update upgrade nudges, FAQ, and the landing teaser to the new names.

## I2. Dashboard chrome fixes (from your latest screenshot)
- **Plan chip:** shows the plan **name** from config plus scans left, e.g. "**Starter** · 6 scans left". Never "Free Developer". (Context-aware version for staff arrives in Part 2, Phase C. Build the chip behind `adaptPlanChip(session, org, context)` so staff contexts plug in.)
- **Sidebar lock (top):** remove the bottom "pin". Add a toggle button in the **header row of the sidebar**, right of the logo (expanded) and directly **under the logo** in the 72 px rail. Icon `Lock` when locked open, `LockOpen` when auto-collapse, `aria-pressed`, tooltip "Keep sidebar open" / "Auto-hide sidebar", shortcut **⌘/Ctrl+B**. Persist after mount only (hydration-safe). Keep hover-intent behavior from Part 2 when unlocked.
- **Plan-gated items:** show a small **plan pill** ("Pro", "Team") instead of a Lock icon; clicking opens the contextual `UpgradeNudge`.
- Update the icon map from Part 1/2: `Lock` is reserved for the sidebar toggle (and TLS iconography); plan gating = pills; "not assessed" = `CircleMinus`.
- **Quick Scan card:** replace the black slab + blue "Register & Scan Target" with the light Ember & Paper card and a `brand` button; remove "GATE ARMED" jargon. Show the pre-scan preview line ("7 engines will run").
- **Next-step card:** do not print raw probe URLs (e.g. `…/non-existent-probe-1790…`). Say it plainly: "A made-up page returned a stack trace on {host}" and link to the finding.
- **First-run checklist must be plan-aware:** "Arm CI/CD quality gate" is **locked with a "Team" pill** on Starter/Pro (and hidden from the required count if the plan lacks it). The progress counter uses only steps the plan can complete.
- Scans table: row for a running scan links to its progress page; columns "Scan score", plus a small coverage text ("7/14").

## I3. Copy truth check (final)
Re-run the Phase F claim-vs-code table over all changed screens and the landing page. Zero claims that the code cannot back.

**Phase I acceptance:** change a plan's price/limit/engine `minPlan` in config only, and the pricing page, billing page, plan chip, engine counts and nudges all update with no JSX edits.

---

## 7. PHASE J: STAFF-PORTAL CHANGES (Part 2's Phases B–D are already built; do these after Phase I)

1. **Staff allowlist uses exact emails, not domains.** The owner's account is a personal Gmail, which has **no Workspace `hd` claim**. Use `STAFF_ALLOWED_EMAILS` (exact match, lowercase, `email_verified` true) plus the `platform_roles` row. **Never allow `gmail.com` as a domain.** The owner email is set only via env (`STAFF_BOOTSTRAP_OWNER_EMAIL`); **never hardcode it** in source, migrations or tests (use `owner@example.test` in tests). Document in the README: enable 2-Step Verification or a passkey on the owner's Google account.
2. **Staff entry point:** the avatar menu shows **"Open Staff Console"** only when the **server** says the signed-in identity has an active platform role. It still goes through the staff sign-in (`/staff/login`, fresh Google round trip). Not shown to anyone else; not in bundles for customers beyond a generic server-driven flag.
3. **One context switcher** at the top of the sidebar replaces the separate workspace switcher + PortalSwitcher. For staff it lists: *Staff Console*, *Customer view · Zerivex Internal*, and the user's own customer workspace(s). It sits below the logo + lock row.
4. **Plan chip by context:**

| Context | Chip |
|---|---|
| Staff Console | Role badge (Owner / Admin / Support) |
| Customer view (Zerivex Internal) | "Owner · all tools" / "Admin · all tools" / "Support · Pro tools"; Plan Preview (Phase D) can show Starter / Pro / Team |
| Normal customer workspace | Real plan from config, e.g. "Starter · 6 scans left" |

5. **Staff entitlements reference the new plan config:** Owner/Admin = every implemented engine and feature; Support = `PRO` (by reference to the plan config, so changes to Pro flow through). Internal-org scans also write engine receipts like any other scan.
6. Plan Preview lists plans from `PLAN_RANK`, never a hardcoded list. Support's cap is **rank of `PRO`** (not `TEAM_PRO`/Team). Item 1 (exact-email allowlist) is verified in Phase 0.6; items 2–4 (avatar-menu entry, single context switcher, plan chip by context) are **new work** done here and extend the existing `PortalSwitcher`, `CustomerPortalStaffBar` and plan-preview dropdown rather than replacing them.

---

## 8. TESTS & QA

**Keep green:** all existing tests, lint, typecheck, build.

**Add**
- *F:* registry helpers (`enginesForPlan`, precedence plan-over-verification), resolver per plan, quota enforcement incl. concurrent requests, fix re-test exemption + daily cap, legacy alias mapping, config-only change test (change `minPlan`/price, assert UI adapters update).
- *G:* runner with fake engines covering `PASSED`, `FINDINGS_DETECTED`, `NO_INPUTS`, `ERROR`, `TIMED_OUT`, `LOCKED_BY_PLAN`, `LOCKED_UNVERIFIED`; stage transitions; heartbeat/stale logic; mid-scan plan change does not alter a running scan; progress API org isolation (IDOR), auth, no evidence payloads; `useScanProgress` state machine (polling, backoff, hidden tab, terminal stop, error banner); older scans render the "not recorded" note.
- *H:* golden score fixtures, monotonic properties, caps, dedupe, coverage, determinism, legacy untouched, the D1 regression.
- *I:* plan chip adapter per context, plan-aware checklist, sidebar lock persistence (post-mount) and keyboard shortcut, no "Free Developer"/"V1–V4"/"models" strings in the UI (grep test).

**Manual QA:** run a real scan on a Starter workspace (7 engines run, 7 shown as not assessed with correct pills), on a Pro workspace with an **unverified** target (active engines "Verify ownership"), and on a verified target (active engines run or show "Nothing to test"). Reload mid-scan and confirm identical state. Screenshots at 1440 and 390 px of: progress screen (running and complete), receipt, pricing page, billing page, sidebar locked/unlocked.

---

## 9. DEFINITION OF DONE

- [ ] Plans: Starter (₹0) · Pro · Team · Enterprise from **one config**; legacy IDs mapped; paying subscribers checked before migrating
- [ ] Engine registry is the only source for engine lists, counts, gating, pricing matrix and receipts
- [ ] Engines gated **server-side**; fix re-tests free and capped
- [ ] Every scan stores 14 engine rows; progress screen is real-time, persisted, honest, and never pads time
- [ ] Engine Receipt on completed scans; older scans say "not recorded"
- [ ] Scoring v2 implemented **only after approval**; two numbers; caps; dedupe; coverage always shown; versioned breakdown; legacy preserved
- [ ] No provisional score during a scan
- [ ] Marketing/dashboard copy matches the code (claim-vs-code table clean); no "models", no V1–V4
- [ ] Sidebar lock at the top; plan pills instead of lock icons; plan chip shows the real plan name
- [ ] Phase 0: each review item reported confirmed/not confirmed; re-auth is a real fresh sign-in; no fake credit grants; Support capped at Pro; Plan Preview enforced server-side; test-coverage map delivered
- [ ] Phase J: avatar-menu "Open Staff Console", single context switcher, plan chip by context
- [ ] All tests green; final report lists deviations and open questions

---

## APPENDIX A: ENGINE REGISTRY (verify ids and rule prefixes against the code)

| # | Engine id | Display name | "Doing" line | Class | Min plan | Verified ownership | Needs inputs |
|---|---|---|---|---|---|---|---|
| 1 | `check-tls` | TLS & certificate | Checking your HTTPS certificate, TLS version and HSTS | Passive | **Starter** | no | no |
| 2 | `check-headers` | Security headers | Checking CSP, clickjacking, MIME-sniffing, referrer and permissions headers | Passive | **Starter** | no | no |
| 3 | `check-cookies` | Cookie flags | Checking Secure, HttpOnly and SameSite on your cookies | Passive | **Starter** | no | no |
| 4 | `check-cors` | CORS policy | Checking whether other websites can read your responses | Passive | **Starter** | no | no |
| 5 | `check-exposed-secrets` | Exposed secrets & files | *(write this line from the code's real behavior, e.g. "Checking whether /.env and /.git are publicly readable")* | Passive | **Starter** | no | no |
| 6 | `check-security-txt` | security.txt | Checking for a security contact file (RFC 9116) | Passive | **Starter** | no | no |
| 7 | `check-ai-code-smells` | AI code smells | Checking for leftover debug, seed and GraphQL introspection routes | Passive | **Starter** *(moved from Pro)* | no | no |
| 8 | `check-http-methods` | HTTP methods | Checking whether risky methods like TRACE, PUT or DELETE are allowed | Passive | Pro | no | no |
| 9 | `check-stack-trace` | Error leaks | Checking whether errors reveal stack traces or file paths | Passive | Pro | no | no |
| 10 | `check-api-security` | Open API endpoints | Checking common API paths for data anyone can read | Passive | Pro | no | no |
| 11 | `check-sqli` | SQL injection | Testing parameters for SQL injection (safe, non-destructive probes) | Active | Pro | **yes** | **yes** |
| 12 | `check-xss` | Reflected XSS | Testing parameters for reflected script injection | Active | Pro | **yes** | **yes** |
| 13 | `check-open-redirect` | Open redirects | Testing redirect parameters for open redirects | Active | Pro | **yes** | **yes** |
| 14 | `check-path-traversal` | Path traversal | Testing file parameters for directory traversal | Active | Pro | **yes** | **yes** |

Result: **Starter 7 of 14 · Pro/Team/Enterprise 14 of 14.** Roadmap (Coming soon, never counted): API schema fuzzing, authenticated session scan, AI repo analysis.

## APPENDIX B: PROPOSED SCORE V2 PARAMETERS (starting values for H1; owner will adjust)

| Parameter | Proposed default |
|---|---|
| Starting score | 100 |
| Base penalty by severity | Critical 30 · High 15 · Medium 6 · Low 2 · Info 0 |
| Confidence multiplier | map the real enum values: confirmed 1.0 · high 1.0 · medium 0.7 · low 0.4 |
| Dedupe key | `(rule_id, normalized endpoint path)` counted once per scan |
| Per-engine penalty cap | 40 points |
| Severity caps | open Critical ⇒ max 59 · open High ⇒ max 79 |
| `ACCEPTED_RISK` | 50% of penalty, does **not** trigger caps, flagged in UI |
| `FALSE_POSITIVE` / `FIXED` (verified) | 0 |
| Manual "mark fixed" without verification | no score effect |
| Unassessed engines (locked, `NO_INPUTS`, `ERROR`, `TIMED_OUT`) | no points, not "passed"; reduce **coverage** |
| Coverage | assessed engine weight ÷ total weight; always displayed next to the score |
| Grade ceiling by coverage | **option, default off** (owner decides; H1 shows its effect) |
| Floor | 0 |

## APPENDIX C: ROUTES & ENDPOINTS TOUCHED
**Existing:** `POST /api/scans`, `GET /api/scans/[id]`, `GET /api/billing`, `POST /api/billing/checkout`, `GET /api/findings`, `POST /api/findings/[id]/verify`.
**New (additive):** `GET /api/scans/[id]/progress`, `GET /api/engines`, `GET /api/posture` (after H approval).
**New migrations (additive):** `scan_engine_runs`; `scan_jobs` columns (`stage`, `stage_updated_at`, `plan_snapshot`, `last_heartbeat_at`, `manifest_summary`, `incomplete`, `score_version`, `score_breakdown`); `subscriptions.legacy_plan_id` (with the gated data migration).
