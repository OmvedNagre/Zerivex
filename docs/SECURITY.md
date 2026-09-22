# Zerivex Security Policy & Engineering Controls

> **Core Principle:** "Security correctness over visual completion."

---

## 1. Security Mandates
1. **Never Trust Client State:** Role, subscription tier, tenant ID, and permissions must never be accepted from client request bodies or headers. Authorization must be computed strictly server-side.
2. **Never Claim Without Implementation:** No security claim or scan result may be presented unless backed by implemented, tested, and deterministic code.
3. **No Simulated Findings:** Synthetic or mock vulnerabilities must never be mixed with real scan results.
4. **Append-Only Audit Trail:** All administrative, authorization, and scan actions must be written to an immutable audit log.
5. **No Secrets in Source:** No API keys, credentials, or private tokens in Git or client bundles.

---

## 2. Hardened HTTP & Cookie Standards
- **Cookie Specification:** `__Host-zerivex_session`
  - `HttpOnly: true` (Inaccessible to JavaScript)
  - `Secure: true` (Transmitted strictly over HTTPS)
  - `SameSite: Lax` (Protects against cross-site request forgery)
  - `Path: /` (Scope limited to host root)
- **Security Headers:**
  - `Content-Security-Policy`: Strict script and connect directives.
  - `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`
  - `X-Content-Type-Options`: `nosniff`
  - `X-Frame-Options`: `DENY`
  - `Referrer-Policy`: `strict-origin-when-cross-origin`
  - `Permissions-Policy`: Camera, microphone, and geolocation disabled.

---

## 3. Scanner SSRF & DNS Rebinding Defenses
The scanner makes outbound HTTP requests to user-supplied targets. To prevent SSRF attacks:
- **Pre-flight DNS Check:** Resolve all addresses for target host.
- **CIDR Blocklist:** Reject:
  - Loopback (`127.0.0.0/8`, `::1`)
  - RFC1918 Private IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)
  - RFC4193 Unique Local IPv6 (`fc00::/7`)
  - Link-Local (`169.254.0.0/16`, `fe80::/10`)
  - Cloud Metadata (`169.254.169.254`, `metadata.google.internal`)
- **Socket IP Pinning:** TCP connection is initiated directly to the pre-validated IP address while preserving the `Host` header, preventing DNS TOCTOU attacks.
- **Manual Redirect Validation:** HTTP 3xx responses are intercepted and validated sequentially before following.
