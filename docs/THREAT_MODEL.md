# Zerivex Threat Model & Traceability Matrix

> **Scope:** Self-Defense & Infrastructure Threat Model for the Zerivex Platform  
> **Methodology:** Threat $\rightarrow$ Security Control $\rightarrow$ Implementation $\rightarrow$ Test $\rightarrow$ Phase  

---

## 1. Threat Actors
1. **External Anonymous Attacker:** Probes public endpoints, attempts scanner SSRF proxying, attempts credential stuffing.
2. **Malicious Authenticated User:** Attempts privilege escalation, tenant boundary escape (IDOR/BOLA), or subscription bypass.
3. **Malicious Scan Target:** Hostile web server returning malicious redirects, slow responses (Slowloris), gigantic payloads, or attempting DNS rebinding.
4. **Compromised Customer Account:** Attempting to weaponize verified scan capabilities against unauthorized targets.

---

## 2. Threat Model Traceability Matrix

| Threat ID & Description | Security Control | Implementation Module | Automated Test File | Phase |
| :--- | :--- | :--- | :--- | :--- |
| **THREAT-01: Scanner SSRF & Cloud Metadata Theft** (Target URL points to `169.254.169.254`, `127.0.0.1`, RFC1918) | Pre-flight DNS resolution + CIDR range blocklist + IP pinning on raw socket | `src/scanner/network/safe-http-client.ts` | `tests/security/ssrf.test.ts` | **Phase 4** |
| **THREAT-02: DNS Rebinding TOCTOU** (Public IP changes to `127.0.0.1` between check and HTTP request) | Raw socket connection made directly to pre-validated IP; Host header injected manually | `src/scanner/network/safe-http-client.ts` | `tests/security/ssrf.test.ts` | **Phase 4** |
| **THREAT-03: Redirect-based SSRF** (Target URL redirects 302 to internal network address) | Manual redirect interception; each 3xx Location header re-evaluated through full SSRF pipeline | `src/scanner/network/safe-http-client.ts` | `tests/security/ssrf.test.ts` | **Phase 4** |
| **THREAT-04: IDOR / BOLA Cross-Tenant Access** (User A attempts to read/modify User B's scans, targets, or evidence) | Strict tenant-scoped database queries (`WHERE id = :id AND organization_id = :orgId`) | `src/core/rbac/authorization-guard.ts` | `tests/security/idor-tenant.test.ts` | **Phase 1, 3** |
| **THREAT-05: Privilege Escalation** (Normal user attempts to assign `OWNER` or `ADMIN` role via request body) | Zod schema input stripping + centralized server-side RBAC permission guard | `src/core/rbac/permissions.ts` | `tests/security/auth-rbac.test.ts` | **Phase 2** |
| **THREAT-06: Sole Owner Self-Destruction** (Owner accidentally deletes or demotes sole platform owner account) | Server-side guard preventing deletion or demotion of the last remaining `OWNER` | `src/core/rbac/authorization-guard.ts` | `tests/security/auth-rbac.test.ts` | **Phase 2** |
| **THREAT-07: Owner Bootstrap Replay / Race** (Attacker attempts to trigger bootstrap after deployment) | Transactional DB check on `platform_bootstraps` table; permanent lock after first run | `src/core/auth/bootstrap-service.ts` | `tests/security/auth-rbac.test.ts` | **Phase 2** |
| **THREAT-08: Session Hijacking via XSS** (Malicious script attempts to read authentication tokens) | Tokens stored in `__Host-zerivex_session` (`HttpOnly; Secure; SameSite=Lax; Path=/`); DB stores only SHA-256 hash | `src/core/auth/session-service.ts` | `tests/security/session.test.ts` | **Phase 2** |
| **THREAT-09: CSRF on Cookie Requests** (State-changing API invoked cross-origin using session cookie) | SameSite=Lax cookie + custom header check (`X-Requested-With` / CSRF token validation) | `src/core/auth/csrf-guard.ts` | `tests/security/session.test.ts` | **Phase 2** |
| **THREAT-10: Secret Leakage in Evidence** (Scanner stores Authorization headers or cookies in finding database) | Multi-stage evidence redaction pipeline scrubbing tokens, cookies, auth headers, and keys | `src/scanner/core/evidence-redactor.ts` | `tests/security/redaction.test.ts` | **Phase 4** |
| **THREAT-11: Scanner Resource Exhaustion / Slowloris** (Target streams infinite payload or hangs connection) | Hard 15s connection/read timeout + 10MB response body cap enforced via streaming byte counter | `src/scanner/network/safe-http-client.ts` | `tests/security/ssrf.test.ts` | **Phase 4** |
| **THREAT-12: Unauthenticated Active Scanning Abuse** (Malicious actor uses Zerivex as attack proxy) | Dual-mode scanning: unverified targets permit passive inspection only; active scans require verified ownership | `src/scanner/verification/domain-verifier.ts` | `tests/security/verification.test.ts` | **Phase 3, 6** |
| **THREAT-13: Silent Audit Tampering** (Compromised account deletes audit records to cover tracks) | `audit_logs` table is strictly append-only; application database user has no `UPDATE`/`DELETE` grants | `src/core/audit/audit-service.ts` | `tests/security/audit.test.ts` | **Phase 1** |
| **THREAT-14: Fail-Open Configuration** (Application boots with missing security secrets, e.g. empty SESSION_SECRET) | Runtime configuration validation on startup; process fails closed immediately if secrets are invalid | `src/core/config/env-validator.ts` | `tests/security/config.test.ts` | **Phase 1** |
