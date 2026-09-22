# Zerivex System Architecture Specification

> **Tagline:** "Security for software built with AI."  
> **Brand Principle:** "Verify. Detect. Defend."  

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
  Authentication           Authorization            Entitlements
  Google & GitHub OIDC     RBAC + Permissions       Plan Evaluation
  Server-side Sessions     Tenant Isolation         Usage Limits
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
  - Port Allowlist         - CORS Policies          - Evidence
                           - Information Exposure     Collector
```

---

## 2. Core Subsystems

### A. Authentication & Session Manager
- Handles OAuth 2.0 / OpenID Connect handshakes for Google and GitHub.
- Creates server-side sessions with 256-bit cryptographically secure random tokens.
- Issues `__Host-zerivex_session` cookies (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`).
- Stores SHA-256 token hashes in the database.
- Provides immediate session revocation ("Sign Out" and "Sign Out All Other Sessions").

### B. Authorization & Multi-Tenancy
- **Platform RBAC:** Roles (`OWNER`, `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `USER`) define global capabilities.
- **Tenant Isolation:** Every customer entity belongs to an `Organization`. Access to `Project`, `Target`, `ScanJob`, and `Finding` requires verified active membership within that organization.
- **Owner Entitlement Policy:** When `user.role === 'OWNER'`, the authorization engine bypasses commercial plan quotas server-side without altering the customer subscription ledger.

### C. Scanner Worker & SSRF Defense
- **SafeHttpClient:** Encapsulates pre-flight DNS queries, CIDR range validation (blocking loopback, RFC1918, RFC4193, and cloud metadata `169.254.169.254`), raw socket IP pinning to defeat DNS rebinding, and recursive redirect re-validation.
- **Modular Checks:** Deterministic analyzers evaluating TLS parameters, HTTP headers (CSP, HSTS, X-Content-Type-Options), cookies (`Secure`, `HttpOnly`, `SameSite`), CORS origins/credentials, and exposed files/endpoints.
- **Evidence Collector:** Strips authorization headers and sensitive cookie values before persisting evidence snapshots to the database.

---

## 3. Database Schema Blueprint

- `users`: User identity, global role, active status.
- `identities`: OAuth provider mappings (`google`, `github`) with verified emails.
- `sessions`: Active hashed sessions, client metadata, expiration, revocation.
- `organizations`: Multi-tenant customer accounts.
- `memberships`: Organization-level roles (`ORG_OWNER`, `ORG_ADMIN`, `ORG_MEMBER`).
- `projects`: Groupings of applications and attack surfaces.
- `targets`: Web targets, hostname, verification state (`UNVERIFIED`, `PENDING`, `VERIFIED`).
- `domain_verifications`: Verification method (`DNS_TXT`, `HTML_META`), token, expiration.
- `scan_jobs`: Scan records, scan mode (`PUBLIC_PASSIVE`, `VERIFIED_ACTIVE`), status, score.
- `findings`: Deterministic security findings, severity, confidence, evidence JSON, status.
- `audit_logs`: Append-only, tamper-evident record of all security-sensitive operations.
- `platform_bootstraps`: Immutable one-time owner bootstrap tracking.
