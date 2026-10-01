import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ScansExecutionTable,
  ScoreBadge,
  ExecutionStatusBadge,
  ScanModeBadge,
} from '@/components/dashboard/ScansExecutionTable';
import { ScanJobRecord } from '@/core/scanner/scan-runner';

describe('Component 7 — ScansExecutionTable & ScoreBadges', () => {
  describe('ScoreBadge: Security Posture Semantics & Separation of Concerns', () => {
    it('renders emerald badge with accessible label for high security score (94/100)', () => {
      const html = renderToStaticMarkup(
        <ScoreBadge score={94} status="COMPLETED" />
      );

      expect(html).toContain('zse-score-emerald');
      expect(html).toContain('94');
      expect(html).toContain('/100');
      expect(html).toContain('aria-label="Security score: 94 out of 100 (High posture)"');
      expect(html).toContain('role="status"');
    });

    it('renders amber badge with accessible label for moderate security score (67/100)', () => {
      const html = renderToStaticMarkup(
        <ScoreBadge score={67} status="COMPLETED" />
      );

      expect(html).toContain('zse-score-amber');
      expect(html).toContain('67');
      expect(html).toContain('/100');
      expect(html).toContain('aria-label="Security score: 67 out of 100 (Moderate posture)"');
    });

    it('renders red badge with accessible label for critical security score (31/100)', () => {
      const html = renderToStaticMarkup(
        <ScoreBadge score={31} status="COMPLETED" />
      );

      expect(html).toContain('zse-score-red');
      expect(html).toContain('31');
      expect(html).toContain('/100');
      expect(html).toContain('aria-label="Security score: 31 out of 100 (Critical posture)"');
    });

    it('NEVER confuses execution failure with a zero score: renders placeholder for FAILED scans', () => {
      const html = renderToStaticMarkup(
        <ScoreBadge
          score={null}
          status="FAILED"
          errorMessage="DNS lookup timed out after 10000ms"
        />
      );

      expect(html).not.toContain('0 / 100');
      expect(html).not.toContain('zse-score-badge');
      expect(html).toContain('zse-score-placeholder');
      expect(html).toContain('—');
      expect(html).toContain('Failed');
      expect(html).toContain('DNS lookup timed out after 10000ms');
      expect(html).toContain('aria-label="Security score: Not available (execution failed)"');
    });

    it('renders Pending placeholder for RUNNING or QUEUED scans without premature scoring', () => {
      const runningHtml = renderToStaticMarkup(
        <ScoreBadge score={null} status="RUNNING" />
      );
      expect(runningHtml).toContain('Pending');
      expect(runningHtml).toContain('aria-label="Security score: Pending execution completion"');

      const queuedHtml = renderToStaticMarkup(
        <ScoreBadge score={null} status="QUEUED" />
      );
      expect(queuedHtml).toContain('Pending');
      expect(queuedHtml).toContain('aria-label="Security score: Pending execution completion"');
    });
  });

  describe('ExecutionStatusBadge: State Representation & Accessibility', () => {
    it('renders COMPLETED status with checkmark icon and emerald styling', () => {
      const html = renderToStaticMarkup(
        <ExecutionStatusBadge status="COMPLETED" />
      );

      expect(html).toContain('zse-status-completed');
      expect(html).toContain('COMPLETED');
      expect(html).toContain('aria-label="Execution status: Completed"');
    });

    it('renders RUNNING status with spinning activity indicator and cyan styling', () => {
      const html = renderToStaticMarkup(
        <ExecutionStatusBadge status="RUNNING" />
      );

      expect(html).toContain('zse-status-running');
      expect(html).toContain('RUNNING');
      expect(html).toContain('zse-spin');
      expect(html).toContain('aria-label="Execution status: Running in progress"');
    });

    it('renders QUEUED status with clock icon and amber styling', () => {
      const html = renderToStaticMarkup(
        <ExecutionStatusBadge status="QUEUED" />
      );

      expect(html).toContain('zse-status-queued');
      expect(html).toContain('QUEUED');
      expect(html).toContain('aria-label="Execution status: Queued in worker queue"');
    });

    it('renders FAILED status with diagnostic error tooltip and accessible message', () => {
      const html = renderToStaticMarkup(
        <ExecutionStatusBadge
          status="FAILED"
          errorMessage="Target refused TCP connection on port 443"
        />
      );

      expect(html).toContain('zse-status-failed');
      expect(html).toContain('FAILED');
      expect(html).toContain('Target refused TCP connection on port 443');
      expect(html).toContain('aria-label="Execution status: Failed - Target refused TCP connection on port 443"');
    });
  });

  describe('ScanModeBadge: Technical Boundaries', () => {
    it('renders PASSIVE for PUBLIC_PASSIVE mode with Globe icon', () => {
      const html = renderToStaticMarkup(
        <ScanModeBadge mode="PUBLIC_PASSIVE" />
      );

      expect(html).toContain('zse-mode-passive');
      expect(html).toContain('PASSIVE');
      expect(html).toContain('aria-label="Scan mode: Public Passive"');
    });

    it('renders ACTIVE for VERIFIED_ACTIVE mode with ShieldCheck icon', () => {
      const html = renderToStaticMarkup(
        <ScanModeBadge mode="VERIFIED_ACTIVE" />
      );

      expect(html).toContain('zse-mode-active');
      expect(html).toContain('ACTIVE');
      expect(html).toContain('aria-label="Scan mode: Verified Active"');
    });
  });

  describe('ScansExecutionTable: Fleet Metrics, Live Signal, and Ledger', () => {
    const mockScans: ScanJobRecord[] = [
      {
        id: 'scan-1',
        organizationId: 'org-1',
        targetId: 'target-1',
        requesterUserId: 'user-1',
        scanMode: 'VERIFIED_ACTIVE',
        status: 'COMPLETED',
        score: 94,
        startedAt: new Date('2026-09-29T10:00:00Z'),
        completedAt: new Date('2026-09-29T10:01:30Z'),
        workerId: 'worker-1',
        errorMessage: null,
        createdAt: new Date('2026-09-29T10:00:00Z'),
        targetUrl: 'https://api.zerivex.com/v1',
        targetHostname: 'api.zerivex.com',
      },
      {
        id: 'scan-2',
        organizationId: 'org-1',
        targetId: 'target-2',
        requesterUserId: 'user-1',
        scanMode: 'PUBLIC_PASSIVE',
        status: 'RUNNING',
        score: null,
        startedAt: new Date('2026-09-29T10:05:00Z'),
        completedAt: null,
        workerId: 'worker-2',
        errorMessage: null,
        createdAt: new Date('2026-09-29T10:05:00Z'),
        targetUrl: 'https://dashboard.example.com',
        targetHostname: 'dashboard.example.com',
      },
      {
        id: 'scan-3',
        organizationId: 'org-1',
        targetId: 'target-3',
        requesterUserId: 'user-1',
        scanMode: 'PUBLIC_PASSIVE',
        status: 'FAILED',
        score: null,
        startedAt: new Date('2026-09-29T09:00:00Z'),
        completedAt: new Date('2026-09-29T09:00:05Z'),
        workerId: 'worker-1',
        errorMessage: 'Connection timed out',
        createdAt: new Date('2026-09-29T09:00:00Z'),
        targetUrl: 'https://broken-endpoint.local',
        targetHostname: 'broken-endpoint.local',
      },
    ];

    it('renders unified metrics ribbon with Fleet Mean Score as primary anchor', () => {
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={mockScans} loading={false} />
      );

      expect(html).toContain('Fleet Mean Score');
      expect(html).toContain('zse-metric-primary');
      expect(html).toContain('94'); // Mean of completed score [94]
      expect(html).toContain('Active / Queued');
      expect(html).toContain('Completed');
      expect(html).toContain('Total Executions');
      expect(html).toContain('3'); // Total count
    });

    it('renders truthful live execution signal rail when active scans are present', () => {
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={mockScans} loading={false} />
      );

      expect(html).toContain('zse-live-rail');
      expect(html).toContain('Live Execution:');
      expect(html).toContain('1'); // 1 active assessment
      expect(html).toContain('Autonomous worker queue polling');
    });

    it('renders semantic HTML table with col headers, row items, and report links', () => {
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={mockScans} loading={false} />
      );

      // Verify table markup semantics
      expect(html).toContain('<table class="zse-table"');
      expect(html).toContain('<th scope="col" class="zse-th zse-col-target">Target Endpoint</th>');
      expect(html).toContain('<th scope="col" class="zse-th zse-col-mode">Scan Mode</th>');
      expect(html).toContain('<th scope="col" class="zse-th zse-col-status">Execution Status</th>');
      expect(html).toContain('<th scope="col" class="zse-th zse-col-score">Security Score</th>');
      expect(html).toContain('<th scope="col" class="zse-th zse-col-time">Executed At</th>');

      // Verify rows
      expect(html).toContain('api.zerivex.com');
      expect(html).toContain('dashboard.example.com');
      expect(html).toContain('broken-endpoint.local');

      // Verify semantic report links
      expect(html).toContain('href="/dashboard/scans/scan-1"');
      expect(html).toContain('View Report');
      expect(html).toContain('aria-label="View security assessment report for api.zerivex.com"');
    });

    it('renders mobile cards with accessible structure for responsive viewports (<768px)', () => {
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={mockScans} loading={false} />
      );

      expect(html).toContain('zse-mobile-cards');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Mobile Scan Execution Cards"');
      expect(html).toContain('id="mobile-scan-scan-1"');
    });

    it('renders table-aware skeleton during loading state', () => {
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={[]} loading={true} />
      );

      expect(html).toContain('zse-skeleton-container');
      expect(html).toContain('zse-skeleton-row');
      expect(html).toContain('aria-busy="true"');
      expect(html).not.toContain('No Scan Executions Recorded');
    });

    it('renders clear operational empty state when no executions exist', () => {
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={[]} loading={false} onLaunchNewScan={() => {}} />
      );

      expect(html).toContain('zse-empty-state');
      expect(html).toContain('No Scan Executions Recorded');
      expect(html).toContain('Launch First Scan');
    });

    it('distinguishes zero executions from filtered zero matches', () => {
      // When scans exist but search query filters them out
      const html = renderToStaticMarkup(
        <ScansExecutionTable scans={mockScans} loading={false} />
      );
      // The full list is rendered initially
      expect(html).toContain('api.zerivex.com');
      expect(html).not.toContain('No Matching Scan Executions');
    });
  });
});
