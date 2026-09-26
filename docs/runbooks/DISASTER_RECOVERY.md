# Disaster Recovery & High Availability Runbook

> **Platform:** ZERIVEX  
> **Classification:** Confidential — Operations & Incident Response  
> **Status:** Active (Phase 14 Production Hardening)  
> **Target RPO (Recovery Point Objective):** < 1 Hour  
> **Target RTO (Recovery Time Objective):** < 30 Minutes  

---

## 1. Architecture Resilience Overview

Zerivex utilizes a decoupled, high-availability serverless and containerized architecture designed to prevent catastrophic data loss and minimize downtime:
- **Database Layer:** Neon Serverless PostgreSQL with automatic multi-AZ redundancy, WAL archiving, and 30-day continuous Point-in-Time Recovery (PITR).
- **Application & Worker Layer:** Stateless Next.js App Router instances with an isolated worker execution pool with process sandboxing, execution timeouts, and circuit breakers.
- **Edge Layer:** Reverse proxy WAF (Cloudflare) with DDoS shielding, tiered rate limiting, and IP spoofing defenses.

---

## 2. Incident Classification & Severity Levels

| Severity | Definition | Target Response | Target Resolution |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core service down; database unreachable; active secret compromise. | < 5 minutes | < 30 minutes |
| **SEV-2 (Major)** | Degradation of scanning worker capacity; third-party webhook failure. | < 15 minutes | < 2 hours |
| **SEV-3 (Minor)** | Minor UI reporting glitches; individual target scan timeout. | < 1 hour | < 1 business day |

---

## 3. Disaster Recovery Procedures

### Scenario A: Database Unavailability or Network Partition

**Symptoms:** `/api/health` returns status `DOWN`, `/api/health/ready` returns 503, application logs show connection pool timeout errors.

**Action Steps:**
1. **Verify Neon Status:** Check [Neon Status Page](https://status.neon.tech) for active platform disruptions.
2. **Execute Diagnostic Ping:**
   ```bash
   node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.DATABASE_URL }); c.connect().then(() => { console.log('Connected'); c.end(); }).catch(e => console.error(e));"
   ```
3. **Failover to Read-Replica or Secondary Neon Branch:**
   - In Neon Console, create a new branch from the latest point in time:
     ```bash
     neonctl branches create --project-id <PROJECT_ID> --name recovery-branch
     ```
   - Update production environment variable `DATABASE_URL` with the recovery branch connection string.
   - Restart web application instances to refresh connection pool.
4. **Verify Health:** Confirm `/api/health/ready` returns HTTP 200 `{ "ready": true }`.

---

### Scenario B: Accidental Data Deletion or Corruption (PITR Protocol)

**Symptoms:** Catastrophic accidental table drop, malicious record tampering, or corrupted data state.

**Action Steps:**
1. **Identify Corruption Timestamp ($T_{corrupt}$):**
   - Inspect the tamper-evident cryptographic audit trail in the `audit_logs` table to find the exact timestamp of the destructive mutation.
2. **Restore via Point-in-Time Recovery (PITR):**
   - Point Neon branch restoration to $T_{corrupt} - 60 \text{ seconds}$:
     ```bash
     neonctl branches create \
       --project-id <PROJECT_ID> \
       --name pitr-restore-$(date +%s) \
       --parent <PARENT_BRANCH> \
       --timestamp "2026-09-26T01:30:00Z"
     ```
3. **Verify Integrity of Restored Branch:**
   - Execute test query verifying tenant targets and findings exist:
     ```sql
     SELECT COUNT(*) FROM targets;
     SELECT COUNT(*) FROM findings;
     ```
4. **Promote Restored Branch to Primary:**
   - Update `DATABASE_URL` in environment secrets.
   - Trigger deployment or rolling restart of all container instances.

---

### Scenario C: Compromise of Production Secrets (Emergency Rotation)

**Symptoms:** Leakage of `SESSION_SECRET`, `STRIPE_SECRET_KEY`, or `DATABASE_URL` into public source control or third-party logs.

**Action Steps:**
1. **Rotate Session Secret (`SESSION_SECRET`):**
   - Generate a new 256-bit cryptographic key:
     ```bash
     openssl rand -base64 32
     ```
   - Update `SESSION_SECRET` in production secrets.
   - Trigger immediate mass session invalidation:
     ```sql
     UPDATE sessions SET is_revoked = true, revoked_at = NOW();
     ```
   - All active users will be prompted to re-authenticate with clean tokens.
2. **Rotate Database Password (`DATABASE_URL`):**
   - Reset database role password in Neon Console.
   - Update `DATABASE_URL` secret and restart containers.
3. **Rotate Stripe Webhook & Secret Keys:**
   - In Stripe Dashboard, roll `STRIPE_SECRET_KEY` and update `STRIPE_WEBHOOK_SECRET`.
   - Update environment secrets.

---

### Scenario D: Worker Pool Exhaustion or Cascade Failure

**Symptoms:** Worker pool metrics show `activeWorkers == maxConcurrency` for sustained periods; scan queues growing; circuit breakers opening.

**Action Steps:**
1. **Inspect Worker Pool Metrics:**
   - Query `/api/health` and inspect the `workers` object:
     ```bash
     curl -s https://app.zerivex.com/api/health | jq .workers
     ```
2. **Drain and Reset Stalled Jobs:**
   - Check if a specific target network is timing out repeatedly, tripping domain circuit breakers.
   - If circuit breaker is open, the worker pool automatically enters a 60-second cooldown to protect outbound network bandwidth.
3. **Graceful Worker Pool Restart:**
   - If worker threads are deadlocked, restart container instances; the worker pool executes `drainAndStop(10000)` on `SIGTERM` to safely release database connections.

---

## 4. Periodic Backup Verification & Drills

1. **Weekly Automated Health Check:** The `/api/health` endpoint is polled by external uptime monitors (Datadog, BetterStack, or Pingdom) every 60 seconds.
2. **Quarterly DR Simulation Drill:**
   - Create a staging branch from production Neon WAL archive using PITR.
   - Verify that test scans run and findings triage operates normally against the restored database.
   - Document recovery time and verify RTO remains < 30 minutes.
