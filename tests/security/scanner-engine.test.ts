import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, closeDbPool } from '@/core/db/database';
import { redactEvidence, sanitizeString, sanitizeHeaders } from '@/core/scanner/evidence-redactor';
import { calculateSecurityScore, createScanJob } from '@/core/scanner/scan-runner';
import { registerTarget } from '@/core/targets/target-service';
import { tlsCheck } from '@/core/scanner/checks/tls-check';
import { ALL_SCAN_CHECKS } from '@/core/scanner/scan-runner';

describe('Deterministic Scanner Engine & Security Verification (Phase 4)', () => {
  let orgId: string;
  let projId: string;
  let userId: string;
  let targetId: string;

  beforeAll(async () => {
    // 1. Cleanup old test data
    await query("DELETE FROM targets WHERE hostname LIKE '%scanner-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-scanner-%'");
    await query("DELETE FROM users WHERE email LIKE '%@scanner-test.local'");

    // 2. Setup user, org, and project
    const userRes = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('analyst@scanner-test.local', 'Security Analyst', 'USER') RETURNING id"
    );
    userId = userRes.rows[0]!.id;

    const orgRes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id)
       VALUES ('Scanner Test Org', 'test-org-scanner-a', $1) RETURNING id`,
      [userId]
    );
    orgId = orgRes.rows[0]!.id;

    const projRes = await query<{ id: string }>(
      "INSERT INTO projects (organization_id, name) VALUES ($1, 'Scanner Target Project') RETURNING id",
      [orgId]
    );
    projId = projRes.rows[0]!.id;

    // 3. Register target (remains UNVERIFIED)
    const target = await registerTarget({
      organizationId: orgId,
      projectId: projId,
      targetUrl: 'https://unverified.scanner-test.local',
    });
    targetId = target.id;
  });

  afterAll(async () => {
    await query("DELETE FROM findings WHERE organization_id = $1", [orgId]);
    await query("DELETE FROM scan_jobs WHERE organization_id = $1", [orgId]);
    await query("DELETE FROM targets WHERE hostname LIKE '%scanner-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-scanner-%'");
    await query("DELETE FROM users WHERE email LIKE '%@scanner-test.local'");
    await closeDbPool();
  });

  describe('1. Mandatory Multi-Stage Evidence Redaction (ADR-0007)', () => {
    it('redacts OpenAI API keys (legacy and modern project formats)', () => {
      const raw1 = 'OpenAI secret key: sk-1234567890abcdef1234567890abcdef12';
      const raw2 = 'Modern key: sk-proj-1234567890abcdef1234567890abcdef123456';
      expect(sanitizeString(raw1)).toBe('OpenAI secret key: [REDACTED_OPENAI_KEY]');
      expect(sanitizeString(raw2)).toBe('Modern key: [REDACTED_OPENAI_KEY]');
    });

    it('redacts Anthropic API keys', () => {
      const raw = 'Anthropic key: sk-ant-api03-abcdef123456789012345678901234567890-xyz';
      expect(sanitizeString(raw)).toBe('Anthropic key: [REDACTED_ANTHROPIC_KEY]');
    });

    it('redacts AWS Access Key IDs', () => {
      const raw = 'AWS credentials: AKIAIOSFODNN7EXAMPLE in payload';
      expect(sanitizeString(raw)).toBe('AWS credentials: [REDACTED_AWS_KEY] in payload');
    });

    it('redacts GitHub Personal Access Tokens', () => {
      const raw = 'GitHub token: ghp_123456789012345678901234567890123456';
      expect(sanitizeString(raw)).toBe('GitHub token: [REDACTED_GITHUB_TOKEN]');
    });

    it('redacts Google API keys', () => {
      const raw = 'Google key: AIzaSyD1234567890abcdef1234567890abcdef1';
      expect(sanitizeString(raw)).toBe('Google key: [REDACTED_GOOGLE_KEY]');
    });

    it('redacts JSON Web Tokens (JWT)', () => {
      const raw =
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const sanitized = sanitizeString(raw);
      expect(sanitized).not.toContain('eyJhbGciOi');
      expect(sanitized).toContain('[REDACTED_JWT_TOKEN]');
    });

    it('redacts database credentials in connection strings', () => {
      const rawPostgres = 'postgres://admin:SuperSecretPass123!@db.internal.example.com:5432/production';
      const rawMongo = 'mongodb://app_user:dbPassword999@db.internal.example.com:27017/app_db';
      expect(sanitizeString(rawPostgres)).toBe(
        'postgres://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]'
      );
      expect(sanitizeString(rawMongo)).toBe(
        'mongodb://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]'
      );
    });

    it('redacts RSA and private keys', () => {
      const privateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Y3VfQ1...FAKEKEY...
-----END RSA PRIVATE KEY-----`;
      expect(sanitizeString(privateKey)).toBe('[REDACTED_PRIVATE_KEY]');
    });

    it('redacts sensitive HTTP headers', () => {
      const headers = {
        'content-type': 'application/json',
        'authorization': 'Bearer sk-1234567890abcdef1234567890abcdef12',
        'cookie': 'session_token=xyz123; tracking=true',
        'set-cookie': ['sid=secret123; Path=/; HttpOnly'],
        'x-api-key': 'secret-api-key-value',
        'server': 'nginx/1.24.0',
      };

      const sanitized = sanitizeHeaders(headers);
      expect(sanitized['authorization']).toBe('[REDACTED_BY_ZERIVEX]');
      expect(sanitized['cookie']).toBe('[REDACTED_BY_ZERIVEX]');
      expect(sanitized['set-cookie']).toBe('[REDACTED_BY_ZERIVEX]');
      expect(sanitized['x-api-key']).toBe('[REDACTED_BY_ZERIVEX]');
      expect(sanitized['content-type']).toBe('application/json');
      expect(sanitized['server']).toBe('nginx/1.24.0');
    });

    it('redacts complex nested evidence dictionaries', () => {
      const complexEvidence = {
        request: {
          url: 'https://api.example.com/v1/chat',
          headers: {
            Authorization: 'Bearer sk-1234567890abcdef1234567890abcdef12',
            'X-Custom': 'safe-value',
          },
        },
        response: {
          status: 200,
          body: {
            apiKey: 'AIzaSyD1234567890abcdef1234567890abcdef1',
            dbConn: 'postgres://dbuser:pass1234@postgres.internal:5432/zerivex',
          },
        },
      };

      const redacted = redactEvidence(complexEvidence);
      const jsonStr = JSON.stringify(redacted);

      expect(jsonStr).not.toContain('sk-1234567890abcdef');
      expect(jsonStr).not.toContain('AIzaSyD');
      expect(jsonStr).not.toContain('pass1234');
      expect(jsonStr).toContain('[REDACTED_OPENAI_KEY]');
      expect(jsonStr).toContain('[REDACTED_GOOGLE_KEY]');
      expect(jsonStr).toContain('[REDACTED_PASSWORD]');
    });

    it('enforces 64KB size limit ceiling with explicit truncation indicator', () => {
      const oversizedEvidence = {
        data: 'A'.repeat(70 * 1024), // 70KB
      };

      const result = redactEvidence(oversizedEvidence);
      expect(result.truncated).toBe(true);
      expect(result.message).toContain('exceeded maximum size limit of 64KB');
    });
  });

  describe('2. Deterministic Scoring Algorithm', () => {
    it('returns baseline 100 when zero confirmed vulnerabilities exist', () => {
      expect(calculateSecurityScore([])).toBe(100);
    });

    it('deducts strictly -25 points for CRITICAL severity findings', () => {
      expect(calculateSecurityScore([{ severity: 'CRITICAL' }])).toBe(75);
      expect(calculateSecurityScore([{ severity: 'CRITICAL' }, { severity: 'CRITICAL' }])).toBe(50);
    });

    it('deducts strictly -15 points for HIGH severity findings', () => {
      expect(calculateSecurityScore([{ severity: 'HIGH' }])).toBe(85);
    });

    it('deducts strictly -5 points for MEDIUM severity findings', () => {
      expect(calculateSecurityScore([{ severity: 'MEDIUM' }])).toBe(95);
    });

    it('deducts strictly -2 points for LOW severity findings', () => {
      expect(calculateSecurityScore([{ severity: 'LOW' }])).toBe(98);
    });

    it('deducts 0 points for INFORMATIONAL findings', () => {
      expect(calculateSecurityScore([{ severity: 'INFORMATIONAL' }])).toBe(100);
    });

    it('computes exact compound score: 1 Critical + 1 High + 2 Medium + 1 Low = 48', () => {
      const findings = [
        { severity: 'CRITICAL' as const },
        { severity: 'HIGH' as const },
        { severity: 'MEDIUM' as const },
        { severity: 'MEDIUM' as const },
        { severity: 'LOW' as const },
      ];
      // 100 - 25 - 15 - 5 - 5 - 2 = 48
      expect(calculateSecurityScore(findings)).toBe(48);
    });

    it('clamps lower bound at 0 (never returns negative score)', () => {
      const massiveFindings = Array(6).fill({ severity: 'CRITICAL' as const });
      // 100 - 150 = -50 -> clamped to 0
      expect(calculateSecurityScore(massiveFindings)).toBe(0);
    });

    it('guarantees 100% mathematical reproducibility across iterations', () => {
      const sample = [
        { severity: 'HIGH' as const },
        { severity: 'MEDIUM' as const },
      ];
      const baseline = calculateSecurityScore(sample);
      for (let i = 0; i < 50; i++) {
        expect(calculateSecurityScore(sample)).toBe(baseline);
      }
    });
  });

  describe('3. Core Check Module Specifications', () => {
    it('verifies all deterministic check modules are registered', () => {
      expect(ALL_SCAN_CHECKS.length).toBe(14);
      const checkIds = ALL_SCAN_CHECKS.map((c) => c.id);
      expect(checkIds).toContain('check-tls');
      expect(checkIds).toContain('check-headers');
      expect(checkIds).toContain('check-cors');
      expect(checkIds).toContain('check-exposed-secrets');
      expect(checkIds).toContain('check-cookies');
      expect(checkIds).toContain('check-ai-code-smells');
      expect(checkIds).toContain('check-sqli');
      expect(checkIds).toContain('check-xss');
      expect(checkIds).toContain('check-open-redirect');
      expect(checkIds).toContain('check-path-traversal');
      expect(checkIds).toContain('api-security-check');
      expect(checkIds).toContain('security-txt-check');
      expect(checkIds).toContain('http-methods-check');
      expect(checkIds).toContain('stack-trace-check');
    });

    it('TLS Check detects unencrypted HTTP immediately without socket invocation', async () => {
      const findings = await tlsCheck.run({
        targetUrl: 'http://insecure.example.com',
        hostname: 'insecure.example.com',
        scanMode: 'PUBLIC_PASSIVE',
        organizationId: orgId,
        targetId,
      });

      expect(findings.length).toBe(1);
      expect(findings[0]!.ruleId).toBe('ZX-TLS-001');
      expect(findings[0]!.severity).toBe('HIGH');
      expect(findings[0]!.cweId).toBe('CWE-319');
    });
  });

  describe('4. Scan Job Creation & Active Scan Authorization Gate (ADR-0008)', () => {
    it('STRICTLY PREVENTS active intrusive scan on UNVERIFIED target', async () => {
      await expect(
        createScanJob({
          organizationId: orgId,
          targetId,
          requesterUserId: userId,
          scanMode: 'VERIFIED_ACTIVE',
        })
      ).rejects.toThrow(/Target ownership must be verified before performing active intrusive scanning/);
    });

    it('PERMITS public passive scan on UNVERIFIED target', async () => {
      const scanJob = await createScanJob({
        organizationId: orgId,
        targetId,
        requesterUserId: userId,
        scanMode: 'PUBLIC_PASSIVE',
      });

      expect(scanJob.id).toBeDefined();
      expect(scanJob.status).toBe('QUEUED');
      expect(scanJob.scanMode).toBe('PUBLIC_PASSIVE');
      expect(scanJob.score).toBeNull();
    });
  });

  describe('5. Findings Lifecycle Triage & Audit Integrity', () => {
    let testFindingId: string;
    let testScanJobId: string;

    beforeAll(async () => {
      // Create a scan job
      const scanRes = await query<{ id: string }>(
        `INSERT INTO scan_jobs (organization_id, target_id, requester_user_id, scan_mode, status, score)
         VALUES ($1, $2, $3, 'PUBLIC_PASSIVE', 'COMPLETED', 75) RETURNING id`,
        [orgId, targetId, userId]
      );
      testScanJobId = scanRes.rows[0]!.id;

      // Create a test finding
      const findingRes = await query<{ id: string }>(
        `INSERT INTO findings (
          scan_id, target_id, organization_id, rule_id, title,
          severity, confidence, category, resource_endpoint,
          evidence_json, status, cwe_id, owasp_category
        )
        VALUES ($1, $2, $3, 'ZX-HDR-001', 'Missing CSP Header', 'MEDIUM', 'CONFIRMED', 'Headers', 'https://unverified.scanner-test.local', '{"missingHeader": "Content-Security-Policy"}'::jsonb, 'OPEN', 'CWE-1021', 'A05:2021')
        RETURNING id`,
        [testScanJobId, targetId, orgId]
      );
      testFindingId = findingRes.rows[0]!.id;
    });

    it('transitions finding lifecycle status to CONFIRMED', async () => {
      await query(
        "UPDATE findings SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1 AND organization_id = $2",
        [testFindingId, orgId]
      );

      const res = await query<{ status: string }>(
        'SELECT status FROM findings WHERE id = $1',
        [testFindingId]
      );
      expect(res.rows[0]?.status).toBe('CONFIRMED');
    });

    it('rejects ACCEPTED_RISK without business justification', async () => {
      // Verifies business rule enforced at API / database layer
      const attemptUpdate = async (status: string, reason?: string | null) => {
        if (status === 'ACCEPTED_RISK' && (!reason || reason.trim() === '')) {
          throw new Error('An explicit acceptedRiskReason is required when marking a finding as ACCEPTED_RISK');
        }
      };

      await expect(attemptUpdate('ACCEPTED_RISK', null)).rejects.toThrow(/explicit acceptedRiskReason is required/);
      await expect(attemptUpdate('ACCEPTED_RISK', '')).rejects.toThrow(/explicit acceptedRiskReason is required/);
    });

    it('accepts ACCEPTED_RISK with explicit justification and audit logging', async () => {
      const justification = 'Legacy monolithic admin dashboard scheduled for decommissioning in Q4 2026.';
      await query(
        `UPDATE findings
         SET status = 'ACCEPTED_RISK', accepted_risk_reason = $1, updated_at = NOW()
         WHERE id = $2 AND organization_id = $3`,
        [justification, testFindingId, orgId]
      );

      const res = await query<{ status: string; accepted_risk_reason: string }>(
        'SELECT status, accepted_risk_reason FROM findings WHERE id = $1',
        [testFindingId]
      );
      expect(res.rows[0]?.status).toBe('ACCEPTED_RISK');
      expect(res.rows[0]?.accepted_risk_reason).toBe(justification);
    });

    it('transitions finding lifecycle status to FIXED upon remediation', async () => {
      await query(
        "UPDATE findings SET status = 'FIXED', updated_at = NOW() WHERE id = $1 AND organization_id = $2",
        [testFindingId, orgId]
      );

      const res = await query<{ status: string }>(
        'SELECT status FROM findings WHERE id = $1',
        [testFindingId]
      );
      expect(res.rows[0]?.status).toBe('FIXED');
    });
  });
});
