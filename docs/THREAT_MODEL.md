# Zerivex Threat Model

> **Scope:** Self-Defense & Infrastructure Threat Model for the Zerivex Platform

---

## 1. Threat Actors
1. **External Anonymous Attacker:** Probes public endpoints, attempts scanner SSRF proxying, attempts credential stuffing.
2. **Malicious Authenticated User:** Attempts privilege escalation, tenant boundary escape (IDOR/BOLA), or subscription bypass.
3. **Malicious Scan Target:** Hostile web server returning malicious redirects, slow responses (Slowloris), gigantic payloads, or attempting DNS rebinding.
4. **Compromised Customer Account:** Attempting to weaponize verified scan capabilities against unauthorized targets.

---

## 2. Threat & Mitigation Matrix

| Threat ID | Threat Description | Attacker Objective | Zerivex Mitigation |
| :--- | :--- | :--- | :--- |
| **THREAT-01** | **Scanner SSRF & Metadata Theft** | Submit target `http://169.254.169.254` to steal cloud IAM credentials. | `SafeHttpClient` pre-resolves DNS, blocks link-local/cloud metadata, pins IP at socket level, and re-validates all redirects. |
| **THREAT-02** | **DNS Rebinding TOCTOU** | Domain resolves to public IP on check, then rebinds to `127.0.0.1` on socket connect. | Socket IP pinning: TCP connect is made directly to the validated IP address, completely eliminating secondary DNS lookups. |
| **THREAT-03** | **IDOR / BOLA Cross-Tenant Access** | Change URL from `/api/v1/scans/orgA-scan` to `/api/v1/scans/orgB-scan`. | Authorization middleware enforces `WHERE id = :id AND organization_id = :sessionOrgId` on every resource query. |
| **THREAT-04** | **Privilege Escalation** | Normal user posts `{ "role": "OWNER" }` in profile or role update endpoint. | Role changes require `users:manage` permission, validated server-side. Owner bootstrap is locked permanently after initialization. |
| **THREAT-05** | **Sole Owner Self-Destruction** | Owner accidentally demotes or deletes their own account, locking out the platform. | Server guards prohibit deleting or demoting the last remaining `OWNER`. |
| **THREAT-06** | **Session Hijacking** | XSS script attempts to steal authentication session tokens. | Tokens are stored in `HttpOnly; Secure; SameSite=Lax` cookies inaccessible to JavaScript. DB stores only SHA-256 hashes. |
| **THREAT-07** | **Scanner Resource Exhaustion** | Target returns infinite stream or 100GB body. | Hard response size limit of 10MB; 15-second total timeout enforced per request. |
