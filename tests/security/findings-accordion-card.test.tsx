import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FindingsAccordionCard,
  SeverityBadge,
  FindingItemData,
} from '@/components/dashboard/FindingsAccordionCard';

describe('Component 9 — FindingsAccordionCard & SeverityBadge', () => {
  describe('SeverityBadge: Accessible Metadata & Multi-Modal Indicators', () => {
    it('renders CRITICAL badge with semantic token, label, and triangle icon', () => {
      const html = renderToStaticMarkup(<SeverityBadge severity="CRITICAL" />);

      expect(html).toContain('zfc-sev-critical');
      expect(html).toContain('CRITICAL');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-label="Severity: CRITICAL"');
      expect(html).toContain('data-severity="critical"');
      expect(html).toContain('<svg');
    });

    it('renders HIGH badge with semantic token, label, and diamond icon', () => {
      const html = renderToStaticMarkup(<SeverityBadge severity="HIGH" />);

      expect(html).toContain('zfc-sev-high');
      expect(html).toContain('HIGH');
      expect(html).toContain('aria-label="Severity: HIGH"');
      expect(html).toContain('data-severity="high"');
    });

    it('renders MEDIUM badge with semantic token, label, and square icon', () => {
      const html = renderToStaticMarkup(<SeverityBadge severity="MEDIUM" />);

      expect(html).toContain('zfc-sev-medium');
      expect(html).toContain('MEDIUM');
      expect(html).toContain('aria-label="Severity: MEDIUM"');
      expect(html).toContain('data-severity="medium"');
    });

    it('renders LOW badge with semantic token, label, and dot icon', () => {
      const html = renderToStaticMarkup(<SeverityBadge severity="LOW" />);

      expect(html).toContain('zfc-sev-low');
      expect(html).toContain('LOW');
      expect(html).toContain('aria-label="Severity: LOW"');
      expect(html).toContain('data-severity="low"');
    });

    it('normalizes INFORMATIONAL to INFO badge', () => {
      const html = renderToStaticMarkup(<SeverityBadge severity="INFORMATIONAL" />);

      expect(html).toContain('zfc-sev-info');
      expect(html).toContain('INFO');
      expect(html).toContain('aria-label="Severity: INFO"');
      expect(html).toContain('data-severity="info"');
    });
  });

  describe('FindingsAccordionCard: Accessibility & Disclosure Semantics', () => {
    const mockFinding: FindingItemData = {
      id: 'f-101',
      scanId: 'scan-88',
      targetId: 'tgt-44',
      targetUrl: 'https://staging.zerivex.internal',
      ruleId: 'ZX-TLS-001',
      title: 'Unencrypted Cleartext HTTP Protocol in Use',
      severity: 'CRITICAL',
      confidence: 'CONFIRMED',
      category: 'TRANSPORT',
      resourceEndpoint: 'http://staging.zerivex.internal/',
      evidenceJson: {
        scheme: 'http',
        port: 80,
        insecureHeaders: ['X-Forwarded-Proto: http'],
      },
      status: 'OPEN',
      cweId: 'CWE-319',
      owaspCategory: 'A02:2021',
      createdAt: new Date('2026-09-28T10:00:00Z'),
    };

    it('uses a semantic native <button> trigger with aria-expanded and aria-controls', () => {
      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={mockFinding}
          isExpanded={false}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
        />
      );

      // Must be a button, not a div with onClick
      expect(html).toContain('<button');
      expect(html).toContain('type="button"');
      expect(html).toContain('class="zfc-trigger"');
      expect(html).toContain('aria-expanded="false"');
      expect(html).toContain('aria-controls="finding-panel-f-101"');
      expect(html).toContain('id="finding-trigger-f-101"');
    });

    it('renders collapsed state with primary identity, severity, rule, and endpoint', () => {
      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={mockFinding}
          isExpanded={false}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
        />
      );

      // Title & metadata
      expect(html).toContain('Unencrypted Cleartext HTTP Protocol in Use');
      expect(html).toContain('CRITICAL');
      expect(html).toContain('ZX-TLS-001');
      expect(html).toContain('OPEN');
      expect(html).toContain('CWE-319');
      expect(html).toContain('http://staging.zerivex.internal/');
      expect(html).toContain('zfc-chevron-wrapper');

      // Expanded content must NOT be rendered when isExpanded is false
      expect(html).not.toContain('id="finding-panel-f-101"');
      expect(html).not.toContain('Finding Description');
      expect(html).not.toContain('Technical Evidence');
    });

    it('renders expanded state with progressive disclosure and evidence hierarchy', () => {
      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={mockFinding}
          isExpanded={true}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
          onVerifyFix={() => {}}
        />
      );

      // Panel exists with matching ID and region role
      expect(html).toContain('id="finding-panel-f-101"');
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-labelledby="finding-trigger-f-101"');
      expect(html).toContain('aria-expanded="true"');

      // Description & Impact
      expect(html).toContain('Finding Description');
      expect(html).toContain('Security &amp; Operational Impact');
      expect(html).toContain('zfc-impact-box');

      // Technical Evidence
      expect(html).toContain('Technical Evidence');
      expect(html).toContain('Deterministic Payload');
      expect(html).toContain('Copy JSON');
      expect(html).toContain('insecureHeaders');

      // Reproduction procedure
      expect(html).toContain('Reproduction Procedure');
      expect(html).toContain('curl -I http://YOUR_TARGET_URL');
      expect(html).toContain('Copy Command');

      // Action strip
      expect(html).toContain('Fix Guide &amp; Code Diff');
      expect(html).toContain('Verify Fix Now');
      expect(html).toContain('Triage Status');
    });
  });

  describe('Verification Flow: Operational States', () => {
    const mockFinding: FindingItemData = {
      id: 'f-102',
      ruleId: 'ZX-HDR-001',
      title: 'Missing Content-Security-Policy Header',
      severity: 'HIGH',
      status: 'CONFIRMED',
      resourceEndpoint: 'https://staging.zerivex.internal/api',
    };

    it('renders verifying state with spinner and disabled button', () => {
      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={mockFinding}
          isExpanded={true}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
          onVerifyFix={() => {}}
          isVerifying={true}
        />
      );

      expect(html).toContain('Verifying Fix...');
      expect(html).toContain('zfc-spinner');
      expect(html).toContain('disabled=""');
    });

    it('renders verified state with closed status confirmation and diagnostic banner', () => {
      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={{ ...mockFinding, status: 'FIXED' }}
          isExpanded={true}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
          onVerifyFix={() => {}}
          isVerifying={false}
          verificationResult={{
            fixed: true,
            diagnostic: 'Verified Content-Security-Policy header present on endpoint response.',
          }}
        />
      );

      expect(html).toContain('Fix Verified (Closed)');
      expect(html).toContain('state-verified');
      expect(html).toContain('result-success');
      expect(html).toContain('Fix Successfully Verified:');
      expect(html).toContain('Verified Content-Security-Policy header present on endpoint response.');
    });

    it('renders failed verification diagnostic without falsely altering severity', () => {
      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={mockFinding}
          isExpanded={true}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
          onVerifyFix={() => {}}
          isVerifying={false}
          verificationResult={{
            fixed: false,
            diagnostic: 'Target endpoint still returns no Content-Security-Policy header.',
          }}
        />
      );

      expect(html).toContain('Fix Verification Failed');
      expect(html).toContain('state-failed');
      expect(html).toContain('result-failure');
      expect(html).toContain('Verification Incomplete:');
      expect(html).toContain('Target endpoint still returns no Content-Security-Policy header.');
      // Severity is still HIGH
      expect(html).toContain('HIGH');
    });
  });

  describe('Truthful Evidence & Triage Separation', () => {
    it('handles finding with missing evidence gracefully without fake payloads', () => {
      const findingWithoutEvidence: FindingItemData = {
        id: 'f-103',
        ruleId: 'ZX-CORS-001',
        title: 'CORS Wildcard Misconfiguration',
        severity: 'MEDIUM',
        status: 'OPEN',
        evidenceJson: null,
      };

      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={findingWithoutEvidence}
          isExpanded={true}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
        />
      );

      expect(html).toContain('zfc-evidence-empty');
      expect(html).toContain('Deterministic rule triggered via signature matching. No additional raw payload captured.');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('null');
    });

    it('strictly separates technical severity from triage workflow state (e.g. ACCEPTED RISK)', () => {
      const findingAcceptedRisk: FindingItemData = {
        id: 'f-104',
        ruleId: 'ZX-TLS-001',
        title: 'Unencrypted Cleartext HTTP Protocol in Use',
        severity: 'CRITICAL',
        status: 'ACCEPTED_RISK',
      };

      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={findingAcceptedRisk}
          isExpanded={false}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
        />
      );

      // Severity badge remains CRITICAL (red/crimson token)
      expect(html).toContain('zfc-sev-critical');
      expect(html).toContain('CRITICAL');

      // Triage status is ACCEPTED RISK (neutral/amber workflow tag)
      expect(html).toContain('status-accepted-risk');
      expect(html).toContain('Accepted Risk');
    });

    it('renders collaboration button and scan details link when requested', () => {
      const findingWithCollab: FindingItemData = {
        id: 'f-105',
        scanId: 'scan-999',
        ruleId: 'ZX-SEC-001',
        title: 'Hardcoded Secret Detected in Response Body',
        severity: 'CRITICAL',
        status: 'OPEN',
      };

      const html = renderToStaticMarkup(
        <FindingsAccordionCard
          finding={findingWithCollab}
          isExpanded={true}
          onToggleExpand={() => {}}
          onOpenRemediation={() => {}}
          onOpenStatusModal={() => {}}
          onOpenCollabModal={() => {}}
          showCollab={true}
          showScanLink={true}
        />
      );

      expect(html).toContain('Discuss &amp; Assign');
      expect(html).toContain('Scan Details →');
      expect(html).toContain('href="/dashboard/scans/scan-999"');
    });
  });
});
