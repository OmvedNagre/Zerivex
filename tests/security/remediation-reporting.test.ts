import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { query, closeDbPool } from '@/core/db/database';
import { REMEDIATION_CATALOG, getRemediationForRule } from '@/core/remediation/remediation-catalog';
import { verifyFindingFix } from '@/core/remediation/fix-verifier';
import { tlsCheck } from '@/core/scanner/checks/tls-check';
import {
  generateTechnicalJsonReport,
  generateExecutiveHtmlReport,
} from '@/core/reporting/report-generator';
import { registerTarget } from '@/core/targets/target-service';

describe('Remediation Engine, Fix Verification & Security Reporting (Phase 5)', () => {
  let orgAId: string;
  let orgBId: string;
  let projAId: string;
  let userAId: string;
  let userBId: string;
  let targetAId: string;
  let scanJobAId: string;
  let findingA1Id: string; // HTTP finding (ZX-TLS-001)

  beforeAll(async () => {
    // 1. Cleanup old test data
    await query("DELETE FROM targets WHERE hostname LIKE '%remediation-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-remediation-%'");
    await query("DELETE FROM users WHERE email LIKE '%@remediation-test.local'");

    // 2. Setup Org A and User A
    const userARes = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('alice@remediation-test.local', 'Alice Dev', 'USER') RETURNING id"
    );
    userAId = userARes.rows[0]!.id;

    const orgARes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id)
       VALUES ('Remediation Org A', 'test-org-remediation-a', $1) RETURNING id`,
      [userAId]
    );
    orgAId = orgARes.rows[0]!.id;

    const projARes = await query<{ id: string }>(
      "INSERT INTO projects (organization_id, name) VALUES ($1, 'Remediation Project A') RETURNING id",
      [orgAId]
    );
    projAId = projARes.rows[0]!.id;

    // 3. Setup Org B and User B (for IDOR tests)
    const userBRes = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('bob@remediation-test.local', 'Bob Attacker', 'USER') RETURNING id"
    );
    userBId = userBRes.rows[0]!.id;

    const orgBRes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id)
       VALUES ('Remediation Org B', 'test-org-remediation-b', $1) RETURNING id`,
      [userBId]
    );
    orgBId = orgBRes.rows[0]!.id;

    // 4. Register Target A with HTTP scheme
    const targetA = await registerTarget({
      organizationId: orgAId,
      projectId: projAId,
      targetUrl: 'http://app.remediation-test.local',
    });
    targetAId = targetA.id;

    // 5. Create Scan Job for Target A
    const scanRes = await query<{ id: string }>(
      `INSERT INTO scan_jobs (
        organization_id, target_id, requester_user_id, scan_mode, status, score, started_at, completed_at
      )
      VALUES ($1, $2, $3, 'PUBLIC_PASSIVE', 'COMPLETED', 70, NOW() - INTERVAL '10 seconds', NOW())
      RETURNING id`,
      [orgAId, targetAId, userAId]
    );
    scanJobAId = scanRes.rows[0]!.id;

    // 6. Create Findings on Target A
    // Finding 1: Unencrypted HTTP (ZX-TLS-001) - Will still trigger because targetUrl is http://
    const f1Res = await query<{ id: string }>(
      `INSERT INTO findings (
        scan_id, target_id, organization_id, rule_id, title,
        severity, confidence, category, resource_endpoint,
        evidence_json, status, cwe_id, owasp_category
      )
      VALUES ($1, $2, $3, 'ZX-TLS-001', 'Unencrypted HTTP Protocol', 'HIGH', 'CONFIRMED', 'Transport', 'http://app.remediation-test.local', '{"protocol": "http:"}'::jsonb, 'OPEN', 'CWE-319', 'A02:2021')
      RETURNING id`,
      [scanJobAId, targetAId, orgAId]
    );
    findingA1Id = f1Res.rows[0]!.id;

    // Finding 2: Missing CSP (ZX-HDR-001)
    await query(
      `INSERT INTO findings (
        scan_id, target_id, organization_id, rule_id, title,
        severity, confidence, category, resource_endpoint,
        evidence_json, status, cwe_id, owasp_category
      )
      VALUES ($1, $2, $3, 'ZX-HDR-001', 'Missing Content-Security-Policy', 'MEDIUM', 'CONFIRMED', 'Headers', 'http://app.remediation-test.local', '{"missingHeader": "Content-Security-Policy"}'::jsonb, 'OPEN', 'CWE-1021', 'A05:2021')`,
      [scanJobAId, targetAId, orgAId]
    );
  });

  afterAll(async () => {
    await query("DELETE FROM findings WHERE organization_id IN ($1, $2)", [orgAId, orgBId]);
    await query("DELETE FROM scan_jobs WHERE organization_id IN ($1, $2)", [orgAId, orgBId]);
    await query("DELETE FROM targets WHERE hostname LIKE '%remediation-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-remediation-%'");
    await query("DELETE FROM users WHERE email LIKE '%@remediation-test.local'");
    await closeDbPool();
  });

  describe('1. Remediation Knowledge Catalog Coverage', () => {
    it('indexes all 23 deterministic scan rules across TLS, Headers, CORS, Secrets, Cookies, and AI', () => {
      const expectedRules = [
        'ZX-TLS-001', 'ZX-TLS-002', 'ZX-TLS-003', 'ZX-TLS-004', 'ZX-TLS-005', 'ZX-TLS-006',
        'ZX-HDR-001', 'ZX-HDR-002', 'ZX-HDR-003', 'ZX-HDR-004', 'ZX-HDR-005', 'ZX-HDR-006',
        'ZX-CORS-001', 'ZX-CORS-002', 'ZX-CORS-003',
        'ZX-SEC-001', 'ZX-SEC-002', 'ZX-SEC-003',
        'ZX-CKI-001', 'ZX-CKI-002', 'ZX-CKI-003',
        'ZX-AI-001', 'ZX-AI-002', 'ZX-AI-003',
      ];

      for (const ruleId of expectedRules) {
        const item = REMEDIATION_CATALOG[ruleId];
        expect(item, `Rule ${ruleId} should be present in catalog`).toBeDefined();
        expect(item!.title).toBeTruthy();
        expect(item!.summary).toBeTruthy();
        expect(item!.impact).toBeTruthy();
        expect(item!.cwe).toBeTruthy();
        expect(item!.owasp).toBeTruthy();
        expect(item!.cliVerification).toBeTruthy();
      }
    });

    it('provides concrete unified diffs for Next.js, Express, or Nginx', () => {
      const csp = REMEDIATION_CATALOG['ZX-HDR-001'];
      expect(csp!.frameworks.nextjs?.diff).toContain('+');
      expect(csp!.frameworks.express?.diff).toContain('+');
      expect(csp!.frameworks.nginx?.diff).toContain('+');

      const hsts = REMEDIATION_CATALOG['ZX-TLS-005'];
      expect(hsts!.frameworks.nextjs?.diff).toContain('Strict-Transport-Security');
    });

    it('falls back safely to default guidance for unindexed rule IDs without error', () => {
      const fallback = getRemediationForRule('ZX-UNKNOWN-999');
      expect(fallback.ruleId).toBe('ZX-UNKNOWN-999');
      expect(fallback.title).toContain('ZX-UNKNOWN-999');
      expect(fallback.summary).toBeTruthy();
    });
  });

  describe('2. Fix Verification Protocol', () => {
    it('detects that finding is still active and transitions status to REOPENED if previously FIXED', async () => {
      // First, artificially mark as FIXED to test REOPENED transition
      await query("UPDATE findings SET status = 'FIXED' WHERE id = $1", [findingA1Id]);

      // Running verification on target (which is http://) will detect ZX-TLS-001 again
      const result = await verifyFindingFix({
        findingId: findingA1Id,
        organizationId: orgAId,
        userId: userAId,
      });

      expect(result.success).toBe(true);
      expect(result.fixed).toBe(false);
      expect(result.newStatus).toBe('REOPENED');
      expect(result.diagnostic).toContain('still active');

      // Verify DB record updated to REOPENED
      const dbRes = await query<{ status: string }>(
        'SELECT status FROM findings WHERE id = $1',
        [findingA1Id]
      );
      expect(dbRes.rows[0]?.status).toBe('REOPENED');

      // Verify audit log created
      const auditRes = await query<{ action: string }>(
        "SELECT action FROM audit_logs WHERE resource_id = $1 AND action = 'FINDING_FIX_FAILED'",
        [findingA1Id]
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);
    });

    it('successfully confirms resolution and transitions finding to FIXED when target is remediated', async () => {
      // Spy on tlsCheck.run to simulate that re-test found no more vulnerabilities
      const spy = vi.spyOn(tlsCheck, 'run').mockResolvedValue([]);

      const result = await verifyFindingFix({
        findingId: findingA1Id,
        organizationId: orgAId,
        userId: userAId,
      });

      expect(result.success).toBe(true);
      expect(result.fixed).toBe(true);
      expect(result.newStatus).toBe('FIXED');
      expect(result.diagnostic).toContain('Verification succeeded');

      // Verify DB record updated to FIXED
      const dbRes = await query<{ status: string }>(
        'SELECT status FROM findings WHERE id = $1',
        [findingA1Id]
      );
      expect(dbRes.rows[0]?.status).toBe('FIXED');

      // Verify audit log created
      const auditRes = await query<{ action: string }>(
        "SELECT action FROM audit_logs WHERE resource_id = $1 AND action = 'FINDING_VERIFIED_FIXED'",
        [findingA1Id]
      );
      expect(auditRes.rows.length).toBeGreaterThan(0);

      spy.mockRestore();
    });

    it('strictly prevents cross-tenant fix verification (IDOR Defense)', async () => {
      // Org B tries to verify fix on Org A's finding
      await expect(
        verifyFindingFix({
          findingId: findingA1Id,
          organizationId: orgBId,
          userId: userBId,
        })
      ).rejects.toThrow(/not found or unauthorized/);
    });
  });

  describe('3. Technical JSON Report Generation', () => {
    it('generates a complete, structured technical JSON report', async () => {
      const report = await generateTechnicalJsonReport(scanJobAId, orgAId);

      expect(report.schemaVersion).toBe('1.0.0');
      expect(report.reportType).toBe('ZERIVEX_TECHNICAL_SECURITY_REPORT');
      expect(report.organization).toEqual({
        id: orgAId,
        name: 'Remediation Org A',
      });

      const scan = report.scan as Record<string, unknown>;
      expect(scan.id).toBe(scanJobAId);
      expect(scan.score).toBe(70);

      const metrics = report.metrics as Record<string, number>;
      expect(metrics.total).toBe(2);

      const findings = report.findings as Array<Record<string, unknown>>;
      expect(findings.length).toBe(2);

      const firstFinding = findings[0]!;
      expect(firstFinding.ruleId).toBeDefined();
      expect(firstFinding.remediation).toBeDefined();
      const rem = firstFinding.remediation as Record<string, unknown>;
      expect(rem.summary).toBeTruthy();
      expect(rem.impact).toBeTruthy();
      expect(rem.cliVerification).toBeTruthy();
    });

    it('strictly enforces tenant isolation on JSON report generation', async () => {
      // Org B attempts to generate report for Org A's scan
      await expect(
        generateTechnicalJsonReport(scanJobAId, orgBId)
      ).rejects.toThrow(/not found or unauthorized/);
    });
  });

  describe('4. Executive HTML / PDF Report Generation', () => {
    it('generates an executive print-ready HTML document with branding and scorecard', async () => {
      const html = await generateExecutiveHtmlReport(scanJobAId, orgAId);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('ZERIVEX');
      expect(html).toContain('Verify. Detect. Defend.');
      expect(html).toContain('Security Assessment Report');
      expect(html).toContain('app.remediation-test.local');
      expect(html).toContain('Remediation Org A');
      expect(html).toContain('Security Score');
      expect(html).toContain('70');
      expect(html).toContain('Vulnerability Details & Remediation Guidance');
      expect(html).toContain('ZX-TLS-001');
      expect(html).toContain('ZX-HDR-001');
      expect(html).toContain('@media print');
      expect(html).toContain('window.print()');
    });

    it('escapes user-controlled inputs to prevent XSS in HTML report generation', async () => {
      // Inject a finding with potential XSS characters in title
      const xssFinding = await query<{ id: string }>(
        `INSERT INTO findings (
          scan_id, target_id, organization_id, rule_id, title,
          severity, confidence, category, resource_endpoint,
          evidence_json, status
        )
        VALUES ($1, $2, $3, 'ZX-HDR-003', '<script>alert("XSS")</script>', 'LOW', 'CONFIRMED', 'Headers', 'https://test.local', '{}'::jsonb, 'OPEN')
        RETURNING id`,
        [scanJobAId, targetAId, orgAId]
      );

      const html = await generateExecutiveHtmlReport(scanJobAId, orgAId);

      // Must be HTML entity escaped, never raw script tag
      expect(html).not.toContain('<script>alert("XSS")</script>');
      expect(html).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');

      await query('DELETE FROM findings WHERE id = $1', [xssFinding.rows[0]!.id]);
    });

    it('strictly enforces tenant isolation on executive HTML report generation', async () => {
      await expect(
        generateExecutiveHtmlReport(scanJobAId, orgBId)
      ).rejects.toThrow(/not found or unauthorized/);
    });
  });
});
