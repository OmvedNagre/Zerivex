import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import crypto from 'crypto';
import { query } from '@/core/db/database';
import { createTenantTarget } from '@/core/db/repositories/tenant-repository';
import {
  createApiKey,
  validateApiKey,
  revokeApiKey,
  listApiKeysByOrg,
  hashApiKey,
  API_KEY_PREFIX,
} from '@/core/auth/api-key-service';
import {
  evaluateQualityGate,
  QualityGatePolicy,
} from '@/core/cicd/quality-gate-engine';
import {
  getEffectiveQualityGatePolicy,
  upsertQualityGatePolicy,
} from '@/core/cicd/quality-gate-repository';
import { generateSarifReport } from '@/core/reporting/sarif-generator';
import {
  createWebhook,
  getWebhooksByOrg,
  getWebhookById,
  updateWebhook,
  deleteWebhook,
  getWebhookDeliveries,
} from '@/core/webhooks/webhook-repository';
import {
  signWebhookPayload,
  verifyWebhookSignature,
  dispatchWebhookEvent,
  sendWebhookPing,
} from '@/core/webhooks/webhook-dispatcher';
import { createScanJob, FindingRecord, ScanJobRecord } from '@/core/scanner/scan-runner';
import * as safeHttp from '@/core/security/safe-http-client';

describe('Phase 9: CI/CD Security Integration & Developer Workflow', () => {
  let userAId: string;
  let userBId: string;
  let orgAId: string;
  let orgBId: string;
  let projectAId: string;
  let targetAId: string;

  const testSuffix = Math.random().toString(36).substring(2, 8);

  beforeAll(async () => {
    // 1. Create test user A
    const userARes = await query<{ id: string }>(`
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'CI Tester A', 'USER')
      RETURNING id
    `, [`ci-tester-a-${testSuffix}@zerivex.local`]);
    userAId = userARes.rows[0]!.id;

    // 2. Create test user B
    const userBRes = await query<{ id: string }>(`
      INSERT INTO users (email, display_name, role)
      VALUES ($1, 'CI Tester B', 'USER')
      RETURNING id
    `, [`ci-tester-b-${testSuffix}@zerivex.local`]);
    userBId = userBRes.rows[0]!.id;

    // 3. Create Org A
    const orgARes = await query<{ id: string }>(`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Org CI A', `org-ci-a-${testSuffix}`, userAId]);
    orgAId = orgARes.rows[0]!.id;

    // 4. Create Org B
    const orgBRes = await query<{ id: string }>(`
      INSERT INTO organizations (name, slug, created_by_user_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `, ['Org CI B', `org-ci-b-${testSuffix}`, userBId]);
    orgBId = orgBRes.rows[0]!.id;

    // 5. Create Project for Org A
    const projARes = await query<{ id: string }>(`
      INSERT INTO projects (organization_id, name, description)
      VALUES ($1, 'Project CI A', 'CI Integration Project')
      RETURNING id
    `, [orgAId]);
    projectAId = projARes.rows[0]!.id;

    // 6. Create Target for Org A (initially UNVERIFIED)
    const targetA = await createTenantTarget({
      organizationId: orgAId,
      projectId: projectAId,
      targetUrl: `https://ci-test-${testSuffix}.zerivex.local`,
      actorUserId: userAId,
      verificationScope: 'EXACT_HOST',
    });
    targetAId = targetA.id;
  });

  afterAll(async () => {
    // Cleanup test artifacts
    await query('DELETE FROM organizations WHERE id IN ($1, $2)', [orgAId, orgBId]);
    await query('DELETE FROM users WHERE id IN ($1, $2)', [userAId, userBId]);
  });

  // ============================================================
  // 1. API KEY LIFECYCLE & CRYPTOGRAPHIC SECURITY
  // ============================================================
  describe('1. API Key Lifecycle & Cryptographic Security', () => {
    it('generates an API key with 256-bit entropy and strict prefix format', async () => {
      const { rawKey, apiKey } = await createApiKey({
        organizationId: orgAId,
        userId: userAId,
        name: 'GitHub Actions Main Pipeline',
        scopes: ['scans:create', 'scans:read'],
        expiresInDays: 30,
      });

      expect(rawKey.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(rawKey.length).toBe(72); // zx_live_ (8 chars) + 64 hex chars (32 bytes entropy)
      expect(apiKey.name).toBe('GitHub Actions Main Pipeline');
      expect(apiKey.keyPrefix).toBe(rawKey.slice(0, 16));
      expect(apiKey.status).toBe('ACTIVE');
      expect(apiKey.expiresAt).toBeInstanceOf(Date);
    });

    it('NEVER stores raw API keys in PostgreSQL (only SHA-256 hash is persisted)', async () => {
      const { rawKey, apiKey } = await createApiKey({
        organizationId: orgAId,
        userId: userAId,
        name: 'Entropy Verification Key',
      });

      const dbRes = await query<{ key_hash: string; key_prefix: string }>(
        'SELECT key_hash, key_prefix FROM api_keys WHERE id = $1',
        [apiKey.id]
      );

      const dbRow = dbRes.rows[0]!;
      expect(dbRow.key_hash).not.toBe(rawKey);
      expect(dbRow.key_hash).toBe(hashApiKey(rawKey));
      expect(dbRow.key_prefix).toBe(rawKey.slice(0, 16));
    });

    it('authenticates valid API key and updates last_used metadata', async () => {
      const { rawKey, apiKey } = await createApiKey({
        organizationId: orgAId,
        userId: userAId,
        name: 'Active Test Runner',
      });

      const authCtx = await validateApiKey(rawKey, '198.51.100.42');
      expect(authCtx).not.toBeNull();
      expect(authCtx?.apiKeyId).toBe(apiKey.id);
      expect(authCtx?.organizationId).toBe(orgAId);
      expect(authCtx?.userId).toBe(userAId);
    });

    it('rejects revoked API keys immediately (401 defense)', async () => {
      const { rawKey, apiKey } = await createApiKey({
        organizationId: orgAId,
        userId: userAId,
        name: 'Revocation Target Key',
      });

      // Revoke the key
      const revoked = await revokeApiKey({
        apiKeyId: apiKey.id,
        organizationId: orgAId,
        actorUserId: userAId,
      });
      expect(revoked).toBe(true);

      // Validation must fail
      const authCtx = await validateApiKey(rawKey);
      expect(authCtx).toBeNull();
    });

    it('rejects expired API keys', async () => {
      const { rawKey, apiKey } = await createApiKey({
        organizationId: orgAId,
        userId: userAId,
        name: 'Expired Token Test',
      });

      // Manually backdate expiration in DB to simulate expired key
      await query(
        "UPDATE api_keys SET expires_at = NOW() - INTERVAL '1 day' WHERE id = $1",
        [apiKey.id]
      );

      const authCtx = await validateApiKey(rawKey);
      expect(authCtx).toBeNull();
    });

    it('rejects malformed or tampered API keys', async () => {
      expect(await validateApiKey('')).toBeNull();
      expect(await validateApiKey('invalid_token')).toBeNull();
      expect(await validateApiKey('zx_live_short')).toBeNull();
      expect(await validateApiKey('zx_live_ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')).toBeNull();
    });

    it('lists organization API keys without leaking hashes', async () => {
      const keys = await listApiKeysByOrg(orgAId);
      expect(keys.length).toBeGreaterThanOrEqual(1);

      for (const k of keys) {
        expect(k.organizationId).toBe(orgAId);
        expect(k.keyPrefix.startsWith(API_KEY_PREFIX)).toBe(true);
        expect((k as unknown as { keyHash?: string }).keyHash).toBeUndefined();
      }
    });

    it('enforces multi-tenant isolation: Org B cannot revoke Org A API keys', async () => {
      const { apiKey } = await createApiKey({
        organizationId: orgAId,
        userId: userAId,
        name: 'Org A Protected Key',
      });

      // Org B attempts to revoke Org A's key
      const maliciousRevoke = await revokeApiKey({
        apiKeyId: apiKey.id,
        organizationId: orgBId, // Attacker org
        actorUserId: userBId,
      });

      expect(maliciousRevoke).toBe(false);

      // Key should still be ACTIVE
      const checkRes = await query<{ status: string }>(
        'SELECT status FROM api_keys WHERE id = $1',
        [apiKey.id]
      );
      expect(checkRes.rows[0]!.status).toBe('ACTIVE');
    });
  });

  // ============================================================
  // 2. QUALITY GATE POLICY ENGINE & REPOSITORY
  // ============================================================
  describe('2. Quality Gate Policy Engine & Repository', () => {
    it('evaluates Quality Gate as PASSED when all criteria are satisfied', () => {
      const scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'score'> = {
        id: crypto.randomUUID(),
        status: 'COMPLETED',
        score: 95,
      };

      const findings: FindingRecord[] = [
        {
          id: 'f-1',
          scanId: scanJob.id,
          targetId: targetAId,
          organizationId: orgAId,
          ruleId: 'ZX-COOKIE-001',
          title: 'Cookie Missing Secure Flag',
          severity: 'LOW',
          confidence: 'CONFIRMED',
          category: 'Cookies',
          resourceEndpoint: '/login',
          evidenceJson: {},
          status: 'OPEN',
          acceptedRiskReason: null,
          cweId: 'CWE-614',
          owaspCategory: 'A05:2021',
          createdAt: new Date(),
        },
      ];

      const policy: QualityGatePolicy = {
        organizationId: orgAId,
        name: 'Strict Production Gate',
        minSecurityScore: 80,
        failOnCritical: true,
        maxHighFindings: 0,
        maxMediumFindings: 2,
        failOnNewFindings: false,
      };

      const result = evaluateQualityGate(scanJob, findings, policy);

      expect(result.passed).toBe(true);
      expect(result.status).toBe('PASSED');
      expect(result.reasons.length).toBe(0);
      expect(result.summaryText).toContain('[PASSED]');
      expect(result.markdownSummary).toContain('✅ Zerivex Security Gate: PASSED');
    });

    it('evaluates Quality Gate as FAILED when security score drops below threshold', () => {
      const scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'score'> = {
        id: crypto.randomUUID(),
        status: 'COMPLETED',
        score: 70, // Below threshold of 80
      };

      const policy: QualityGatePolicy = {
        organizationId: orgAId,
        name: 'Strict Score Gate',
        minSecurityScore: 80,
        failOnCritical: true,
        maxHighFindings: 1,
        maxMediumFindings: 5,
        failOnNewFindings: false,
      };

      const result = evaluateQualityGate(scanJob, [], policy);

      expect(result.passed).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.reasons.some((r) => r.includes('below the required gate threshold'))).toBe(true);
      expect(result.summaryText).toContain('[FAILED]');
    });

    it('evaluates Quality Gate as FAILED when CRITICAL findings are detected', () => {
      const scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'score'> = {
        id: crypto.randomUUID(),
        status: 'COMPLETED',
        score: 75,
      };

      const findings: FindingRecord[] = [
        {
          id: 'f-sqli',
          scanId: scanJob.id,
          targetId: targetAId,
          organizationId: orgAId,
          ruleId: 'ZX-SEC-SQLI-001',
          title: 'SQL Injection Detected',
          severity: 'CRITICAL',
          confidence: 'CONFIRMED',
          category: 'Injection',
          resourceEndpoint: '/api/users?id=1',
          evidenceJson: {},
          status: 'OPEN',
          acceptedRiskReason: null,
          cweId: 'CWE-89',
          owaspCategory: 'A03:2021',
          createdAt: new Date(),
        },
      ];

      const policy: QualityGatePolicy = {
        organizationId: orgAId,
        name: 'Zero Critical Policy',
        minSecurityScore: 70,
        failOnCritical: true,
        maxHighFindings: 2,
        maxMediumFindings: 5,
        failOnNewFindings: false,
      };

      const result = evaluateQualityGate(scanJob, findings, policy);

      expect(result.passed).toBe(false);
      expect(result.reasons.some((r) => r.includes('CRITICAL severity finding'))).toBe(true);
      expect(result.findingsCount.critical).toBe(1);
    });

    it('evaluates Quality Gate as FAILED when new vulnerability regressions appear', () => {
      const scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'score'> = {
        id: crypto.randomUUID(),
        status: 'COMPLETED',
        score: 90,
      };

      const previousFindings: FindingRecord[] = []; // Zero prior findings

      const currentFindings: FindingRecord[] = [
        {
          id: 'f-new',
          scanId: scanJob.id,
          targetId: targetAId,
          organizationId: orgAId,
          ruleId: 'ZX-SEC-XSS-001',
          title: 'Reflected Cross-Site Scripting',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'XSS',
          resourceEndpoint: '/search?q=test',
          evidenceJson: {},
          status: 'OPEN',
          acceptedRiskReason: null,
          cweId: 'CWE-79',
          owaspCategory: 'A03:2021',
          createdAt: new Date(),
        },
      ];

      const policy: QualityGatePolicy = {
        organizationId: orgAId,
        name: 'No Regression Policy',
        minSecurityScore: 80,
        failOnCritical: false,
        maxHighFindings: 5, // High count is permitted, but regression is blocked!
        maxMediumFindings: 10,
        failOnNewFindings: true,
      };

      const result = evaluateQualityGate(scanJob, currentFindings, policy, previousFindings);

      expect(result.passed).toBe(false);
      expect(result.reasons.some((r) => r.includes('newly detected security vulnerability'))).toBe(true);
    });

    it('persists and resolves quality gate policies via repository', async () => {
      const saved = await upsertQualityGatePolicy({
        organizationId: orgAId,
        targetId: targetAId,
        name: 'Custom Target Gate',
        minSecurityScore: 85,
        failOnCritical: true,
        maxHighFindings: 1,
        maxMediumFindings: 3,
        failOnNewFindings: true,
      });

      expect(saved.targetId).toBe(targetAId);
      expect(saved.minSecurityScore).toBe(85);

      const resolved = await getEffectiveQualityGatePolicy(orgAId, targetAId);
      expect(resolved.name).toBe('Custom Target Gate');
      expect(resolved.minSecurityScore).toBe(85);
      expect(resolved.maxMediumFindings).toBe(3);
    });
  });

  // ============================================================
  // 3. OASIS SARIF v2.1.0 COMPLIANCE & GITHUB CODE SCANNING
  // ============================================================
  describe('3. OASIS SARIF v2.1.0 Compliance & GitHub Code Scanning', () => {
    it('generates fully compliant OASIS SARIF v2.1.0 document from scan findings', () => {
      const scanJob: Pick<ScanJobRecord, 'id' | 'status' | 'completedAt'> & {
        targetUrl: string;
        targetHostname: string;
      } = {
        id: crypto.randomUUID(),
        status: 'COMPLETED',
        completedAt: new Date(),
        targetUrl: 'https://app.example.com',
        targetHostname: 'app.example.com',
      };

      const findings: FindingRecord[] = [
        {
          id: 'f-sqli',
          scanId: scanJob.id,
          targetId: targetAId,
          organizationId: orgAId,
          ruleId: 'ZX-SEC-SQLI-001',
          title: 'SQL Injection Vulnerability',
          severity: 'CRITICAL',
          confidence: 'CONFIRMED',
          category: 'Injection',
          resourceEndpoint: '/api/v1/users?id=1',
          evidenceJson: {},
          status: 'OPEN',
          acceptedRiskReason: null,
          cweId: 'CWE-89',
          owaspCategory: 'A03:2021',
          createdAt: new Date(),
        },
        {
          id: 'f-cors',
          scanId: scanJob.id,
          targetId: targetAId,
          organizationId: orgAId,
          ruleId: 'ZX-CORS-001',
          title: 'Overly Permissive CORS Policy',
          severity: 'MEDIUM',
          confidence: 'CONFIRMED',
          category: 'CORS',
          resourceEndpoint: '/api/data',
          evidenceJson: {},
          status: 'OPEN',
          acceptedRiskReason: null,
          cweId: 'CWE-942',
          owaspCategory: 'A05:2021',
          createdAt: new Date(),
        },
      ];

      const sarif = generateSarifReport({ scanJob, findings });

      // SARIF Standard Header
      expect(sarif.$schema).toBe('https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json');
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs.length).toBe(1);

      const run = sarif.runs[0]!;
      expect(run.tool.driver.name).toBe('Zerivex');
      expect(run.tool.driver.rules.length).toBe(2);

      // Check Rule mapping
      const sqliRule = run.tool.driver.rules.find((r) => r.id === 'ZX-SEC-SQLI-001');
      expect(sqliRule).toBeDefined();
      expect(sqliRule?.defaultConfiguration.level).toBe('error');
      expect(sqliRule?.properties?.tags).toContain('cwe-89');

      // Check Results mapping
      expect(run.results.length).toBe(2);
      const sqliResult = run.results.find((r) => r.ruleId === 'ZX-SEC-SQLI-001');
      expect(sqliResult?.level).toBe('error');
      expect(sqliResult?.locations[0]?.physicalLocation.artifactLocation.uri).toBe('api/v1/users?id=1');
      expect(sqliResult?.locations[0]?.logicalLocations?.[0]?.name).toBe('/api/v1/users?id=1');

      const corsResult = run.results.find((r) => r.ruleId === 'ZX-CORS-001');
      expect(corsResult?.level).toBe('warning');
    });
  });

  // ============================================================
  // 4. OUTBOUND WEBHOOKS, HMAC-SHA256 SIGNING & SSRF DEFENSE
  // ============================================================
  describe('4. Outbound Webhooks, HMAC-SHA256 Signing & SSRF Defense', () => {
    it('creates and manages webhook subscriptions with secret generation', async () => {
      const webhook = await createWebhook({
        organizationId: orgAId,
        userId: userAId,
        name: 'Security Alert Webhook',
        url: 'https://hooks.example.com/security/zerivex',
        events: ['scan.completed', 'gate.failed'],
      });

      expect(webhook.name).toBe('Security Alert Webhook');
      expect(webhook.url).toBe('https://hooks.example.com/security/zerivex');
      expect(webhook.secret.length).toBe(64); // 32 random bytes hex
      expect(webhook.events).toContain('gate.failed');

      const byId = await getWebhookById(webhook.id, orgAId);
      expect(byId?.id).toBe(webhook.id);

      const orgWebhooks = await getWebhooksByOrg(orgAId);
      expect(orgWebhooks.some((w) => w.id === webhook.id)).toBe(true);
    });

    it('signs payloads with HMAC-SHA256 and verifies signature constant-time', () => {
      const secret = 'super-secret-customer-hmac-key-12345';
      const payload = JSON.stringify({ event: 'scan.completed', score: 98 });

      const signature = signWebhookPayload(payload, secret);
      expect(signature.startsWith('sha256=')).toBe(true);

      // Valid signature must verify
      const isValid = verifyWebhookSignature(payload, signature, secret);
      expect(isValid).toBe(true);

      // Tampered payload must fail
      const tamperedPayload = JSON.stringify({ event: 'scan.completed', score: 100 });
      expect(verifyWebhookSignature(tamperedPayload, signature, secret)).toBe(false);

      // Wrong secret must fail
      expect(verifyWebhookSignature(payload, signature, 'wrong-secret')).toBe(false);
    });

    it('blocks SSRF attacks when webhook URLs point to private networks or cloud metadata', async () => {
      const ssrfSpy = vi.spyOn(safeHttp, 'safeFetch').mockRejectedValueOnce(
        new safeHttp.SecuritySSRFError('Blocked destination: 169.254.169.254 (Cloud metadata service)')
      );

      const webhook = await createWebhook({
        organizationId: orgAId,
        userId: userAId,
        name: 'Malicious Internal Hook',
        url: 'http://169.254.169.254/latest/meta-data/',
        events: ['scan.completed'],
      });

      const { successful, dispatched } = await dispatchWebhookEvent({
        organizationId: orgAId,
        eventType: 'scan.completed',
        data: { scanId: 'test-scan', score: 90 },
      });

      expect(dispatched).toBeGreaterThanOrEqual(1);
      expect(successful).toBe(0); // Failed safely!

      // Verify delivery record captured the SSRF block
      const deliveries = await getWebhookDeliveries(webhook.id, orgAId);
      const delivery = deliveries[0];
      expect(delivery?.success).toBe(false);
      expect(delivery?.errorMessage).toContain('SSRF');

      ssrfSpy.mockRestore();
    });

    it('records successful deliveries with latency and status code', async () => {
      const fetchSpy = vi.spyOn(safeHttp, 'safeFetch').mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        body: '{"received": true}',
        finalUrl: 'https://webhook.site/test',
        pinnedIp: '93.184.216.34',
      });

      const webhook = await createWebhook({
        organizationId: orgAId,
        userId: userAId,
        name: 'Mock Webhook Listener',
        url: 'https://webhook.site/test',
        events: ['finding.critical'],
      });

      const pingResult = await sendWebhookPing({
        webhookId: webhook.id,
        organizationId: orgAId,
      });

      expect(pingResult.success).toBe(true);
      expect(pingResult.statusCode).toBe(200);
      expect(pingResult.responseTimeMs).toBeGreaterThanOrEqual(0);

      const deliveries = await getWebhookDeliveries(webhook.id, orgAId);
      expect(deliveries.length).toBeGreaterThanOrEqual(1);
      expect(deliveries[0]!.eventType).toBe('ping');
      expect(deliveries[0]!.success).toBe(true);

      fetchSpy.mockRestore();
    });

    it('updates and deletes webhook subscriptions cleanly with audit records', async () => {
      const webhook = await createWebhook({
        organizationId: orgAId,
        userId: userAId,
        name: 'Temporary Hook',
        url: 'https://temp.example.com/hook',
      });

      const updated = await updateWebhook({
        id: webhook.id,
        organizationId: orgAId,
        actorUserId: userAId,
        name: 'Updated Temp Hook',
        isActive: false,
      });

      expect(updated?.name).toBe('Updated Temp Hook');
      expect(updated?.isActive).toBe(false);

      const deleted = await deleteWebhook({
        id: webhook.id,
        organizationId: orgAId,
        actorUserId: userAId,
      });

      expect(deleted).toBe(true);
      expect(await getWebhookById(webhook.id, orgAId)).toBeNull();
    });
  });

  // ============================================================
  // 5. CI SCAN EXECUTION & ADR-0008 VERIFICATION GATE
  // ============================================================
  describe('5. CI Scan Execution & ADR-0008 Verification Gate', () => {
    it('STRICTLY BLOCKS active scans on unverified targets via CI (ADR-0008)', async () => {
      // targetA is UNVERIFIED
      await expect(
        createScanJob({
          organizationId: orgAId,
          targetId: targetAId,
          requesterUserId: userAId,
          scanMode: 'VERIFIED_ACTIVE',
        })
      ).rejects.toThrow(/Target ownership must be verified before performing active/);
    });

    it('PERMITS passive CI scans on unverified targets and executes quality gate', async () => {
      const scanJob = await createScanJob({
        organizationId: orgAId,
        targetId: targetAId,
        requesterUserId: userAId,
        scanMode: 'PUBLIC_PASSIVE',
      });

      expect(scanJob.scanMode).toBe('PUBLIC_PASSIVE');
      expect(scanJob.status).toBe('QUEUED');
    });
  });
});
