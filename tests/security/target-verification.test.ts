import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { query, closeDbPool } from '@/core/db/database';
import {
  registerTarget,
  getTargetById,
  deleteTarget,
} from '@/core/targets/target-service';
import {
  verifyTarget,
  getVerificationInstructions,
  assertTargetScanAuthorization,
} from '@/core/targets/verification-service';
import { validateTargetUrl, safeFetch, SecuritySSRFError } from '@/core/security/safe-http-client';
import { isProhibitedIpAddress } from '@/core/security/ip-validator';

describe('Target Management, SSRF Defense & Verification Protocols (Phase 3)', () => {
  let orgAId: string;
  let orgBId: string;
  let projAId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    // 1. Cleanup old test data
    await query("DELETE FROM targets WHERE hostname LIKE '%zerivex-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-targets-%'");
    await query("DELETE FROM users WHERE email LIKE '%@target-test.local'");

    // 2. Setup Org A and Project A
    const userARes = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('usera@target-test.local', 'User A', 'USER') RETURNING id"
    );
    userAId = userARes.rows[0]!.id;

    const orgARes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) 
       VALUES ('Org A Targets', 'test-org-targets-a', $1) RETURNING id`,
      [userAId]
    );
    orgAId = orgARes.rows[0]!.id;

    const projARes = await query<{ id: string }>(
      "INSERT INTO projects (organization_id, name) VALUES ($1, 'Project A') RETURNING id",
      [orgAId]
    );
    projAId = projARes.rows[0]!.id;

    // 3. Setup Org B and Project B (for IDOR tests)
    const userBRes = await query<{ id: string }>(
      "INSERT INTO users (email, display_name, role) VALUES ('userb@target-test.local', 'User B', 'USER') RETURNING id"
    );
    userBId = userBRes.rows[0]!.id;

    const orgBRes = await query<{ id: string }>(
      `INSERT INTO organizations (name, slug, created_by_user_id) 
       VALUES ('Org B Targets', 'test-org-targets-b', $1) RETURNING id`,
      [userBId]
    );
    orgBId = orgBRes.rows[0]!.id;

    await query<{ id: string }>(
      "INSERT INTO projects (organization_id, name) VALUES ($1, 'Project B') RETURNING id",
      [orgBId]
    );
  });

  afterAll(async () => {
    await query("DELETE FROM targets WHERE hostname LIKE '%zerivex-test.local'");
    await query("DELETE FROM organizations WHERE slug LIKE 'test-org-targets-%'");
    await query("DELETE FROM users WHERE email LIKE '%@target-test.local'");
    await closeDbPool();
  });

  describe('1. SSRF Defense & URL Validation', () => {
    it('strictly rejects non-HTTP protocols (file, javascript, data, gopher)', () => {
      expect(() => validateTargetUrl('file:///etc/passwd')).toThrow(SecuritySSRFError);
      expect(() => validateTargetUrl('javascript:alert(1)')).toThrow(SecuritySSRFError);
      expect(() => validateTargetUrl('data:text/html,<script>alert(1)</script>')).toThrow(SecuritySSRFError);
      expect(() => validateTargetUrl('gopher://127.0.0.1:6379/_flushall')).toThrow(SecuritySSRFError);
    });

    it('rejects embedded user credentials in URL', () => {
      expect(() => validateTargetUrl('https://admin:secret@app.example.com')).toThrow(
        /URL contains embedded user credentials/
      );
    });

    it('rejects non-standard ports (SSH, MySQL, Redis, SMTP)', () => {
      expect(() => validateTargetUrl('http://example.com:22')).toThrow(/Port 22 is not permitted/);
      expect(() => validateTargetUrl('http://example.com:3306')).toThrow(/Port 3306 is not permitted/);
      expect(() => validateTargetUrl('http://example.com:6379')).toThrow(/Port 6379 is not permitted/);
    });

    it('identifies prohibited private, loopback, and cloud metadata IP addresses', () => {
      // Loopback
      expect(isProhibitedIpAddress('127.0.0.1').prohibited).toBe(true);
      expect(isProhibitedIpAddress('127.0.0.254').prohibited).toBe(true);
      expect(isProhibitedIpAddress('::1').prohibited).toBe(true);

      // Cloud Provider Metadata
      expect(isProhibitedIpAddress('169.254.169.254').prohibited).toBe(true);
      expect(isProhibitedIpAddress('169.254.1.1').prohibited).toBe(true);

      // RFC 1918 Private Ranges
      expect(isProhibitedIpAddress('10.0.0.1').prohibited).toBe(true);
      expect(isProhibitedIpAddress('172.16.5.10').prohibited).toBe(true);
      expect(isProhibitedIpAddress('192.168.1.1').prohibited).toBe(true);

      // Public Valid IPs
      expect(isProhibitedIpAddress('1.1.1.1').prohibited).toBe(false);
      expect(isProhibitedIpAddress('8.8.8.8').prohibited).toBe(false);
      expect(isProhibitedIpAddress('93.184.216.34').prohibited).toBe(false);
    });
  });

  describe('2. Target Registration & Scope Controls', () => {
    it('registers a target in UNVERIFIED state with a 64-char token', async () => {
      const target = await registerTarget({
        organizationId: orgAId,
        projectId: projAId,
        targetUrl: 'https://app.zerivex-test.local',
        verificationMethod: 'DNS_TXT',
        verificationScope: 'EXACT_HOST',
        actorUserId: userAId,
      });

      expect(target.id).toBeDefined();
      expect(target.verificationStatus).toBe('UNVERIFIED');
      expect(target.verificationToken).toHaveLength(64);
      expect(target.hostname).toBe('app.zerivex-test.local');
      expect(target.verifiedAt).toBeNull();
    });

    it('prevents registering duplicate target URL within the same organization', async () => {
      await expect(
        registerTarget({
          organizationId: orgAId,
          projectId: projAId,
          targetUrl: 'https://app.zerivex-test.local',
        })
      ).rejects.toThrow(/already registered for this organization/);
    });

    it('generates correct verification instructions for all 3 methods', async () => {
      const target = await getTargetById(
        (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!.id,
        orgAId
      );

      const instructions = getVerificationInstructions(target);
      expect(instructions.dnsHost).toBe(`_zerivex-challenge.${target.hostname}`);
      expect(instructions.dnsRecordValue).toBe(`zerivex-verification=${target.verificationToken}`);
      expect(instructions.htmlMetaTag).toContain(`content="${target.verificationToken}"`);
      expect(instructions.httpHeaderName).toBe('X-Zerivex-Verification');
      expect(instructions.httpHeaderValue).toBe(target.verificationToken);
    });
  });

  describe('3. Multi-Tenant Target Isolation (IDOR Defense)', () => {
    it('PREVENTS Org B from reading Org A targets', async () => {
      const targetA = (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!;

      await expect(getTargetById(targetA.id, orgBId)).rejects.toThrow(
        /Target not found or access denied/
      );
    });

    it('PREVENTS Org B from deleting Org A targets', async () => {
      const targetA = (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!;

      await expect(deleteTarget(targetA.id, orgBId, userBId)).rejects.toThrow(
        /Target not found or access denied/
      );
    });
  });

  describe('4. Active Scan Authorization Gate (ADR-0008)', () => {
    it('BLOCKS active intrusive scanning when target is UNVERIFIED', async () => {
      const targetA = (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!;

      await expect(
        assertTargetScanAuthorization(targetA.id, orgAId, 'VERIFIED_ACTIVE')
      ).rejects.toThrow(/Target ownership must be verified before performing active intrusive scanning/);
    });

    it('ALLOWS public passive assessment on unverified targets', async () => {
      const targetA = (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!;

      const authorizedTarget = await assertTargetScanAuthorization(targetA.id, orgAId, 'PUBLIC_PASSIVE');
      expect(authorizedTarget.id).toBe(targetA.id);
    });

    it('ALLOWS active intrusive scanning once target status is VERIFIED', async () => {
      const targetA = (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!;

      // Directly update target to VERIFIED
      await query("UPDATE targets SET verification_status = 'VERIFIED', verified_at = NOW() WHERE id = $1", [targetA.id]);

      const authorizedTarget = await assertTargetScanAuthorization(targetA.id, orgAId, 'VERIFIED_ACTIVE');
      expect(authorizedTarget.verificationStatus).toBe('VERIFIED');
    });
  });

  describe('5. Verification Execution & Failure Diagnostics', () => {
    it('returns structured diagnostic failure when DNS TXT record is not present', async () => {
      const targetA = (await query<{ id: string }>('SELECT id FROM targets WHERE organization_id = $1 LIMIT 1', [orgAId])).rows[0]!;

      const result = await verifyTarget({
        targetId: targetA.id,
        organizationId: orgAId,
        actorUserId: userAId,
        preferredMethod: 'DNS_TXT',
      });

      expect(result.success).toBe(false);
      expect(result.diagnostic).toContain('_zerivex-challenge');
    });

    it('rejects verification requests with SSRF error if target points to loopback or private IP', async () => {
      // Loopback
      await expect(safeFetch('http://127.0.0.1:8080/')).rejects.toThrow(
        /Reserved local\/internal hostname|Matches prohibited IP range/
      );

      // RFC 1918 Private
      await expect(safeFetch('http://192.168.1.1/')).rejects.toThrow(
        /Matches prohibited IP range: RFC 1918/
      );

      // Cloud Metadata
      await expect(safeFetch('http://169.254.169.254/latest/meta-data')).rejects.toThrow(
        /Matches prohibited IP range: Link-Local & Cloud Metadata/
      );
    });
  });
});
