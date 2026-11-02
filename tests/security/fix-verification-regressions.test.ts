import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ query: vi.fn(), withTransaction: vi.fn() }));
vi.mock('@/core/db/database', () => db);
vi.mock('@/core/audit/audit-service', () => ({ recordAuditEvent: vi.fn(async () => ({})) }));
vi.mock('@/core/billing/entitlement-service', () => ({ resolveEntitlements: vi.fn(async () => ({ limits: { fixRetestDailyCapPerFinding: 10 } })) }));
vi.mock('@/core/targets/verification-service', () => ({ assertTargetScanAuthorization: vi.fn(async () => ({ targetUrl: 'https://example.com', verificationScope: 'EXACT_HOST' })) }));
import { verifyFindingFix } from '@/core/remediation/fix-verifier';
import { ALL_SCAN_CHECKS } from '@/core/scanner/scan-runner';
import { recordAssessmentRequest } from '@/core/security/assessment-context';

const finding = { id: 'finding', ruleId: 'ZX-HDR-001', title: 'Missing header', status: 'OPEN',
  resourceEndpoint: 'https://example.com', targetId: 'target', targetUrl: 'https://example.com', hostname: 'example.com', verificationStatus: 'VERIFIED' };
describe('Fix verification cannot turn missing evidence into a fix', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('FROM findings f') ? [finding] : [{ count: '0' }] }));
  });
  afterEach(() => vi.restoreAllMocks());

  it('leaves status untouched after swallowed network failures', async () => {
    vi.spyOn(ALL_SCAN_CHECKS.find((check) => check.id === 'check-headers')!, 'run').mockImplementation(async () => {
      recordAssessmentRequest(false); return [];
    });
    await expect(verifyFindingFix({ findingId: 'finding', organizationId: 'org', userId: 'user' })).rejects.toThrow('incomplete');
    expect(db.query.mock.calls.some(([sql]) => sql.includes('UPDATE findings'))).toBe(false);
  });

  it('marks a finding fixed only after an observed successful retest', async () => {
    vi.spyOn(ALL_SCAN_CHECKS.find((check) => check.id === 'check-headers')!, 'run').mockImplementation(async () => {
      recordAssessmentRequest(true); return [];
    });
    expect((await verifyFindingFix({ findingId: 'finding', organizationId: 'org', userId: 'user' })).fixed).toBe(true);
    expect(db.query.mock.calls.some(([sql]) => sql.includes("status = 'FIXED'"))).toBe(true);
  });
});
