# ZERIVEX — Recommendations & Architecture Spec: Model Tiering, Scan Diagnostics, & Monetization

> **Document Type:** Architectural Blueprint & Implementation Specification  
> **Target:** ZERIVEX Scanner Engine, Billing System, & Dashboard UI  
> **Status:** Proposal & Planning Specification  
> **Mode:** Planning Mode  

---

## 1. Objective & Vision

This document details the architectural plan to:
1. **Tier the Scanning Engines ("Models")**: Transform the current all-or-nothing scanner execution into a progressive **V1 → V2 → V3 → V4** engine tier system mapped directly to commercial pricing plans (Free → Starter → Pro → Team → Enterprise).
2. **Provide a Post-Scan Execution Diagnostic Report**: After every scan, provide a transparent "Engine Receipt" showing the exact list of engines that executed, which passed, which detected findings, and which were locked/skipped (and why).
3. **Establish Truthful "Coming Soon" Tagging**: Explicitly tag planned/future capabilities in the UI and marketing matrix so no unimplemented security feature is represented as functional.
4. **Align Billing & Entitlements**: Migrate from the legacy 3-plan model to the 5-plan INR structure with credit/scan-weight metering.

---

## 2. Progressive Engine Tiering Model (V1 / V2 / V3 / V4)

Currently, all 10 passive checks run simultaneously on every scan, while the 4 active checks only run if the target is verified. We recommend dividing the 14 engines into clear, differentiated tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PROGRESSIVE ENGINE TIERS                        │
├─────────┬──────────────┬───────────────┬───────────────────────────────┤
│ Tier    │ Engine Count │ Target Plan   │ Engines Included              │
├─────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **V1**  │ 3 Engines    │ Free Tier     │ 1. TLS / SSL Validator        │
│         │              │ (₹0/mo)       │ 2. HTTP Security Headers      │
│         │              │               │ 3. Cookie Security Auditor    │
├─────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **V2**  │ 6 Engines    │ Starter Plan  │ V1 (3 engines) PLUS:          │
│         │              │ (~₹499/mo)    │ 4. CORS Misconfiguration      │
│         │              │               │ 5. Exposed Secrets & .env     │
│         │              │               │ 6. RFC 9116 security.txt      │
├─────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **V3**  │ 14 Engines   │ Pro Plan      │ V2 (6 engines) PLUS:          │
│         │ (Full        │ (~₹1,499/mo)  │ 7. Dangerous HTTP Methods     │
│         │ Battery)     │               │ 8. Stack Trace & Path Leaks   │
│         │              │               │ 9. Unauthenticated API Endpoints│
│         │              │               │ 10. AI Smells & Debug Routes  │
│         │              │               │ PLUS Active Verified Engines: │
│         │              │               │ 11. Active SQL Injection (SQLi)│
│         │              │               │ 12. Reflected XSS Prober      │
│         │              │               │ 13. Open URL Redirection      │
│         │              │               │ 14. Path Traversal Prober     │
├─────────┼──────────────┼───────────────┼───────────────────────────────┤
│ **V4**  │ 14 Engines + │ Team &        │ All 14 Engines PLUS:          │
│         │ Automation   │ Enterprise    │ - Deep Attack Surface Crawler │
│         │ & Fleet      │ (~₹4,999/mo+) │ - CI/CD Quality Gates         │
│         │              │               │ - Scheduled Monitoring Engine │
│         │              │               │ - Multi-Tenant RBAC & Teams   │
│         │              │               │ - Compliance Audit Vault      │
└─────────┴──────────────┴───────────────┴───────────────────────────────┘
```

### Detailed Rationale per Tier

#### Tier V1: Core Perimeter (Free Plan — ₹0/month)
- **Goal:** Answer the essential question: *"Is my public website basically secure?"*
- **Engines:**
  1. `check-tls`: Validates HTTPS, TLS certificate expiration, cipher strength, and HSTS.
  2. `check-headers`: Evaluates Content-Security-Policy (CSP), X-Frame-Options (clickjacking), and X-Content-Type-Options.
  3. `check-cookies`: Checks `Secure`, `HttpOnly`, and `SameSite` flags.
- **Characteristics:** Runs in under 3 seconds. Zero intrusive network traffic. Zero risk of breaking target sites. Establishes the baseline security score.

#### Tier V2: Configuration & Secret Leaks (Starter Plan — ~₹499/month)
- **Goal:** Enable small developers and early-stage builders to find critical configuration oversights.
- **Engines (Adds 3 to V1):**
  4. `check-cors`: Detects dangerous wildcard `*` with credentials and origin reflection.
  5. `check-exposed-secrets`: Checks for exposed `.env`, `.git/HEAD`, `.git/config`, `docker-compose.yml`, etc.
  6. `check-security-txt`: Validates responsible disclosure endpoints (`/.well-known/security.txt`).
- **Characteristics:** Unlocks full scan history and multi-framework code remediation diffs (Next.js, Express, Nginx).

#### Tier V3: Full Security Battery & Active Verification (Pro Plan — ~₹1,499/month)
- **Goal:** Provide serious developers and startups with in-depth testing, including AI flaws and verified injection probing.
- **Engines (Adds 8 to V2):**
  7. `check-http-methods`: Tests for dangerous verbs (TRACE, PUT, DELETE).
  8. `check-stack-trace`: Tests error handling for internal directory and stack trace leaks.
  9. `check-api-security`: Probes for exposed Swagger docs, GraphQL endpoints, and unprotected API endpoints.
  10. `check-ai-code-smells`: Checks for common vibe-coding mistakes (exposed `/api/seed`, `/debug`, `/test-db`, open GraphQL introspection).
  *Active Probing Engines (Requires Target Ownership Verification):*
  11. `check-sqli`: Harmless Boolean/syntax SQL injection probes.
  12. `check-xss`: Canary token reflection without HTML entity escaping.
  13. `check-open-redirect`: Validates `Location` header handling on query parameters.
  14. `check-path-traversal`: Probes for local file traversal (`../../etc/passwd`).

#### Tier V4: Fleet Automation & Compliance (Team & Enterprise — ~₹4,999/month+)
- **Goal:** Integrate security into the development lifecycle across multiple applications and team members.
- **Capabilities:**
  - Automated recurring scan schedules (`cron`).
  - CI/CD build breakers (`POST /api/v1/ci/scan`).
  - OASIS SARIF v2.1.0 exports for GitHub Code Scanning.
  - Multi-user RBAC with role segregation.
  - Tamper-evident Audit Vault with RFC 4180 CSV export.
  - Agency client portfolio segregation.

---

## 3. Post-Scan Execution Diagnostic Report ("The Engine Receipt")

### 3.1 Problem Being Solved
Currently, after a scan finishes, the user receives an overall score (e.g., 92/100) and a list of findings, but **no record of what tools actually ran**. If a user on Free runs a scan, they don't know why SQLi wasn't checked, or whether TLS passed cleanly.

### 3.2 Architectural Specification

#### 1. Data Model Extension
Add an `engine_manifest` JSON column to `scan_jobs` (or return it dynamically from `executeScanJob`):

```typescript
export interface EngineExecutionStatus {
  checkId: string;
  name: string;
  category: string;
  executionClass: 'PASSIVE' | 'ACTIVE';
  tier: 'V1' | 'V2' | 'V3' | 'V4';
  status: 'PASSED' | 'FINDINGS_DETECTED' | 'LOCKED_BY_PLAN' | 'LOCKED_UNVERIFIED' | 'ERROR';
  findingsCount: number;
  durationMs: number;
  lockReason?: string;
}

export interface ScanExecutionManifest {
  totalEnginesInCatalog: number;
  enginesExecuted: number;
  enginesPassed: number;
  enginesWithFindings: number;
  enginesLocked: number;
  enginesFailed: number;
  totalDurationMs: number;
  details: EngineExecutionStatus[];
}
```

#### 2. Scan Runner Telemetry Capture
In `src/core/scanner/scan-runner.ts`, instrument the check loop:
- Wrap each engine execution with timing (`performance.now()`).
- If an engine is not permitted under the user's plan tier, record:
  `status: 'LOCKED_BY_PLAN'`, `lockReason: 'Requires Starter Plan (V2)'` or `'Requires Pro Plan (V3)'`.
- If an active engine is skipped due to unverified ownership, record:
  `status: 'LOCKED_UNVERIFIED'`, `lockReason: 'Requires Target Ownership Verification'`.
- If an engine runs and finds 0 findings, record:
  `status: 'PASSED'`.
- If an engine returns findings, record:
  `status: 'FINDINGS_DETECTED'`.
- Persist this manifest into `scan_jobs.execution_manifest`.

#### 3. Frontend Diagnostic Presentation (Scan Results Page)
Add an **"Engine Verification Receipt"** card to `src/app/(dashboard)/dashboard/scans/[id]/page.tsx`:

```
┌────────────────────────────────────────────────────────────────────────┐
│ SCAN DIAGNOSTIC RECEIPT                                                │
│ 10 of 14 Engines Executed (Plan: Pro) • Target: Verified               │
├────────────────────────────────────────────────────────────────────────┤
│ ✓ TLS & Certificate Validator         0 findings • 142ms    [PASSED]   │
│ ✓ HTTP Security Headers               1 finding  • 88ms     [FLAGGED]  │
│ ✓ Cookie Flag Auditor                 0 findings • 64ms     [PASSED]   │
│ ✓ CORS Misconfiguration Prober        0 findings • 92ms     [PASSED]   │
│ ✓ Exposed Secrets Scanner             0 findings • 310ms    [PASSED]   │
│ ✓ RFC 9116 security.txt               1 finding  • 45ms     [FLAGGED]  │
│ ✓ Dangerous HTTP Methods              0 findings • 78ms     [PASSED]   │
│ ✓ Stack Trace Leaks Prober            0 findings • 112ms    [PASSED]   │
│ ✓ Unauthenticated API Prober          0 findings • 130ms    [PASSED]   │
│ ✓ AI Smells & Debug Auditor           0 findings • 205ms    [PASSED]   │
│                                                                        │
│ 🔒 Active SQL Injection (SQLi)        Locked • Requires Active Scan    │
│ 🔒 Reflected XSS Prober               Locked • Requires Active Scan    │
│ 🔒 Open Redirection Prober            Locked • Requires Active Scan    │
│ 🔒 Path Traversal Prober              Locked • Requires Active Scan    │
└────────────────────────────────────────────────────────────────────────┘
```

This immediately answers the user's question, eliminates confusion, and creates a natural, contextual reason to upgrade or verify their domain!

---

## 4. Transparent "Coming Soon" Tagging Strategy

In strict adherence to the ZERIVEX rule:
> **"Never claim a security capability works unless it is implemented and tested."**

The following features must have explicit, elegant `[Coming soon]` badges added in the UI:

### 1. In the Navigation & Marketing Matrix (Attached Screenshot)
- **Attack Surface:** Keep as is (the crawler and route discovery are implemented).
- **Scanner Battery:** Keep as is (14 deterministic engines are implemented).
- **AI Code Smells:** Clarify copy to: *"Exposed debug routes, seed endpoints & stack traces"* (to accurately reflect HTTP inspection rather than full AST repo SAST).

### 2. In the Pricing & Scan Weight Matrix (`/pricing` & `/dashboard/billing`)
The current scan operation weight matrix should clearly show:
- **Quick Scan (0 credits):** *Active / Included*
- **Deep Active Scan (2 credits):** *Active / Included in Pro*
- **API Schema Fuzzing (4 credits):** `[Coming soon]` *(Introspection & schema fuzzing)*
- **Authenticated Session Scan (5 credits):** `[Coming soon]` *(Session replay traversal)*
- **AI Repo SAST Analysis (6 credits):** `[Coming soon]` *(Deep semantic code review)*

### 3. Styling the "Coming Soon" Badge
The badge must be subtle, technical, and non-distracting:
```css
.zx-coming-soon-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  font-size: 10.5px;
  font-weight: 700;
  font-family: var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ds-text-muted);
  background-color: var(--ds-bg-subtle);
  border: 1px solid var(--ds-border-subtle);
  border-radius: var(--ds-radius-pill);
}
```

---

## 5. Billing & Pricing Alignment Plan

### 5.1 Plan Definition Updates in `src/core/billing/types.ts`
Migrate from the legacy 3-tier structure to the 5-tier canonical structure:

```typescript
export type PlanId = 'FREE' | 'STARTER' | 'PRO' | 'TEAM' | 'ENTERPRISE';

export const PLANS: Record<PlanId, PlanDefinition> = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    tagline: 'Perimeter reconnaissance for developers evaluating Zerivex.',
    pricing: { monthlyInr: 0, yearlyInr: 0, currency: 'INR' },
    limits: { maxVerifiedTargets: 1, maxMonthlyScans: 4, maxTeamMembers: 1 },
    engineTier: 'V1', // 3 engines
    features: {
      deepActiveScans: false,
      attackSurfaceCrawler: false,
      cicdIntegrations: false,
      continuousMonitoring: false,
      complianceAuditVault: false,
      findingCollaboration: false,
      logRetentionDays: 7,
    },
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter',
    tagline: 'Configuration audits and remediation guidance for small projects.',
    pricing: { monthlyInr: 499, yearlyInr: 4990, currency: 'INR' },
    limits: { maxVerifiedTargets: 1, maxMonthlyScans: 20, maxTeamMembers: 1 },
    engineTier: 'V2', // 6 engines
    features: {
      deepActiveScans: false,
      attackSurfaceCrawler: false,
      cicdIntegrations: false,
      continuousMonitoring: false,
      complianceAuditVault: false,
      findingCollaboration: false,
      logRetentionDays: 30,
    },
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Deep active testing, AI smells, and scheduled monitoring for serious apps.',
    badge: 'MOST POPULAR',
    pricing: { monthlyInr: 1499, yearlyInr: 14990, currency: 'INR' },
    limits: { maxVerifiedTargets: 3, maxMonthlyScans: 50, maxTeamMembers: 3 },
    engineTier: 'V3', // Full 14 engines
    features: {
      deepActiveScans: true,
      attackSurfaceCrawler: true,
      cicdIntegrations: false,
      continuousMonitoring: true,
      complianceAuditVault: false,
      findingCollaboration: true,
      logRetentionDays: 90,
    },
  },
  TEAM: {
    id: 'TEAM',
    name: 'Team',
    tagline: 'CI/CD gates, audit vaults, and collaborative management for agencies & teams.',
    pricing: { monthlyInr: 4999, yearlyInr: 49990, currency: 'INR' },
    limits: { maxVerifiedTargets: 15, maxMonthlyScans: 250, maxTeamMembers: 10 },
    engineTier: 'V4', // Full 14 engines + Automation
    features: {
      deepActiveScans: true,
      attackSurfaceCrawler: true,
      cicdIntegrations: true,
      continuousMonitoring: true,
      complianceAuditVault: true,
      findingCollaboration: true,
      logRetentionDays: 365,
    },
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'Custom scale, dedicated compliance, and priority security reviews.',
    pricing: { monthlyInr: 0, yearlyInr: 0, currency: 'INR' }, // Custom
    limits: { maxVerifiedTargets: 999999, maxMonthlyScans: 999999, maxTeamMembers: 999999 },
    engineTier: 'V4',
    features: {
      deepActiveScans: true,
      attackSurfaceCrawler: true,
      cicdIntegrations: true,
      continuousMonitoring: true,
      complianceAuditVault: true,
      findingCollaboration: true,
      logRetentionDays: 730,
    },
  },
};
```

---

## 6. Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASED EXECUTION ROADMAP                        │
├─────────┬──────────────────────────────────────────────────────────────┤
│ Phase 1 │ Scanner Engine Tiering & Execution Manifest                  │
│         │ • Add `tier: 'V1' | 'V2' | 'V3'` to `ScanCheck` interface.   │
│         │ • Update `scan-runner.ts` to filter engines by plan tier.    │
│         │ • Record `execution_manifest` with timestamps & status.      │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Phase 2 │ Post-Scan Diagnostic Telemetry in API & UI                   │
│         │ • Include `executionManifest` in `POST /api/scans` response. │
│         │ • Build "Engine Verification Receipt" card on scan detail    │
│         │   page (`/dashboard/scans/[id]`).                            │
│         │ • Show contextual lock badges with exact plan requirement.   │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Phase 3 │ Truthful "Coming Soon" Badges                                │
│         │ • Add subtle `[Coming soon]` pills to future capabilities    │
│         │   in marketing grid and pricing operation weight cards.      │
│         │ • Ensure zero simulated/fake results exist anywhere.         │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Phase 4 │ 5-Plan Pricing & Entitlement Migration                       │
│         │ • Update `src/core/billing/types.ts` & `entitlement-service`.│
│         │ • Connect operation credits to usage ledger.                 │
│         │ • Verify all 379 existing tests stay green.                  │
└─────────┴──────────────────────────────────────────────────────────────┘
```

---

## 7. Next Steps for Planning Mode

Since we are in **Planning Mode**, we recommend reviewing these two findings documents:
1. Audit Document: [`ZERIVEX_SCANNER_ENGINES_AND_CAPABILITIES_AUDIT.md`](file:///Users/omvednagre/Desktop/Zerivex/findings/ZERIVEX_SCANNER_ENGINES_AND_CAPABILITIES_AUDIT.md)
2. Recommendations Document: [`ZERIVEX_MODEL_TIERING_AND_MONETIZATION_RECOMMENDATIONS.md`](file:///Users/omvednagre/Desktop/Zerivex/findings/ZERIVEX_MODEL_TIERING_AND_MONETIZATION_RECOMMENDATIONS.md)

Once you approve this architecture, we can proceed with Phase 1 of the implementation!
