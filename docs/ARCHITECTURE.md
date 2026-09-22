# Zerivex System Architecture Specification

> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  
> **Phase Structure:** Phase-gated execution from Phase 0 (0A-0D) through Phase 15.

---

## 1. High-Level System Architecture

Zerivex unifies customer capabilities and platform administration on a single, highly secure Next.js / Node.js backend while maintaining strict separation between presentation, authorization, entitlements, and resource tenancy.

```
                         ZERIVEX PLATFORM
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
           CUSTOMER APP                  CONTROL CENTER
          (User / Org)                   (Platform Owner)
                 │                             │
                 │                             │
            Subscription                  Full Access
            Entitlements                (Server Bypass)
                 │                             │
                 └──────────────┬──────────────┘
                                │
                 SERVER AUTHORIZATION ENGINE
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
  Authentication           Platform RBAC            Entitlements
  Google & GitHub OIDC     Permissions Matrix       Plan Evaluation
  Server-side Sessions     Tenant Isolation         Owner Override
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                 MODULAR SCANNER ENGINE
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
  SafeHttpClient           Check Modules            ScoreEngine
  - SSRF Protection        - TLS/SSL Validity       - Mathematical
  - Socket IP Pinning      - Security Headers         Severity
  - Redirect Validation    - Cookie Flags             Deductions
  - Port Allowlist         - CORS Policies          - Versioned Rules
                           - Information Exposure   - Evidence Redaction
```

---

## 2. Core Subsystems

### A. Authentication & Session Manager
- Handles OAuth 2.0 / OpenID Connect handshakes for Google and GitHub.
- Creates server-side sessions with 256-bit cryptographically secure random tokens.
- Issues `__Host-zerivex_session` cookies (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`).
- Stores SHA-256 token hashes in PostgreSQL.
- Provides immediate session revocation ("Sign Out" and "Sign Out All Other Sessions").
- Fail-closed runtime configuration validation on boot.

### B. Authorization, Multi-Tenancy & Owner Entitlement
- **Platform RBAC:** Roles (`OWNER`, `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `USER`) map to explicit permissions (`scan:create`, `target:verify`, `audit:read`, etc.).
- **Tenant Isolation:** Every customer entity belongs to an `Organization`. Access to `Project`, `Target`, `ScanJob`, and `Finding` requires verified active membership within that organization.
- **Centralized Owner Entitlement Override:** When `user.role === 'OWNER'`, the entitlement engine bypasses commercial plan quotas server-side without altering the customer subscription ledger. Owner access does NOT bypass authentication, database integrity, audit logging, or scanner SSRF controls.

### C. Scanner Worker, Queue & SSRF Defense
- **Queue Abstraction:** Decouples scan initiation from the HTTP request cycle. Phase 4 uses an in-process async worker queue with concurrency limits; Phase 14 upgrades to Redis/BullMQ.
- **SafeHttpClient:** Encapsulates pre-flight DNS queries, CIDR range validation (blocking loopback, RFC1918, RFC4193, and cloud metadata `169.254.169.254`), raw socket IP pinning to defeat DNS rebinding, and recursive redirect re-validation.
- **Modular Checks:** Deterministic analyzers evaluating TLS parameters, HTTP headers (CSP, HSTS, X-Content-Type-Options), cookies (`Secure`, `HttpOnly`, `SameSite`), CORS origins/credentials, and exposed files/endpoints.
- **Evidence Redaction Pipeline:** Synchronously strips authorization headers, cookies, API tokens, and secrets before persisting evidence snapshots to PostgreSQL.
- **ScoreEngine:** Computes a transparent, versioned security score. Communicates risk deductions clearly and never misrepresents scores as absolute guarantees of security.

---

## 3. Database Schema Blueprint (PostgreSQL Canonical)

- `users`: User identity, global role, active status.
- `identities`: OAuth provider mappings (`google`, `github`) with verified emails.
- `sessions`: Active hashed sessions, client metadata, expiration, revocation.
- `organizations`: Multi-tenant customer accounts.
- `memberships`: Organization-level roles (`ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`).
- `projects`: Groupings of applications and attack surfaces.
- `targets`: Web targets, hostname, verification scope (`EXACT_HOST`, `DOMAIN`, `SUBDOMAIN_WILDCARD`, `URL_PATH`), verification status (`UNVERIFIED`, `PENDING`, `VERIFIED`).
- `domain_verifications`: Verification method (`DNS_TXT`, `HTML_META`), token, expiration.
- `scan_jobs`: Scan records, scan mode (`PUBLIC_PASSIVE`, `VERIFIED_ACTIVE`), status, score.
- `findings`: Deterministic security findings, severity, confidence, evidence JSON, status (`OPEN`, `CONFIRMED`, `FALSE_POSITIVE`, `ACCEPTED_RISK`, `FIXED`, `REOPENED`).
- `audit_logs`: Append-only, tamper-evident record of all security-sensitive operations.
- `platform_bootstraps`: Immutable one-time owner bootstrap tracking.
