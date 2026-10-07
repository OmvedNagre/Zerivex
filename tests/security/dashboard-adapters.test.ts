import { describe, it, expect } from 'vitest';
import {
  adaptOverview,
  adaptNextBestAction,
  adaptTargetsTable,
  adaptFindingGroups,
  adaptNavBadges,
} from '@/adapters/dashboard-adapters';

describe('Dashboard Truth & Reliability Adapters (Phase A)', () => {
  describe('adaptOverview', () => {
    it('returns loading state without default values', () => {
      const res = adaptOverview({ loading: true });
      expect(res.status).toBe('loading');
      expect(res.data).toBeUndefined();
    });

    it('returns error state without defaulting to 0 / A+ / PASSED', () => {
      const res = adaptOverview({ error: 'Network failure: 500 Internal Server Error' });
      expect(res.status).toBe('error');
      expect(res.error).toBe('Network failure: 500 Internal Server Error');
      expect(res.data).toBeUndefined();
    });

    it('returns empty state when no targets or scans exist', () => {
      const res = adaptOverview({
        targets: [],
        scans: [],
        findings: [],
      });
      expect(res.status).toBe('empty');
      expect(res.data?.fleetScore).toBeNull();
      expect(res.data?.grade).toBe('—');
      expect(res.data?.headlineState).toBe('no_scans');
      expect(res.data?.headlineTitle).toContain('No scans');
    });

    it('returns clean state when completed scan exists and zero open issues', () => {
      const res = adaptOverview({
        targets: [{ id: 't1', hostname: 'api.zerivex.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't1', status: 'COMPLETED', score: 98, completedAt: '2026-10-06T12:00:00Z' }],
        findings: [
          // Closed/fixed finding should not count as open
          { id: 'f1', targetId: 't1', severity: 'HIGH', status: 'FIXED' },
          { id: 'f2', targetId: 't1', severity: 'LOW', status: 'FALSE_POSITIVE' },
        ],
      });

      expect(res.status).toBe('ready');
      expect(res.data?.headlineState).toBe('clean');
      expect(res.data?.headlineTitle).toBe('No open issues');
      expect(res.data?.grade).toBe('A+');
      expect(res.data?.fleetScore).toBe(98);
      expect(res.data?.openFindings.total).toBe(0);
    });

    it('D1 Regression Test: Score 100 with 6 open high issues must NOT produce "Zero active defects" or Grade A+', () => {
      // Prior bug: f.status was compared against 'ACTIVE', so real database status 'OPEN'
      // evaluated to 0 open findings and falsely claimed score 100 / Grade A+ / "Zero active defects".
      const mockFindings = [
        { id: 'f1', targetId: 't1', severity: 'HIGH', status: 'OPEN', title: 'Exposed Env File' },
        { id: 'f2', targetId: 't1', severity: 'HIGH', status: 'OPEN', title: 'Missing CSP' },
        { id: 'f3', targetId: 't1', severity: 'HIGH', status: 'CONFIRMED', title: 'CORS Wildcard' },
        { id: 'f4', targetId: 't1', severity: 'HIGH', status: 'REOPENED', title: 'Cookie No SameSite' },
        { id: 'f5', targetId: 't1', severity: 'HIGH', status: 'OPEN', title: 'Cleartext HTTP' },
        { id: 'f6', targetId: 't1', severity: 'HIGH', status: 'OPEN', title: 'Outdated TLS' },
        // Plus 49 low/medium closed findings (total 55)
        ...Array.from({ length: 49 }, (_, i) => ({
          id: `f-low-${i}`,
          targetId: 't1',
          severity: 'LOW',
          status: 'FIXED',
          title: `Resolved check ${i}`,
        })),
      ];

      const res = adaptOverview({
        targets: [{ id: 't1', hostname: 'api.zerivex.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't1', status: 'COMPLETED', score: 80, completedAt: '2026-10-06T12:00:00Z' }],
        findings: mockFindings,
      });

      expect(res.status).toBe('ready');
      expect(res.data?.openFindings.high).toBe(6);
      expect(res.data?.openFindings.total).toBe(6);
      // Critical assertion: MUST NOT be clean or A+
      expect(res.data?.headlineState).toBe('needs_attention');
      expect(res.data?.headlineTitle).toBe('Needs attention: 6 critical/high issues open');
      expect(res.data?.grade).not.toBe('A+');
      expect(res.data?.fleetScore).toBe(80);
    });

    it('D2 Regression Test: Quality gate defaults to "Not configured", never false PASSED', () => {
      // Without policy
      const withoutPolicy = adaptOverview({
        targets: [{ id: 't1', hostname: 'app.zerivex.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't1', status: 'COMPLETED', score: 90 }],
        findings: [],
        qualityGate: null,
      });

      expect(withoutPolicy.data?.qualityGate.status).toBe('NOT_CONFIGURED');
      expect(withoutPolicy.data?.qualityGate.label).toBe('Not configured');

      // With failing policy (e.g. min score 95 but score is 90)
      const failingPolicy = adaptOverview({
        targets: [{ id: 't1', hostname: 'app.zerivex.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't1', status: 'COMPLETED', score: 90 }],
        findings: [],
        qualityGate: {
          policy: {
            minSecurityScore: 95,
            failOnCritical: true,
            maxHighFindings: 0,
          },
        },
      });

      expect(failingPolicy.data?.qualityGate.status).toBe('FAILED');
      expect(failingPolicy.data?.qualityGate.label).toBe('Failed');
    });
  });

  describe('adaptNextBestAction', () => {
    it('1. Recommends "Add your first site" when targets list is empty', () => {
      const action = adaptNextBestAction({ targets: [], scans: [], findings: [] });
      expect(action?.actionId).toBe('add_target');
      expect(action?.title).toBe('Add your first site');
      expect(action?.href).toBe('/dashboard/targets?new=true');
    });

    it('2. Recommends "Verify ownership" when target exists but is unverified', () => {
      const action = adaptNextBestAction({
        targets: [{ id: 't-unverified', hostname: 'example.com', verificationStatus: 'PENDING' }],
        scans: [],
        findings: [],
      });
      expect(action?.actionId).toBe('verify_target');
      expect(action?.title).toBe('Verify ownership of example.com');
      expect(action?.targetId).toBe('t-unverified');
    });

    it('3. Recommends "Run your first scan" when verified target has no completed scans', () => {
      const action = adaptNextBestAction({
        targets: [{ id: 't-ver', hostname: 'verified.com', verificationStatus: 'VERIFIED' }],
        scans: [],
        findings: [],
      });
      expect(action?.actionId).toBe('run_scan');
      expect(action?.title).toBe('Run your first scan');
    });

    it('4. Recommends "Fix the top issue" when open critical/high findings exist', () => {
      const action = adaptNextBestAction({
        targets: [{ id: 't-ver', hostname: 'verified.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't-ver', status: 'COMPLETED', score: 75 }],
        findings: [
          {
            id: 'find-crit',
            targetId: 't-ver',
            severity: 'CRITICAL',
            status: 'OPEN',
            title: 'Exposed Stripe API Secret Key',
            resourceEndpoint: 'https://verified.com/bundle.js',
          },
        ],
      });
      expect(action?.actionId).toBe('fix_finding');
      expect(action?.title).toBe('Fix the top issue: Exposed Stripe API Secret Key');
      expect(action?.findingId).toBe('find-crit');
    });

    it('5. Recommends "Add a CI quality gate" when clean but quality gate is missing', () => {
      const action = adaptNextBestAction({
        targets: [{ id: 't-ver', hostname: 'verified.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't-ver', status: 'COMPLETED', score: 95 }],
        findings: [],
        qualityGatePolicy: null,
      });
      expect(action?.actionId).toBe('add_ci_gate');
      expect(action?.title).toBe('Add a CI quality gate');
    });

    it('6. Recommends "Schedule weekly automated scan" when all prior steps are completed', () => {
      const action = adaptNextBestAction({
        targets: [{ id: 't-ver', hostname: 'verified.com', verificationStatus: 'VERIFIED' }],
        scans: [{ id: 's1', targetId: 't-ver', status: 'COMPLETED', score: 95 }],
        findings: [],
        qualityGatePolicy: { minSecurityScore: 80 },
      });
      expect(action?.actionId).toBe('schedule_scan');
      expect(action?.title).toBe('Schedule weekly automated scan');
    });
  });

  describe('adaptTargetsTable', () => {
    it('enriches targets with latest completed scan score and open issues', () => {
      const targets = [
        { id: 't1', hostname: 'app.example.com', targetUrl: 'https://app.example.com', verificationStatus: 'VERIFIED' },
      ];
      const scans = [
        { id: 's1', targetId: 't1', status: 'COMPLETED', score: 88, completedAt: '2026-10-05T10:00:00Z' },
        { id: 's2', targetId: 't1', status: 'COMPLETED', score: 92, completedAt: '2026-10-06T10:00:00Z' },
      ];
      const findings = [
        { id: 'f1', targetId: 't1', severity: 'HIGH', status: 'OPEN' },
        { id: 'f2', targetId: 't1', severity: 'MEDIUM', status: 'OPEN' },
        { id: 'f3', targetId: 't1', severity: 'LOW', status: 'FIXED' },
      ];

      const rows = adaptTargetsTable(targets, scans, findings);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.score).toBe(92);
      expect(rows[0]!.openIssues.high).toBe(1);
      expect(rows[0]!.openIssues.medium).toBe(1);
      expect(rows[0]!.openIssues.low).toBe(0);
      expect(rows[0]!.openIssues.total).toBe(2);
    });
  });

  describe('adaptFindingGroups', () => {
    it('groups 4 duplicate findings on the same endpoint into one group', () => {
      const rawFindings = [
        {
          id: 'f1',
          targetId: 't1',
          ruleId: 'ZX-SEC-ENV-EXPOSURE',
          title: 'Exposed Environment File',
          severity: 'HIGH',
          confidence: 'HIGH',
          resourceEndpoint: 'https://example.com/api/.env',
          createdAt: '2026-10-01T10:00:00Z',
        },
        {
          id: 'f2',
          targetId: 't1',
          ruleId: 'ZX-SEC-ENV-EXPOSURE',
          title: 'Exposed Environment File',
          severity: 'HIGH',
          confidence: 'HIGH',
          resourceEndpoint: 'https://example.com/api/.env',
          createdAt: '2026-10-02T10:00:00Z',
        },
        {
          id: 'f3',
          targetId: 't1',
          ruleId: 'ZX-SEC-ENV-EXPOSURE',
          title: 'Exposed Environment File',
          severity: 'HIGH',
          confidence: 'HIGH',
          resourceEndpoint: 'https://example.com/api/.env',
          createdAt: '2026-10-03T10:00:00Z',
        },
        {
          id: 'f4',
          targetId: 't1',
          ruleId: 'ZX-SEC-ENV-EXPOSURE',
          title: 'Exposed Environment File',
          severity: 'HIGH',
          confidence: 'HIGH',
          resourceEndpoint: 'https://example.com/api/.env',
          createdAt: '2026-10-04T10:00:00Z',
        },
      ];

      const { groups, stats } = adaptFindingGroups(rawFindings);
      expect(groups).toHaveLength(1);
      expect(groups[0]!.occurrenceCount).toBe(4);
      expect(groups[0]!.confidenceLabel).toBe('Confidence: High');
      expect(groups[0]!.latestFinding.id).toBe('f4');
      expect(stats.openCriticalHigh).toBe(4);
    });
  });

  describe('adaptNavBadges', () => {
    it('calculates counts for findings, scans in progress, and unread alerts', () => {
      const badges = adaptNavBadges({
        findings: [
          { severity: 'HIGH', status: 'OPEN' },
          { severity: 'CRITICAL', status: 'CONFIRMED' },
          { severity: 'LOW', status: 'OPEN' },
        ],
        scans: [
          { status: 'RUNNING' },
          { status: 'QUEUED' },
          { status: 'COMPLETED' },
        ],
        unreadAlertsCount: 3,
      });

      expect(badges.openCriticalHigh).toBe(2);
      expect(badges.scansInProgress).toBe(2);
      expect(badges.unreadAlerts).toBe(3);
    });
  });
});
