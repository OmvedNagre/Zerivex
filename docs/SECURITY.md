# Zerivex Security Policy & Engineering Controls

> **Core Principle:** "Security correctness over visual completion."  
> **Traceability:** All security controls map directly to threats in [`docs/THREAT_MODEL.md`](file:///Users/omvednagre/Desktop/Zerivex/docs/THREAT_MODEL.md).

---

## 1. Absolute Governing Principles
1. **Never Trust Client State:** Role, subscription tier, tenant ID, and permissions must never be accepted from client request bodies or headers. Authorization must be computed strictly server-side.
2. **Never Claim Without Implementation:** No security claim or scan result may be presented unless backed by implemented, tested, and deterministic code.
3. **No Simulated Findings:** Synthetic, placeholder, or mock vulnerabilities must never be mixed with real scan results.
4. **Append-Only Audit Trail:** All administrative, authorization, and scan actions must be written to an immutable audit log.
5. **No Secrets in Source:** No API keys, credentials, or private tokens in Git or client bundles.
6. **Owner Entitlement vs Security Control:** Platform owner access grants full product entitlements server-side. It does NOT bypass authentication, database constraints, audit logging, or scanner SSRF safety controls.

---

## 2. Hardened HTTP & Cookie Standards
- **Cookie Specification:** `__Host-zerivex_session`
  - `HttpOnly: true` (Inaccessible to client JavaScript)
  - `Secure: true` (Transmitted strictly over HTTPS)
  - `SameSite: Lax` (Protects against cross-site request forgery)
  - `Path: /` (Scope limited to host root)
- **CSRF Protection:** SameSite cookies supplemented by custom header verification (`X-Requested-With`) on state-changing API endpoints.
- **Fail-Closed Configuration:** Application boots with strict schema validation on environment variables; if security keys (`SESSION_SECRET`, `DATABASE_URL`) are missing or malformed, the process exits with an error immediately.

---

## 3. Scanner SSRF & DNS Rebinding Defenses
The scanner makes outbound HTTP requests to user-supplied targets. To prevent SSRF attacks:
- **Pre-flight DNS Check:** Resolve all IPv4 and IPv6 addresses for the target host.
- **CIDR Blocklist:** Reject:
  - Loopback (`127.0.0.0/8`, `::1`)
  - RFC1918 Private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - RFC4193 Unique Local IPv6 (`fc00::/7`)
  - Link-Local (`169.254.0.0/16`, `fe80::/10`)
  - Cloud Metadata (`169.254.169.254`, `metadata.google.internal`)
- **Socket IP Pinning:** TCP connection is initiated directly to the pre-validated IP address while preserving the `Host` header, preventing DNS TOCTOU attacks.
- **Manual Redirect Validation:** HTTP 3xx responses are intercepted and validated sequentially before following.
- **Resource Constraints:** 15s timeout cap; 10MB response size limit per request.

---

## 4. Evidence Redaction & Privacy
Scanner evidence must never leak customer or target credentials:
- **Redaction Pipeline:** Multi-stage filtering strips `Authorization`, `Cookie`, `Set-Cookie`, `Proxy-Authorization`, Bearer tokens, private keys, and API secrets.
- **Masking Marker:** Replaced with `[REDACTED_BY_ZERIVEX]`.
- **Tenant Privacy:** Evidence is strictly scoped to the tenant organization.

---

## 5. Rate Limiting & Abuse Prevention
- Centralized `RateLimitService` enforces thresholds on:
  - Authentication attempts (brute-force protection)
  - Scan dispatch per account and per organization
  - Scan frequency per target (cooldown enforcement)
