# ZERIVEX — Comprehensive Codebase Audit: Scanner Engines, "Models", & Capabilities

> **Document Type:** Forensic Technical Audit & System Capability Inventory  
> **Target:** ZERIVEX Codebase (`/src/core`, `/src/app`, `/src/components`)  
> **Status:** Current Production State Analysis  
> **Mode:** Planning & Architectural Revamp  

---

## 1. Executive Summary

This audit performs an end-to-end inspection of the ZERIVEX codebase to catalog:
1. All **scanning engines** (referred to as "models" / testing tools), their execution modes (passive vs. active), rule coverage, and operational status.
2. The exact root cause for why registering a target currently performs only a **"general scan"** without deeper testing.
3. The functional status of all **12 capabilities** presented in the product capability grid (Detect, Verify & Defend, Ship Safely, Prove It).
4. Discrepancies between marketed capabilities and actual code implementations, explicitly identifying which modules are **Implemented & Working**, which are **Partially Implemented**, and which must be tagged as **Coming Soon**.

---

## 2. The 14 Scanner Engines ("Model Battery") — Deep Inventory

In the codebase (`src/core/scanner/checks/`), there are exactly **14 deterministic scanner checks**. 

### 2.1 The Two Fundamental Execution Classes

The scanner separates checks into two strict classes based on the `requiresActiveScan` flag in `ScanCheck`:
- **Passive Checks (`requiresActiveScan: false`)**: Read-only, non-destructive HTTP/TLS inspections that only analyze publicly emitted headers, certificates, public paths, and error responses. These run on **any** scan mode (`PUBLIC_PASSIVE` or `VERIFIED_ACTIVE`), even for unverified target websites.
- **Active Probing Checks (`requiresActiveScan: true`)**: Deliberate injection or path traversal payloads that require cryptographic target ownership proof (`VERIFIED_ACTIVE`). If the scan mode is `PUBLIC_PASSIVE` or the target ownership is unverified, these checks are **completely skipped** and return zero findings.

### 2.2 Complete Engine Inventory Table

| # | Engine Identifier (`id`) | Engine Display Name | Execution Class | `requiresActiveScan` | Rule IDs Generated | Target Input / Prerequisites | Codebase Implementation Status |
|---|---|---|---|---|---|---|---|
| **1** | `check-tls` | TLS / SSL Configuration & Certificate Validator | **Passive** | `false` | `ZX-TLS-001` to `ZX-TLS-006` | Pinned IP, Port 443 | **Fully Functional** (Node `tls.connect`, peer cert expiry, protocol check, HSTS header) |
| **2** | `check-headers` | HTTP Security Headers Evaluator | **Passive** | `false` | `ZX-HDR-001` to `ZX-HDR-006` | Root URL GET request | **Fully Functional** (Audits CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Server leakage) |
| **3** | `check-cookies` | Cookie Security & Flag Auditor | **Passive** | `false` | `ZX-CK-001` to `ZX-CK-003` | `Set-Cookie` response headers | **Fully Functional** (Audits `Secure`, `HttpOnly`, and `SameSite` flags) |
| **4** | `check-cors` | CORS Misconfiguration & Origin Reflection Prober | **Passive** | `false` | `ZX-CORS-001` to `ZX-CORS-003` | GET with untrusted `Origin` header | **Fully Functional** (Detects wildcard `*` with credentials, arbitrary origin reflection, `null` origin trust) |
| **5** | `check-exposed-secrets` | Exposed Secrets & Sensitive Files Scanner | **Passive** | `false` | `ZX-SEC-001` to `ZX-SEC-003` | Probes `/.env`, `/.git/HEAD`, `/.git/config` | **Fully Functional** (Includes content-signature verification to reject HTML false positives) |
| **6** | `check-security-txt` | RFC 9116 security.txt Validator | **Passive** | `false` | `ZX-SEC-SECTXT-001` | `/.well-known/security.txt` | **Fully Functional** (Inspects `Contact:` and `Expires:` directives) |
| **7** | `check-http-methods` | Dangerous HTTP Methods Prober | **Passive** | `false` | `ZX-SEC-VERB-001` | HTTP `OPTIONS`, `TRACE`, `PUT`, `DELETE` | **Fully Functional** (Flags unauthenticated destructive verbs and dangerous TRACE method) |
| **8** | `check-stack-trace` | Error Handling & Stack Trace Leaks | **Passive** | `false` | `ZX-SEC-STACK-001` | Malformed URL probe | **Fully Functional** (Detects regex patterns for Node/Python/PHP/DB stack dumps) |
| **9** | `check-api-security` | Unauthenticated API Endpoint Prober | **Passive** | `false` | `ZX-SEC-API-001` | Common API paths (`/api/users`, `/swagger.json`) | **Fully Functional** (Flags unauthenticated JSON payloads exposing internal user/schema data) |
| **10** | `check-ai-code-smells` | AI Code Smells & Debug Interface Auditor | **Passive** | `false` | `ZX-AI-001` to `ZX-AI-003` | Probes `/api/seed`, `/debug`, `/graphql` | **Fully Functional** (Flags exposed DB reset routes, unauthenticated seed routes, and GraphQL introspection) |
| **11** | `check-sqli` | Active SQL Injection (SQLi) Prober | **Active** | `true` | `ZX-ACT-SQLI-001` | Discovered query params, endpoints | **Fully Functional** (Harmless syntax delimiters `'`, `OR 1=1--`, boolean differential analysis, circuit-breaker protected) |
| **12** | `check-xss` | Reflected Cross-Site Scripting Prober | **Active** | `true` | `ZX-ACT-XSS-001` | Discovered query params, endpoints | **Fully Functional** (Injects benign canary tags `<zx7182>`, verifies reflection without HTML entity encoding) |
| **13** | `check-open-redirect` | Open URL Redirection Prober | **Active** | `true` | `ZX-ACT-REDIR-001` | Discovered redirect params (`next`, `url`, etc.) | **Fully Functional** (Injects benign external target, verifies `Location` header in 30x responses) |
| **14** | `check-path-traversal` | Local File Inclusion / Path Traversal Prober | **Active** | `true` | `ZX-ACT-TRAV-001` | Discovered file/path params | **Fully Functional** (Injects `../../etc/passwd` & win.ini probes, verifies system file content markers) |

---

## 3. Why Registering a Target Currently Only Runs a "General Scan"

When a user registers a target and clicks "Run scan", they encounter what feels like a basic, general scan. Here is the exact architectural reason:

### Root Cause 1: Targets Default to `UNVERIFIED` Status
When a new target is registered (`POST /api/targets`), its initial state is `verification_status = 'UNVERIFIED'`.
To unlock active scanning, the user must prove ownership via:
- DNS TXT record (`_zerivex-challenge.<host>`)
- HTTP Header (`X-Zerivex-Verification`)
- HTML Meta Tag (`<meta name="zerivex-verification">`)
- Well-known file (`/.well-known/zerivex-verification.txt`)

If target ownership has not been confirmed:
- `assertTargetScanAuthorization()` in `src/core/targets/verification-service.ts` **blocks** any attempt to run in `VERIFIED_ACTIVE` mode (returning `403 Forbidden`).
- The scan is restricted to `PUBLIC_PASSIVE`.

### Root Cause 2: Silent Omission of the 4 Active Engines
In `src/core/scanner/scan-runner.ts` (lines 268–274):
```typescript
const results = await Promise.allSettled(
  ALL_SCAN_CHECKS.map(async (check) => {
    if (check.requiresActiveScan && job.scanMode !== 'VERIFIED_ACTIVE') {
      return []; // <--- Silently skips SQLi, XSS, Redirects, Path Traversal
    }
    return check.run(scanContext);
  })
);
```
When `scanMode` is `PUBLIC_PASSIVE`, the 4 active engines (`check-sqli`, `check-xss`, `check-open-redirect`, `check-path-traversal`) **silently exit without executing**.
The user is never told:
- *"4 active engines were skipped because target ownership is unverified."*
- *"Active verification requires the Pro plan."*

### Root Cause 3: All 10 Passive Engines Run in an All-or-Nothing Batch
Currently, there is **no progressive tiering** among the passive checks. Every passive scan runs all 10 checks at once. There is no concept of:
- Tier 1 (Free / V1): 3 core checks (TLS, Headers, Cookies)
- Tier 2 (Starter / V2): 6 checks (+ CORS, Exposed Secrets, security.txt)
- Tier 3 (Pro / V3): 10 passive checks + 4 active verified checks
- Tier 4 (Team / V4): Full battery + Deep Attack Surface Crawling

### Root Cause 4: Zero Post-Scan Diagnostic Telemetry
When `executeScanJob` completes:
- It returns only `{ scanJob, findingsCount }`.
- It does **not** persist or report which specific engines were evaluated, which passed cleanly, which found issues, or which were locked/skipped.
- The UI displays the score and findings, but never answers: *"Which tools were used to scan my site?"*

---

## 4. Audit of the 12 Capabilities in the Product Matrix

The product matrix features 12 capabilities grouped into 4 pillars. Below is the audited reality of each:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DETECT PILLAR                                        │
├────────────────────────┬──────────────────────────────────┬────────────────────────────┤
│ Marketing Claim        │ Codebase Reality & Location      │ Status                     │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Scanner Battery        │ 14 deterministic engines in      │ ✅ IMPLEMENTED             │
│ (14 deterministic      │ `src/core/scanner/checks/`       │ 10 passive, 4 active.      │
│ engines)               │                                  │ Fully functional.          │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Attack Surface         │ `src/core/surface/crawler.ts` &  │ ✅ IMPLEMENTED             │
│ (Automated crawler &   │ `tech-detector.ts`               │ Crawls HTML links, sitemap,│
│ route discovery)       │                                  │ robots.txt; fingerprints.  │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ AI Code Smells         │ `src/core/scanner/checks/        │ ⚠️ IMPLEMENTED AS HTTP     │
│ (Defense against       │  ai-code-smells-check.ts`        │ Probes debug endpoints     │
│ Cursor, v0 & Lovable)  │                                  │ & stack traces. NOT a SAST │
│                        │                                  │ or repo code analyzer.     │
└────────────────────────┴──────────────────────────────────┴────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              VERIFY & DEFEND PILLAR                                    │
├────────────────────────┬──────────────────────────────────┬────────────────────────────┤
│ Marketing Claim        │ Codebase Reality & Location      │ Status                     │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Target Ownership       │ `src/core/targets/               │ ✅ IMPLEMENTED             │
│ (DNS TXT, HTTP header, │  verification-service.ts`        │ Node `dns/promises`        │
│ HTML meta challenge)   │                                  │ & HTTP meta tag probes.    │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ SSRF Egress Shield     │ `src/core/security/              │ ✅ IMPLEMENTED             │
│ (Socket-level DNS pin, │  egress-firewall.ts` &           │ Blocks RFC 1918, AWS       │
│ private IP defense)    │ `safe-http-client.ts`            │ metadata, loopbacks.       │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Fix Recipes Catalog    │ `src/core/remediation/           │ ✅ IMPLEMENTED             │
│ (31+ before/after      │  remediation-catalog.ts`         │ Exactly 32 rule diffs      │
│ diffs for Next/Express)│                                  │ for Next.js, Express, Nginx│
└────────────────────────┴──────────────────────────────────┴────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SHIP SAFELY PILLAR                                      │
├────────────────────────┬──────────────────────────────────┬────────────────────────────┤
│ Marketing Claim        │ Codebase Reality & Location      │ Status                     │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ CI/CD Quality Gates    │ `src/core/cicd/                  │ ✅ IMPLEMENTED             │
│ (Deterministic build   │  quality-gate-engine.ts`         │ Threshold evaluator &      │
│ breaker)               │                                  │ markdown summary generator.│
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ OASIS SARIF v2.1.0     │ `src/core/reporting/             │ ✅ IMPLEMENTED             │
│ (GitHub Code Scanning  │  sarif-generator.ts`             │ Fully compliant SARIF      │
│ tab integration)       │                                  │ JSON schema output.        │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Webhooks & API Keys    │ `src/core/webhooks/` &           │ ✅ IMPLEMENTED             │
│ (HMAC-signed alerts)   │ `src/core/auth/api-key-service`  │ HMAC-SHA256 signature      │
│                        │                                  │ headers & scoped keys.     │
└────────────────────────┴──────────────────────────────────┴────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                  PROVE IT PILLAR                                       │
├────────────────────────┬──────────────────────────────────┬────────────────────────────┤
│ Marketing Claim        │ Codebase Reality & Location      │ Status                     │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Compliance Audit Vault │ `src/core/audit/audit-vault.ts`  │ ✅ IMPLEMENTED             │
│ (Tamper-evident logs & │                                  │ SHA-256 hash chaining,     │
│ RFC 4180 CSV export)   │                                  │ Merkle verification & CSV. │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Multi-Tenant RBAC      │ `src/core/rbac/` &               │ ✅ IMPLEMENTED             │
│ (5-tier roles with     │ `src/core/teams/team-service.ts` │ 5 role tiers with secure   │
│ token invitations)     │                                  │ invitation tokens.         │
├────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│ Agency Portfolio       │ `src/core/agency/`               │ ✅ IMPLEMENTED             │
│ (White-label reporting │                                  │ Client portfolio models &  │
│ for client fleets)     │                                  │ aggregate metrics.         │
└────────────────────────┴──────────────────────────────────┴────────────────────────────┘
```

---

## 5. What is Truly Missing / Must Be Tagged as "Coming Soon"

While the 14 core scanning checks and all 12 platform modules exist in the codebase, the following advanced capabilities are **not implemented** and must be transparently tagged as **`[Coming soon]`**:

### 1. API Schema Fuzzing & Deep API Security (`weight: 4`)
- **Claimed in Pricing Matrix:** "API Schema Scan: Introspection & fuzzing".
- **Current State:** Only simple GET requests to `/api/users` and `/swagger.json` exist. There is no dynamic parameter fuzzer, no OpenAPI v3 request generator, and no GraphQL mutation fuzzer.
- **Required Tag:** `[Coming soon]`.

### 2. Authenticated Session Scanning (`weight: 5`)
- **Claimed in Pricing Matrix:** "Authenticated Scan: Session token traversal".
- **Current State:** The crawler and checks only support unauthenticated public crawling. There is no cookie/header replay session manager that logs in and tests protected user dashboards.
- **Required Tag:** `[Coming soon]`.

### 3. Deep AI Code/Repo Analysis (`weight: 6`)
- **Claimed in Pricing Matrix:** "AI Code Analysis: Deep semantic reasoning".
- **Current State:** Zerivex does not clone Git repositories, parse ASTs, or run LLM inference over source files. The existing `check-ai-code-smells` is an HTTP probe against `/api/seed`, `/debug`, and GraphQL introspection.
- **Required Tag:** `[Coming soon]`.

### 4. Enterprise SSO / SAML
- **Claimed in Enterprise Tier:** "SSO / SAML integration".
- **Current State:** Only email/password + session cookies exist. No SAML 2.0 or OIDC provider exists.
- **Required Tag:** `[Coming soon]`.

---

## 6. Discrepancies in the Billing & Entitlement Layer

1. **Plan Tiers Mismatch:**
   - In `src/core/billing/types.ts`: Only 3 plans are defined: `FREE_DEVELOPER` (₹0), `TEAM_PRO` (₹3,999), and `ENTERPRISE` (₹19,999).
   - In the Master Pricing Spec: 5 plans are specified:
     - **Free**: ₹0/month (1 public scan/week)
     - **Starter**: ₹499/month (~20 quick scans, ~2 deep scans)
     - **Pro**: ₹1,499/month (~50 scans, verified active scans)
     - **Team**: ₹4,999/month (~15 apps, multiple team members)
     - **Enterprise**: Custom pricing
2. **Missing Credit / Weight Ledger:**
   - `UsageLedgerRecord` only tracks raw counts (`MONTHLY_SCANS`, `ACTIVE_TARGETS`, `TEAM_MEMBERS`).
   - It does not calculate operation weights (e.g., Quick Scan = 0, Deep Scan = 2, API Scan = 4).
3. **No Per-Scan Engine Gating:**
   - The scanner does not enforce which engines can run based on the user's plan tier (other than a coarse `deepActiveScans: boolean` toggle for active vs passive).

---

## 7. Conclusion

The core engine infrastructure in ZERIVEX is deterministic and functional across all 14 checks. However, the system currently lacks:
1. **Engine Tiering (V1 / V2 / V3 / V4)** to progressively unlock testing tools across Free, Starter, Pro, and Team plans.
2. **Post-Scan Execution Manifests** that provide a transparent diagnostic report showing exactly which engines ran, which passed, and which were skipped or locked.
3. **Transparent `[Coming soon]` Badges** on future roadmap features (API Schema Fuzzing, Authenticated Scans, and Repo SAST).

These recommendations are detailed in the companion document:  
[`ZERIVEX_MODEL_TIERING_AND_MONETIZATION_RECOMMENDATIONS.md`](file:///Users/omvednagre/Desktop/Zerivex/findings/ZERIVEX_MODEL_TIERING_AND_MONETIZATION_RECOMMENDATIONS.md).
