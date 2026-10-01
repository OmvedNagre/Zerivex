import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LaunchScanModal } from '@/components/dashboard/LaunchScanModal';
import { Target } from '@/core/targets/target-service';

describe('Component 8 — LaunchScanModal & ModeSelector', () => {
  const mockTargets: Target[] = [
    {
      id: 'target-verified-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      targetUrl: 'https://app.example.com',
      hostname: 'app.example.com',
      verificationStatus: 'VERIFIED',
      verificationToken: 'token-1',
      verificationMethod: 'DNS_TXT',
      verificationScope: 'EXACT_HOST',
      verifiedAt: new Date('2026-09-01T00:00:00Z'),
      createdAt: new Date('2026-09-01T00:00:00Z'),
      updatedAt: new Date('2026-09-01T00:00:00Z'),
    },
    {
      id: 'target-unverified-2',
      organizationId: 'org-1',
      projectId: 'proj-1',
      targetUrl: 'https://staging.unverified.io',
      hostname: 'staging.unverified.io',
      verificationStatus: 'UNVERIFIED',
      verificationToken: 'token-2',
      verificationMethod: 'HTML_META',
      verificationScope: 'EXACT_HOST',
      verifiedAt: null,
      createdAt: new Date('2026-09-02T00:00:00Z'),
      updatedAt: new Date('2026-09-02T00:00:00Z'),
    },
  ];

  it('renders nothing when isOpen is false', () => {
    const html = renderToStaticMarkup(
      <LaunchScanModal
        isOpen={false}
        onClose={() => {}}
        targets={mockTargets}
        selectedTargetId="target-verified-1"
        onSelectTargetId={() => {}}
        scanMode="PUBLIC_PASSIVE"
        onSelectScanMode={() => {}}
        onLaunchScan={() => {}}
        launching={false}
        launchError={null}
      />
    );

    expect(html).toBe('');
  });

  describe('Dialog Semantics & Accessibility', () => {
    it('renders with strict WAI-ARIA dialog attributes when open', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError={null}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="launch-scan-title"');
      expect(html).toContain('aria-describedby="launch-scan-desc"');
      expect(html).toContain('id="launch-scan-title"');
      expect(html).toContain('Launch Security Assessment');
      expect(html).toContain('aria-label="Close assessment launch dialog"');
    });
  });

  describe('Target Selector & Verification Status Communication', () => {
    it('displays target options with verification status', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError={null}
        />
      );

      expect(html).toContain('https://app.example.com (✓ Verified)');
      expect(html).toContain('https://staging.unverified.io (⚠ Unverified)');
    });

    it('displays cryptographic confirmation banner when verified target is selected', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError={null}
        />
      );

      expect(html).toContain('zlsm-target-context verified');
      expect(html).toContain('Target verified via cryptographic challenge');
      expect(html).toContain('Both Passive and Active modes permitted');
    });

    it('displays warning banner when unverified target is selected', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-unverified-2"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError={null}
        />
      );

      expect(html).toContain('zlsm-target-context unverified');
      expect(html).toContain('Target unverified. Active scanning locked per ADR-0008');
    });
  });

  describe('Scan Mode Selector & ADR-0008 Authorization Gating', () => {
    it('renders accessible radiogroup with both modes available for verified target', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="VERIFIED_ACTIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError={null}
        />
      );

      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('Public Passive Assessment');
      expect(html).toContain('Verified Active Scanning');
      expect(html).toContain('Authorized');
      expect(html).not.toContain('Gated (ADR-0008)');
    });

    it('disables and gates VERIFIED_ACTIVE mode when target is unverified', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-unverified-2"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError={null}
        />
      );

      expect(html).toContain('aria-disabled="true"');
      expect(html).toContain('zlsm-mode-tile  disabled');
      expect(html).toContain('Gated (ADR-0008)');
      expect(html).toContain('Requires target domain ownership verification in Targets Hub');
    });
  });

  describe('Error State & Plan Quota Alerts', () => {
    it('displays error alert box when launchError is provided', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError="Target network unreachable (connection timed out)"
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('Launch Failed');
      expect(html).toContain('Target network unreachable (connection timed out)');
    });

    it('renders direct upgrade billing link when plan quota is exceeded', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={false}
          launchError="Monthly scan allocation exhausted on Free plan"
        />
      );

      expect(html).toContain('href="/dashboard/billing"');
      expect(html).toContain('View Billing &amp; Upgrade Plan (INR ₹)');
    });
  });

  describe('Launching & Execution State', () => {
    it('renders disabled state with spinner when launching is true', () => {
      const html = renderToStaticMarkup(
        <LaunchScanModal
          isOpen={true}
          onClose={() => {}}
          targets={mockTargets}
          selectedTargetId="target-verified-1"
          onSelectTargetId={() => {}}
          scanMode="PUBLIC_PASSIVE"
          onSelectScanMode={() => {}}
          onLaunchScan={() => {}}
          launching={true}
          launchError={null}
        />
      );

      expect(html).toContain('Executing Assessment...');
      expect(html).toContain('zlsm-spin');
      expect(html).toContain('disabled=""');
    });
  });
});
