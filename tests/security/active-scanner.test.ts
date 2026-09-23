import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { query, closeDbPool } from '@/core/db/database';
import { createScanJob, ALL_SCAN_CHECKS } from '@/core/scanner/scan-runner';
import { registerTarget } from '@/core/targets/target-service';
import {
  ActiveRateLimiter,
  CircuitBreaker,
  CircuitBreakerOpenError,
  defaultRateLimiter,
  defaultCircuitBreaker,
} from '@/core/scanner/active-rate-limiter';
import { sqliCheck } from '@/core/scanner/checks/sqli-check';
import { xssCheck } from '@/core/scanner/checks/xss-check';
import { openRedirectCheck } from '@/core/scanner/checks/open-redirect-check';
import { pathTraversalCheck } from '@/core/scanner/checks/path-traversal-check';
import { getRemediationForRule } from '@/core/remediation/remediation-catalog';
import { verifyFindingFix } from '@/core/remediation/fix-verifier';
import * as safeHttpClient from '@/core/security/safe-http-client';

describe('Deep Web Application Scanning - Active Security Testing (Phase 6)', () => {
  let orgId: string;
  let projId: string;
  let userId: string;
  let unverifiedTargetId: string;
  let verifiedTargetId: string;

  beforeAll(async () => {
    // 1. Cleanup old test data
    await query("DELETE FROM targets WHERE hostname LIKE '%active-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-active-%'");
    await query("DELETE FROM users WHERE email LIKE '%@active-test.local'");

    // 2. Setup User, Org, Project
    const userRes = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('secops@active-test.local', 'SecOps Engineer', 'USER') RETURNING id"
    );
    userId = userRes.rows[0]!.id;

    const orgRes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id)
       VALUES ('Active Scan Org', 'test-org-active-a', $1) RETURNING id`,
      [userId]
    );
    orgId = orgRes.rows[0]!.id;

    const projRes = await query<{ id: string }>(
      "INSERT INTO projects (organization_id, name) VALUES ($1, 'Active Security Project') RETURNING id",
      [orgId]
    );
    projId = projRes.rows[0]!.id;

    // 3. Register Unverified Target
    const unverified = await registerTarget({
      organizationId: orgId,
      projectId: projId,
      targetUrl: 'https://unverified.active-test.local/app',
    });
    unverifiedTargetId = unverified.id;

    // 4. Register Verified Target
    const verified = await registerTarget({
      organizationId: orgId,
      projectId: projId,
      targetUrl: 'https://verified.active-test.local/app',
    });
    verifiedTargetId = verified.id;

    // Manually mark verified target as VERIFIED in DB for testing
    await query(
      "UPDATE targets SET verification_status = 'VERIFIED', verified_at = NOW() WHERE id = $1",
      [verifiedTargetId]
    );
  });

  afterAll(async () => {
    await query("DELETE FROM findings WHERE target_id IN ($1, $2)", [unverifiedTargetId, verifiedTargetId]);
    await query("DELETE FROM scan_jobs WHERE target_id IN ($1, $2)", [unverifiedTargetId, verifiedTargetId]);
    await query("DELETE FROM targets WHERE id IN ($1, $2)", [unverifiedTargetId, verifiedTargetId]);
    await query("DELETE FROM projects WHERE id = $1", [projId]);
    await query("DELETE FROM organizations WHERE id = $1", [orgId]);
    await query("DELETE FROM users WHERE id = $1", [userId]);
    await closeDbPool();
  });

  // =========================================================================
  // 1. FAIL-CLOSED ACTIVE SCAN AUTHORIZATION GATE (ADR-0008)
  // =========================================================================
  describe('Authorization Gate (ADR-0008)', () => {
    it('strictly forbids creating a VERIFIED_ACTIVE scan job on an unverified target', async () => {
      await expect(
        createScanJob({
          organizationId: orgId,
          targetId: unverifiedTargetId,
          requesterUserId: userId,
          scanMode: 'VERIFIED_ACTIVE',
        })
      ).rejects.toThrow(/Target ownership must be verified/i);
    });

    it('permits creating a VERIFIED_ACTIVE scan job on a verified target', async () => {
      const job = await createScanJob({
        organizationId: orgId,
        targetId: verifiedTargetId,
        requesterUserId: userId,
        scanMode: 'VERIFIED_ACTIVE',
      });

      expect(job).toBeDefined();
      expect(job.status).toBe('QUEUED');
      expect(job.scanMode).toBe('VERIFIED_ACTIVE');
    });

    it('all active checks refuse to probe in PUBLIC_PASSIVE mode', async () => {
      const passiveContext = {
        targetUrl: 'https://verified.active-test.local/search?q=test',
        hostname: 'verified.active-test.local',
        scanMode: 'PUBLIC_PASSIVE' as const,
        organizationId: orgId,
        targetId: verifiedTargetId,
      };

      const sqliFindings = await sqliCheck.run(passiveContext);
      const xssFindings = await xssCheck.run(passiveContext);
      const redirFindings = await openRedirectCheck.run(passiveContext);
      const travFindings = await pathTraversalCheck.run(passiveContext);

      expect(sqliFindings).toHaveLength(0);
      expect(xssFindings).toHaveLength(0);
      expect(redirFindings).toHaveLength(0);
      expect(travFindings).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. RATE LIMITER & CIRCUIT BREAKER ENGINE
  // =========================================================================
  describe('Active Rate Limiter & Circuit Breaker', () => {
    it('rate limiter throttles requests after burst capacity is exhausted', async () => {
      const limiter = new ActiveRateLimiter({ requestsPerSecond: 10, burstCapacity: 2 });
      const host = 'rate-test.local';

      const t0 = Date.now();
      await limiter.acquire(host); // token 1 (immediate)
      await limiter.acquire(host); // token 2 (immediate)
      const tBurst = Date.now();
      expect(tBurst - t0).toBeLessThan(50);

      // 3rd token must wait ~100ms
      await limiter.acquire(host);
      const tWait = Date.now();
      expect(tWait - tBurst).toBeGreaterThanOrEqual(70);
    });

    it('circuit breaker trips to OPEN and throws CircuitBreakerOpenError after consecutive failures', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
      const host = 'breaker-test.local';

      expect(cb.isOpen(host)).toBe(false);

      cb.recordFailure(host); // 1
      expect(cb.isOpen(host)).toBe(false);

      cb.recordFailure(host); // 2
      expect(cb.isOpen(host)).toBe(false);

      // 3rd failure trips the breaker
      expect(() => cb.recordFailure(host)).toThrow(CircuitBreakerOpenError);
      expect(cb.isOpen(host)).toBe(true);
      expect(cb.getFailureCount(host)).toBe(3);
    });

    it('circuit breaker resets failure counter on successful request', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      const host = 'success-test.local';

      cb.recordFailure(host);
      cb.recordFailure(host);
      expect(cb.getFailureCount(host)).toBe(2);

      cb.recordSuccess(host);
      expect(cb.getFailureCount(host)).toBe(0);
      expect(cb.isOpen(host)).toBe(false);
    });
  });

  // =========================================================================
  // 3. ACTIVE SQL INJECTION (SQLi) PROBING (ZX-ACT-SQLI-001)
  // =========================================================================
  describe('Active SQL Injection Prober (sqliCheck)', () => {
    beforeEach(() => {
      defaultRateLimiter.reset();
      defaultCircuitBreaker.reset();
    });

    it('detects error-based SQL injection with PostgreSQL syntax error signature', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const id = parsed.searchParams.get('id');

        if (id && id.includes("'")) {
          return {
            statusCode: 500,
            headers: { 'content-type': 'text/html' },
            body: 'ERROR: syntax error at or near "\'" at character 38. Query failed.',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }

        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: 1, name: 'Item 1' }),
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await sqliCheck.run({
        targetUrl: 'https://verified.active-test.local/items?id=1',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const finding = findings.find((f) => f.ruleId === 'ZX-ACT-SQLI-001');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('CRITICAL');
      expect(finding!.confidence).toBe('CONFIRMED');
      expect(finding!.cweId).toBe('CWE-89');
      expect(finding!.owaspCategory).toBe('A03:2021-Injection');
      expect(finding!.evidence.detectedRdbms).toBe('PostgreSQL');
    });

    it('detects boolean-differential SQL injection when error messages are suppressed', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const queryVal = parsed.searchParams.get('q');

        // Condition True returns full 200 list
        if (queryVal === '1' || (queryVal && queryVal.includes("'1'='1"))) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/html' },
            body: '<html><body><div>Product list: 100 items found with extensive catalog details and review metadata.</div></body></html>',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }

        // Condition False returns 404 or empty
        if (queryVal && queryVal.includes("'1'='2")) {
          return {
            statusCode: 404,
            headers: { 'content-type': 'text/html' },
            body: '<html><body>No items found.</body></html>',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }

        // Default harmless response
        return {
          statusCode: 200,
          headers: { 'content-type': 'text/html' },
          body: '<html><body>Generic content</body></html>',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await sqliCheck.run({
        targetUrl: 'https://verified.active-test.local/search?q=1',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();

      const diffFinding = findings.find((f) => f.ruleId === 'ZX-ACT-SQLI-001');
      expect(diffFinding).toBeDefined();
      expect(diffFinding!.title).toContain('Boolean-Differential SQL Injection');
      expect(diffFinding!.severity).toBe('CRITICAL');
    });

    it('does not flag clean endpoints with parameterized queries', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockResolvedValue({
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ results: [] }),
        finalUrl: 'https://verified.active-test.local/items?id=1',
        pinnedIp: '93.184.216.34',
      });

      const findings = await sqliCheck.run({
        targetUrl: 'https://verified.active-test.local/items?id=1',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();
      expect(findings).toHaveLength(0);
    });
  });

  // =========================================================================
  // 4. ACTIVE REFLECTED CROSS-SITE SCRIPTING (XSS) PROBING (ZX-ACT-XSS-001)
  // =========================================================================
  describe('Active Reflected XSS Prober (xssCheck)', () => {
    beforeAll(() => {
      defaultRateLimiter.reset();
      defaultCircuitBreaker.reset();
    });

    it('detects unescaped canary reflection in HTML responses', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const queryParam = parsed.searchParams.get('q') || '';

        // Intentionally reflect unescaped parameter into HTML
        return {
          statusCode: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: `<!DOCTYPE html><html><body><h1>Search Results for: ${queryParam}</h1></body></html>`,
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await xssCheck.run({
        targetUrl: 'https://verified.active-test.local/search?q=shoes',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const finding = findings.find((f) => f.ruleId === 'ZX-ACT-XSS-001');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('HIGH');
      expect(finding!.confidence).toBe('CONFIRMED');
      expect(finding!.cweId).toBe('CWE-79');
      expect(finding!.owaspCategory).toBe('A03:2021-Injection');
      expect(finding!.evidence.canaryToken).toBeDefined();
    });

    it('does not flag when input is safely HTML-entity encoded', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const queryParam = parsed.searchParams.get('q') || '';
        // Safely encoded HTML
        const safeEncoded = queryParam
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');

        return {
          statusCode: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
          body: `<!DOCTYPE html><html><body><h1>Search Results for: ${safeEncoded}</h1></body></html>`,
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await xssCheck.run({
        targetUrl: 'https://verified.active-test.local/search?q=shoes',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();
      expect(findings).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. ACTIVE OPEN REDIRECT PROBING (ZX-ACT-REDIR-001)
  // =========================================================================
  describe('Active Open Redirect Prober (openRedirectCheck)', () => {
    beforeEach(() => {
      defaultRateLimiter.reset();
      defaultCircuitBreaker.reset();
    });

    it('detects unvalidated external redirection in HTTP 302 Location header', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const redirectParam = parsed.searchParams.get('redirect');

        if (redirectParam && redirectParam.includes('example.com')) {
          return {
            statusCode: 302,
            headers: { location: redirectParam },
            body: '',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }

        return {
          statusCode: 200,
          headers: {},
          body: 'Login form',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await openRedirectCheck.run({
        targetUrl: 'https://verified.active-test.local/login?redirect=/dashboard',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const finding = findings.find((f) => f.ruleId === 'ZX-ACT-REDIR-001');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('MEDIUM');
      expect(finding!.confidence).toBe('CONFIRMED');
      expect(finding!.cweId).toBe('CWE-601');
      expect(finding!.evidence.locationHeader).toContain('example.com');
    });

    it('does not flag safe relative redirects to internal paths', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockResolvedValue({
        statusCode: 302,
        headers: { location: '/dashboard' },
        body: '',
        finalUrl: 'https://verified.active-test.local/login',
        pinnedIp: '93.184.216.34',
      });

      const findings = await openRedirectCheck.run({
        targetUrl: 'https://verified.active-test.local/login?redirect=/dashboard',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();
      expect(findings).toHaveLength(0);
    });
  });

  // =========================================================================
  // 6. ACTIVE PATH TRAVERSAL PROBING (ZX-ACT-TRAV-001)
  // =========================================================================
  describe('Active Path Traversal Prober (pathTraversalCheck)', () => {
    beforeEach(() => {
      defaultRateLimiter.reset();
      defaultCircuitBreaker.reset();
    });

    it('detects /etc/passwd content leakage on Unix systems', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const fileParam = parsed.searchParams.get('file');

        if (fileParam && fileParam.includes('etc/passwd')) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/plain' },
            body: 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }

        return {
          statusCode: 200,
          headers: {},
          body: 'Documentation contents',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await pathTraversalCheck.run({
        targetUrl: 'https://verified.active-test.local/docs?file=readme.txt',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();

      expect(findings.length).toBeGreaterThanOrEqual(1);
      const finding = findings.find((f) => f.ruleId === 'ZX-ACT-TRAV-001');
      expect(finding).toBeDefined();
      expect(finding!.severity).toBe('HIGH');
      expect(finding!.confidence).toBe('CONFIRMED');
      expect(finding!.cweId).toBe('CWE-22');
      expect(finding!.evidence.targetOS).toBe('Unix');
      expect(finding!.evidence.matchedSignature).toContain('root:x:0:0:');
    });

    it('detects win.ini configuration leakage on Windows systems', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockImplementation(async (url) => {
        const parsed = new URL(url);
        const fileParam = parsed.searchParams.get('file');

        if (fileParam && (fileParam.includes('windows\\win.ini') || fileParam.includes('win.ini'))) {
          return {
            statusCode: 200,
            headers: { 'content-type': 'text/plain' },
            body: '; for 16-bit app support\n[fonts]\nArial (TrueType)=ARIAL.TTF\n[extensions]',
            finalUrl: url,
            pinnedIp: '93.184.216.34',
          };
        }

        return {
          statusCode: 200,
          headers: {},
          body: 'Documentation contents',
          finalUrl: url,
          pinnedIp: '93.184.216.34',
        };
      });

      const findings = await pathTraversalCheck.run({
        targetUrl: 'https://verified.active-test.local/docs?file=readme.txt',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();

      const finding = findings.find((f) => f.ruleId === 'ZX-ACT-TRAV-001');
      expect(finding).toBeDefined();
      expect(finding!.evidence.targetOS).toBe('Windows');
    });

    it('does not flag sanitized file endpoints returning 404 or access denied', async () => {
      const fetchSpy = vi.spyOn(safeHttpClient, 'safeFetch').mockResolvedValue({
        statusCode: 403,
        headers: {},
        body: 'Access Denied: Path traversal detected.',
        finalUrl: 'https://verified.active-test.local/docs?file=../../../../etc/passwd',
        pinnedIp: '93.184.216.34',
      });

      const findings = await pathTraversalCheck.run({
        targetUrl: 'https://verified.active-test.local/docs?file=readme.txt',
        hostname: 'verified.active-test.local',
        scanMode: 'VERIFIED_ACTIVE',
        organizationId: orgId,
        targetId: verifiedTargetId,
      });

      fetchSpy.mockRestore();
      expect(findings).toHaveLength(0);
    });
  });

  // =========================================================================
  // 7. REMEDIATION CATALOG & FIX VERIFICATION INTEGRATION
  // =========================================================================
  describe('Remediation Catalog & Active Fix Verification', () => {
    it('contains comprehensive remediation guides with multi-framework diffs for all active rules', () => {
      const activeRules = [
        'ZX-ACT-SQLI-001',
        'ZX-ACT-XSS-001',
        'ZX-ACT-REDIR-001',
        'ZX-ACT-TRAV-001',
      ];

      for (const ruleId of activeRules) {
        const remediation = getRemediationForRule(ruleId);
        expect(remediation).toBeDefined();
        expect(remediation.ruleId).toBe(ruleId);
        expect(remediation.title).toBeTruthy();
        expect(remediation.summary).toBeTruthy();
        expect(remediation.impact).toBeTruthy();
        expect(remediation.cwe).toBeTruthy();
        expect(remediation.owasp).toBeTruthy();
        expect(remediation.cliVerification).toContain('curl');
        expect(remediation.frameworks.nextjs).toBeDefined();
        expect(remediation.frameworks.nextjs!.diff).toContain('+');
      }
    });

    it('verifies fix for active finding when target is verified and re-test passes', async () => {
      // 1. Insert scan job and finding
      const scanRes = await query<{ id: string }>(
        `INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status)
         VALUES ($1, $2, $3, 'VERIFIED_ACTIVE', 'COMPLETED') RETURNING id`,
        [orgId, verifiedTargetId, userId]
      );
      const scanId = scanRes.rows[0]!.id;

      const fRes = await query<{ id: string }>(
        `
        INSERT INTO findings (
          scan_id, organization_id, target_id, rule_id, title, severity, confidence, category, resource_endpoint, evidence_json, status, cwe_id, owasp_category
        )
        VALUES ($1, $2, $3, 'ZX-ACT-SQLI-001', 'SQL Injection in Parameter id', 'CRITICAL', 'CONFIRMED', 'Injection', 'https://verified.active-test.local/items?id=1', '{}', 'OPEN', 'CWE-89', 'A03:2021-Injection')
        RETURNING id
        `,
        [scanId, orgId, verifiedTargetId]
      );
      const findingId = fRes.rows[0]!.id;

      // 2. Mock sqliCheck to return 0 findings (remediated)
      const sqliSpy = vi.spyOn(sqliCheck, 'run').mockResolvedValue([]);

      const result = await verifyFindingFix({
        findingId,
        organizationId: orgId,
        userId,
      });

      sqliSpy.mockRestore();

      expect(result.success).toBe(true);
      expect(result.fixed).toBe(true);
      expect(result.newStatus).toBe('FIXED');

      // Verify status in DB
      const checkRes = await query<{ status: string }>(
        'SELECT status FROM findings WHERE id = $1',
        [findingId]
      );
      expect(checkRes.rows[0]!.status).toBe('FIXED');

      // Cleanup
      await query('DELETE FROM findings WHERE id = $1', [findingId]);
      await query('DELETE FROM scan_jobs WHERE id = $1', [scanId]);
    });

    it('all active checks are included in ALL_SCAN_CHECKS', () => {
      const checkIds = ALL_SCAN_CHECKS.map((c) => c.id);
      expect(checkIds).toContain('check-sqli');
      expect(checkIds).toContain('check-xss');
      expect(checkIds).toContain('check-open-redirect');
      expect(checkIds).toContain('check-path-traversal');
    });
  });
});
