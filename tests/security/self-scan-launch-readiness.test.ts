import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { query, closeDbPool } from '@/core/db/database';
import { createSession, SESSION_COOKIE_NAME } from '@/core/auth/session-service';
import {
  runPlatformSelfScan,
  calculateSelfScanScore,
  generateCertificationHash,
  getLatestSelfScanReport,
} from '@/core/audit/self-scan-engine';
import { evaluateLaunchReadiness } from '@/core/audit/launch-readiness';
import { GET as getLaunchReadiness } from '@/app/api/launch-readiness/route';
import { POST as postLaunchSelfScan } from '@/app/api/launch-readiness/scan/route';
import { GET as getSecurityTxt } from '@/app/.well-known/security.txt/route';
import { RawFinding } from '@/core/scanner/checks/types';

describe('Phase 15: Self-Scan & Launch Readiness Certification', () => {
  let ownerUserId: string;
  let ownerSessionToken: string;
  let regularUserId: string;
  let regularSessionToken: string;
  const testSuffix = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Create test owner user
    const ownerRes = await query<{ id: string }>(
      `
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'Launch Test Owner', 'OWNER')
      RETURNING id
      `,
      [`launch-owner-${testSuffix}@zerivex.local`]
    );
    ownerUserId = ownerRes.rows[0]!.id;

    const ownerSession = await createSession({
      userId: ownerUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'Zerivex-Phase15-Test',
    });
    ownerSessionToken = ownerSession.rawToken;

    // 2. Create test regular user
    const regularRes = await query<{ id: string }>(
      `
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'Launch Regular User', 'USER')
      RETURNING id
      `,
      [`launch-regular-${testSuffix}@zerivex.local`]
    );
    regularUserId = regularRes.rows[0]!.id;

    const regularSession = await createSession({
      userId: regularUserId,
      ipAddress: '127.0.0.1',
      userAgent: 'Zerivex-Phase15-Test',
    });
    regularSessionToken = regularSession.rawToken;
  });

  afterAll(async () => {
    try {
      await query('DELETE FROM sessions WHERE user_id IN ($1, $2)', [ownerUserId, regularUserId]);
      await query('DELETE FROM audit_logs WHERE actor_user_id IN ($1, $2)', [ownerUserId, regularUserId]);
      await query('DELETE FROM launch_readiness_scans WHERE triggered_by_user_id IN ($1, $2)', [ownerUserId, regularUserId]);
      await query('DELETE FROM users WHERE id IN ($1, $2)', [ownerUserId, regularUserId]);
      await closeDbPool();
    } catch {
      // Cleanup best effort
    }
  });

  // =========================================================================
  // 1. ZERIVEX Self-Scan Dogfooding Engine
  // =========================================================================
  describe('1. Platform Self-Scan Dogfooding Engine', () => {
    it('executes full self-scan and asserts 100/100 Security Score with 0 findings', async () => {
      const report = await runPlatformSelfScan({
        triggeredByUserId: ownerUserId,
      });

      expect(report).toBeDefined();
      expect(report.id).toMatch(/^self-scan-/);
      expect(report.target).toBeDefined();
      expect(report.durationMs).toBeGreaterThanOrEqual(0);

      // Strict acceptance assertions: 100/100 score, Grade A+, 0 Critical/High/Medium findings
      expect(report.score).toBe(100);
      expect(report.grade).toBe('A+');
      expect(report.status).toBe('PASSED');

      expect(report.summary.criticalFindings).toBe(0);
      expect(report.summary.highFindings).toBe(0);
      expect(report.summary.mediumFindings).toBe(0);
      expect(report.summary.lowFindings).toBe(0);
      expect(report.findings.length).toBe(0);

      // Verify that all 15 check modules executed and passed
      expect(report.summary.totalChecks).toBe(15);
      expect(report.summary.passedChecks).toBe(15);
      expect(report.summary.failedChecks).toBe(0);

      for (const chk of report.checkResults) {
        expect(chk.status).toBe('PASSED');
        expect(chk.findingsCount).toBe(0);
      }

      // Verify Production Certification signature
      expect(report.certification.status).toBe('CERTIFIED_PRODUCTION_READY');
      expect(report.certification.certificationHash).toHaveLength(64); // Valid SHA-256 hex
      expect(report.certification.certifiedBy).toContain('ZERIVEX Autonomous Self-Scan');
    });

    it('correctly calculates deterministic penalty deductions and grade brackets', () => {
      // Baseline clean: 100
      expect(calculateSelfScanScore([])).toBe(100);

      // Single Critical (-25) -> 75
      const criticalFinding: RawFinding = {
        ruleId: 'ZX-TEST-CRIT',
        title: 'Critical Test Flaw',
        severity: 'CRITICAL',
        confidence: 'CONFIRMED',
        category: 'Test',
        resourceEndpoint: 'https://test.local',
        evidence: {},
      };
      expect(calculateSelfScanScore([criticalFinding])).toBe(75);

      // Single High (-15) -> 85
      const highFinding: RawFinding = {
        ...criticalFinding,
        severity: 'HIGH',
      };
      expect(calculateSelfScanScore([highFinding])).toBe(85);

      // Single Medium (-5) -> 95
      const medFinding: RawFinding = {
        ...criticalFinding,
        severity: 'MEDIUM',
      };
      expect(calculateSelfScanScore([medFinding])).toBe(95);

      // Single Low (-2) -> 98
      const lowFinding: RawFinding = {
        ...criticalFinding,
        severity: 'LOW',
      };
      expect(calculateSelfScanScore([lowFinding])).toBe(98);

      // Clamping to 0: deductions exceeding 100
      const manyCrit = Array.from({ length: 5 }, () => criticalFinding);
      expect(calculateSelfScanScore(manyCrit)).toBe(0);
    });

    it('generates consistent tamper-evident SHA-256 certification hashes', () => {
      const hash1 = generateCertificationHash('scan-123', '2026-09-26T00:00:00.000Z', 100, 0);
      const hash2 = generateCertificationHash('scan-123', '2026-09-26T00:00:00.000Z', 100, 0);
      const hash3 = generateCertificationHash('scan-999', '2026-09-26T00:00:00.000Z', 100, 0);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('retrieves the latest recorded self-scan report from PostgreSQL', async () => {
      const latest = await getLatestSelfScanReport();
      expect(latest).not.toBeNull();
      if (latest) {
        expect(latest.score).toBe(100);
        expect(latest.grade).toBe('A+');
        expect(latest.certification.status).toBe('CERTIFIED_PRODUCTION_READY');
      }
    });
  });

  // =========================================================================
  // 2. Subsystem Launch Readiness Evaluator
  // =========================================================================
  describe('2. Subsystem Launch Readiness Evaluator', () => {
    it('evaluates all 10 core subsystems with READY status and 100% readiness score', async () => {
      const report = await evaluateLaunchReadiness();

      expect(report).toBeDefined();
      expect(report.evaluatedAt).toBeDefined();

      // Overall status assertions
      expect(report.readinessScore).toBe(100);
      expect(report.overallStatus).toBe('READY_FOR_LAUNCH');

      // Subsystem breakdown assertions
      expect(report.subsystems.length).toBe(10);
      expect(report.summary.totalSubsystems).toBe(10);
      expect(report.summary.readySubsystems).toBe(10);
      expect(report.summary.notReadySubsystems).toBe(0);
      expect(report.summary.degradedSubsystems).toBe(0);

      // Verify specific required subsystem IDs
      const requiredSubsystemIds = [
        'subsystem-auth-rbac',
        'subsystem-tenant-isolation',
        'subsystem-target-ssrf',
        'subsystem-scanner-engine',
        'subsystem-remediation-reports',
        'subsystem-attack-surface',
        'subsystem-monitoring-alerts',
        'subsystem-cicd-quality-gates',
        'subsystem-billing-teams',
        'subsystem-production-hardening',
      ];

      for (const reqId of requiredSubsystemIds) {
        const sub = report.subsystems.find((s) => s.id === reqId);
        expect(sub).toBeDefined();
        expect(sub!.status).toBe('READY');
        expect(sub!.name).toBeTruthy();
        expect(sub!.details).toBeTruthy();
      }

      // Verify pre-launch checklist is populated
      expect(report.checklist.length).toBeGreaterThanOrEqual(9);
      const criticalItems = report.checklist.filter((c) => c.critical);
      expect(criticalItems.length).toBeGreaterThanOrEqual(8);
    });
  });

  // =========================================================================
  // 3. Launch Readiness REST APIs
  // =========================================================================
  describe('3. Launch Readiness REST API Endpoints', () => {
    it('GET /api/launch-readiness rejects unauthenticated requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/launch-readiness');
      const res = await getLaunchReadiness(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    });

    it('GET /api/launch-readiness returns readiness report for authenticated user', async () => {
      const req = new NextRequest('http://localhost:3000/api/launch-readiness', {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${regularSessionToken}`,
        },
      });

      const res = await getLaunchReadiness(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.readinessScore).toBe(100);
      expect(json.data.subsystems.length).toBe(10);
    });

    it('POST /api/launch-readiness/scan rejects unauthenticated requests with 401', async () => {
      const req = new NextRequest('http://localhost:3000/api/launch-readiness/scan', {
        method: 'POST',
      });
      const res = await postLaunchSelfScan(req);
      expect(res.status).toBe(401);
    });

    it('POST /api/launch-readiness/scan rejects non-admin users with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/launch-readiness/scan', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${regularSessionToken}`,
        },
      });

      const res = await postLaunchSelfScan(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain('Platform Owners or Administrators');
    });

    it('POST /api/launch-readiness/scan triggers self-scan for Platform Owner and returns certified report', async () => {
      const req = new NextRequest('http://localhost:3000/api/launch-readiness/scan', {
        method: 'POST',
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${ownerSessionToken}`,
        },
      });

      const res = await postLaunchSelfScan(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.score).toBe(100);
      expect(json.data.status).toBe('PASSED');
      expect(json.data.certification.status).toBe('CERTIFIED_PRODUCTION_READY');

      // Assert that SELF_SCAN_TRIGGERED audit event was logged
      const auditRes = await query<{ action: string }>(
        `
        SELECT action FROM audit_logs
        WHERE actor_user_id = $1 AND action = 'SELF_SCAN_TRIGGERED'
        ORDER BY created_at DESC
        LIMIT 1
        `,
        [ownerUserId]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0]?.action).toBe('SELF_SCAN_TRIGGERED');
    });
  });

  // =========================================================================
  // 4. RFC 9116 security.txt Endpoint
  // =========================================================================
  describe('4. RFC 9116 security.txt Endpoint', () => {
    it('GET /.well-known/security.txt returns compliant security disclosure policy', async () => {
      const res = await getSecurityTxt();
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/plain');

      const body = await res.text();
      expect(body).toContain('Contact: mailto:security@zerivex.com');
      expect(body).toContain('Expires:');
      expect(body).toContain('Canonical: https://zerivex.com/.well-known/security.txt');
      expect(body).toContain('Policy: https://zerivex.com/security');

      // Verify that Expires date is in the future
      const match = body.match(/Expires:\s+([^\n\r]+)/);
      expect(match).not.toBeNull();
      const expiresDate = new Date(match![1]!.trim());
      expect(expiresDate.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
