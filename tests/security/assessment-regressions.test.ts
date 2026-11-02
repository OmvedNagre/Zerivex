import { describe, expect, it } from 'vitest';
import { assertAssessmentUrl, recordAssessmentRequest, runAssessment } from '@/core/security/assessment-context';
import { isProhibitedIpAddress } from '@/core/security/ip-validator';
import { WorkerPool } from '@/core/scanner/worker-pool';
import { ALL_SCAN_CHECKS } from '@/core/scanner/scan-runner';
import { SCAN_ENGINES } from '@/core/scanner/engine-registry';

const scope = { targetUrl: 'https://example.com/app', pathOnly: true };

describe('Assessment correctness regressions', () => {
  it('rejects empty results after a swallowed transport failure', async () => {
    await expect(runAssessment(scope, async () => {
      recordAssessmentRequest(false);
      return [];
    })).rejects.toThrow('incomplete');
  });

  it('rejects empty results when a circuit breaker skipped all requests', async () => {
    await expect(runAssessment(scope, async () => [])).rejects.toThrow('incomplete');
  });

  it('accepts an observed clean response and keeps concurrent checks isolated', async () => {
    const checks = await Promise.allSettled([
      runAssessment(scope, async () => { recordAssessmentRequest(true); return []; }),
      runAssessment(scope, async () => { recordAssessmentRequest(false); return []; }),
    ]);
    expect(checks.map((check) => check.status)).toEqual(['fulfilled', 'rejected']);
  });

  it('rejects cross-origin redirects and paths outside the verified subtree', () => {
    for (const url of ['https://other.example/app', 'http://example.com/app',
      'https://example.com:8443/app', 'https://example.com/application', 'https://example.com/app/../admin']) {
      expect(() => assertAssessmentUrl(url, scope)).toThrow();
    }
    expect(() => assertAssessmentUrl('https://example.com/app/settings?q=1', scope)).not.toThrow();
  });

  it.each(['::1', '0:0:0:0:0:0:0:0001', '0:0:0:0:0:ffff:7f00:1',
    '::ffff:192.168.1.1', 'ff02::1', '2001:db8::1', '2002:7f00:1::'])('blocks special-use IPv6 %s', (ip) => {
    expect(isProhibitedIpAddress(ip).prohibited).toBe(true);
  });

  it('permits public global IPv6', () => {
    expect(isProhibitedIpAddress('2606:4700:4700::1111').prohibited).toBe(false);
  });

  it('keeps entitlement engine IDs aligned with executable checks', () => {
    expect(SCAN_ENGINES.map((engine) => engine.id).sort()).toEqual(ALL_SCAN_CHECKS.map((check) => check.id).sort());
  });

  it('settles a timed-out job even if its callback ignores cancellation', async () => {
    const pool = new WorkerPool({ maxConcurrency: 1, defaultTimeoutMs: 15 });
    await expect(pool.submitJob({ id: 'stuck', targetId: 't', organizationId: 'o', domain: 'example.com',
      execute: async () => new Promise(() => {}) })).rejects.toThrow(/aborted|timed out/);
    expect(pool.getMetrics().activeWorkers).toBe(0);
    expect(pool.getMetrics().timedOutJobs).toBe(1);
    await pool.drainAndStop();
  });
});
