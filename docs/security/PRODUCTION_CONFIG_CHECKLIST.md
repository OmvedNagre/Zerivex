# ZERIVEX Production Configuration Checklist & Security Audit

> **Document Version:** 1.0 (Phase 15 Launch Readiness Certification)  
> **Classification:** Confidential / Platform Operations  
> **Brand Principle:** *"Security for software built with AI. Verify. Detect. Defend."*  

---

## 1. Environment Variable Audit & Security Requirements

All environment variables are validated at runtime boot by `src/core/config/env-validator.ts`. If any mandatory variable is missing or malformed, the application terminates immediately with a fail-closed error.

| Environment Variable | Required in Prod | Sensitivity Level | Purpose & Cryptographic Requirements |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | Public | Set to `production`. Disables dev mock OAuth, enforces HTTPS cookies, enables HSTS, and masks internal stack traces. |
| `NEXT_PUBLIC_APP_URL` | **YES** | Public | Canonical platform origin (e.g. `https://zerivex.com`). Used for OAuth redirects and canonical links. |
| `DATABASE_URL` | **YES** | **CRITICAL** | Neon PostgreSQL connection string. Must include `sslmode=require`. Format: `postgresql://user:pass@ep-host.neon.tech/dbname?sslmode=require`. |
| `SESSION_SECRET` | **YES** | **CRITICAL** | Encryption and HMAC signing key for sessions. Must have $\ge 32$ bytes entropy. Generate using `openssl rand -hex 32`. |
| `INITIAL_OWNER_EMAIL` | **YES** | Sensitive | Bootstrap email for the primary platform owner. Locked down after first platform bootstrap. |
| `GOOGLE_CLIENT_ID` | Optional | Sensitive | OAuth 2.0 Client ID for Google Workspace authentication with PKCE. |
| `GOOGLE_CLIENT_SECRET` | Optional | **CRITICAL** | Google OAuth client secret. Never exposed to browser or client bundles. |
| `GITHUB_CLIENT_ID` | Optional | Sensitive | OAuth App Client ID for GitHub SSO. |
| `GITHUB_CLIENT_SECRET` | Optional | **CRITICAL** | GitHub OAuth client secret. |
| `STRIPE_SECRET_KEY` | Optional | **CRITICAL** | Stripe live API secret (`sk_live_...`). Required for live billing checkouts. |
| `STRIPE_WEBHOOK_SECRET` | Optional | **CRITICAL** | Stripe webhook signing secret (`whsec_...`) used to verify incoming invoice events via HMAC. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Optional | Public | Stripe client-side public publishable key (`pk_live_...`). |
| `LOG_LEVEL` | Optional | Config | Logging threshold (`error`, `warn`, `info`, `debug`). Recommended `info` in production. |

---

## 2. Infrastructure & Network Defense Configuration

### A. Neon Serverless PostgreSQL
- [x] **SSL Transport Encryption:** `sslmode=require` verified on all connections.
- [x] **Connection Pool Limit:** Set to `max: 20` with idle timeout of `30,000ms`.
- [x] **Slow Query Logger:** Threshold set to 1000ms with query parameter masking.
- [x] **Schema Migrations:** Database verified up to migration `008_launch_readiness_audit.sql`.
- [x] **Automated Backups:** Daily point-in-time recovery (PITR) enabled with 7-day retention.

### B. Egress Firewall & SSRF Defense
- [x] **Private Subnet Blocklist:** Verified blocking `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.
- [x] **Loopback Blocklist:** Verified blocking `127.0.0.0/8` and IPv6 `::1`.
- [x] **Cloud Metadata Protection:** Verified blocking `169.254.169.254` and `fe80::/10`.
- [x] **Multi-A / Multi-AAAA Pinning:** Resolves all DNS entries and verifies every IP before connecting.
- [x] **Socket Timeout:** Enforces 12-second hard timeout on active socket reads.

### C. Edge Middleware & Rate Limiting
- [x] **Sliding-Window Token Bucket:** Active in Edge runtime across 3 operational tiers:
  - `AUTH`: 10 requests / minute per IP.
  - `SCANS`: 20 requests / minute per IP.
  - `API_STANDARD`: 120 requests / minute per IP.
- [x] **Payload Size Guard:** 2MB body limit on JSON API requests, 10MB limit on file uploads.
- [x] **Reverse Proxy IP Resolution:** Evaluates `CF-Connecting-IP`, `True-Client-IP`, and validated leftmost `X-Forwarded-For`.

---

## 3. Defense-in-Depth HTTP Security Headers

Verified configured in `next.config.mjs` and `src/middleware.ts`:

```http
Content-Security-Policy: default-src 'self'; script-src 'self' https:; style-src 'self' https:; font-src 'self' https: data:; img-src 'self' data: https: blob:; connect-src 'self' https:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
```

---

## 4. Observability & Logging Audit

- [x] **PII & Secret Redaction:** Recursive scrubbing of 18 sensitive key patterns (`password`, `secret`, `token`, `bearer`, `api_key`, `credentials`, `authorization`, `credit_card`).
- [x] **Structured JSON Logging:** Zero cleartext leakage to stdout.
- [x] **Health Probes:**
  - `GET /api/health` — Comprehensive component diagnostics.
  - `GET /api/health/live` — Liveness probe (HTTP 200).
  - `GET /api/health/ready` — Readiness probe verifying PostgreSQL pool.

---

## 5. Security & Configuration Sign-off

- **Audited By:** ZERIVEX Security Engineering  
- **Audit Result:** 100% Passed  
- **Approved for Deployment:** YES  
