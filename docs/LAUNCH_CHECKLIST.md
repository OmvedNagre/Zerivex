# ZERIVEX Official Platform Launch Checklist & Runbook

> **Document Version:** 1.0 (Phase 15 Production Release)  
> **Platform Version:** 1.0.0-PROD  
> **Status:** READY FOR LAUNCH  
> **Brand Principle:** *"Security for software built with AI. Verify. Detect. Defend."*  

---

## 1. Pre-Flight Preparation (T-72 Hours)

| Item | Description | Verification Method | Owner | Status |
| :--- | :--- | :--- | :--- | :---: |
| **PF-01** | Verify all database schema migrations through `008_launch_readiness_audit.sql`. | Run `npm run db:migrate` against production Neon cluster. | DBA / Lead | DONE |
| **PF-02** | Execute complete dogfooding self-scan. Verify 100/100 score and 0 Critical/High findings. | Run `/api/launch-readiness/scan` via Launch Readiness Cockpit. | Security | DONE |
| **PF-03** | Run full regression test suite (275+ tests). | Run `npm test` across all 17 test suites. | QA / Lead | DONE |
| **PF-04** | Verify zero TypeScript errors. | Run `npm run typecheck` (`tsc --noEmit`). | Dev Lead | DONE |
| **PF-05** | Verify zero npm audit security vulnerabilities. | Run `npm audit`. | Security | DONE |
| **PF-06** | Audit production environment secrets and entropy ($\ge 32$ bytes). | Verify against `docs/security/PRODUCTION_CONFIG_CHECKLIST.md`. | DevOps | DONE |

---

## 2. Final Deployment Window (T-2 Hours to T-0)

### Step 1: Pre-Deployment Verification
```bash
# 1. Verify clean git working directory and commit hash
git status
git log -n 1 --oneline

# 2. Verify dependencies and audit status
npm audit --audit-level=high

# 3. Execute typecheck and complete test battery
npm run typecheck
npm test
```

### Step 2: Production Build & Asset Packaging
```bash
# Execute optimized production build
npm run build
```
Verify that all 48+ routes are successfully compiled, static pages prerendered, and Edge middleware compiled without warnings.

### Step 3: Database & Migration Verification
```bash
# Verify schema migration status
npm run db:migrate
```

### Step 4: Health Probe Verification
```bash
# Verify system health probes
curl -I https://zerivex.com/api/health
curl -I https://zerivex.com/api/health/live
curl -I https://zerivex.com/api/health/ready
```
Ensure all probes return HTTP 200 with `{ "status": "healthy", "database": "healthy" }`.

---

## 3. Post-Launch Verification (T+1 Hour)

- [ ] **Auth Flow:** Perform test OAuth login via Google and GitHub. Verify `__Host-zerivex_session` cookie is marked `HttpOnly`, `Secure`, and `SameSite=Lax`.
- [ ] **Scan Execution:** Create a test target and trigger passive and active scan verification. Ensure worker pool queues and executes checks within watchdog timeout limits.
- [ ] **Egress Firewall:** Verify that scanning `169.254.169.254` or `127.0.0.1` is immediately rejected with HTTP 400 and logged as a blocked SSRF attempt.
- [ ] **Audit Vault:** Verify that login and scan events are recorded in `audit_logs` with accurate actor attribution and IP address.
- [ ] **Rate Limiting:** Issue rapid test requests against `/api/auth/session` to confirm HTTP 429 response after 10 requests.
- [ ] **Security.txt:** Verify `https://zerivex.com/.well-known/security.txt` returns RFC 9116 compliant headers and plaintext.

---

## 4. Continuous Monitoring & Incident Response (T+24 Hours to T+7 Days)

- **Error Monitoring:** Sentry error rate threshold $< 0.1\%$ of total transactions.
- **Worker Pool Concurrency:** Maximum queue depth $< 20$ pending jobs.
- **Database Connection Pool:** Active connections $< 75\%$ of pool ceiling (15/20).
- **Latency SLO:** p95 API response time $< 250\text{ms}$ on dashboard queries.
- **Rollback Trigger:** If critical authentication, SSRF firewall bypass, or data leakage is detected, immediately trigger the Disaster Recovery Runbook (`docs/runbooks/DISASTER_RECOVERY.md`).

---

## 5. Production Launch Sign-off Certification

| Role | Sign-off Name | Certification Date | Status |
| :--- | :--- | :---: | :---: |
| **Platform Owner** | ZERIVEX Platform Owner | 2026-09-26 | **APPROVED** |
| **Security Engineering** | ZERIVEX Security Team | 2026-09-26 | **CERTIFIED** |
| **DevOps & Infrastructure** | Production Operations | 2026-09-26 | **VERIFIED** |
| **Overall Readiness** | **100% READY FOR LAUNCH** | **2026-09-26** | **GO FOR LAUNCH** |
