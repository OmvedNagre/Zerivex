import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  FrameworkRemediationTabs,
  CodeViewer,
  TerminalVerificationCommand,
  FrameworkRemediationModal,
  SupportedFramework,
} from '@/components/dashboard/FrameworkRemediationModal';
import { RuleRemediation } from '@/core/remediation/remediation-catalog';

describe('Component 10 — Framework Remediation Tabs, Code Viewer & Verification Workstation', () => {
  const mockRemediationData: RuleRemediation = {
    ruleId: 'ZX-HSTS-001',
    title: 'Missing HTTP Strict Transport Security (HSTS) Header',
    summary: 'Enforces HTTPS encryption on all requests by advertising the HSTS response header.',
    impact: 'Man-in-the-middle attackers can downgrade HTTPS connections to unencrypted HTTP.',
    cwe: 'CWE-319: Cleartext Transmission of Sensitive Information',
    owasp: 'A05:2021-Security Misconfiguration',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        explanation: 'Configure Strict-Transport-Security in the headers async function in next.config.mjs.',
        diff: `// next.config.mjs
 export default {
   async headers() {
     return [
       {
         source: '/:path*',
         headers: [
+          {
+            key: 'Strict-Transport-Security',
+            value: 'max-age=63072000; includeSubDomains; preload',
+          },
         ],
       },
     ];
   },
 };`,
      },
      express: {
        filename: 'src/server.ts',
        explanation: 'Use Helmet middleware to configure strict transport security.',
        diff: `import express from 'express';
+import helmet from 'helmet';

 const app = express();
+app.use(helmet.hsts({ maxAge: 63072000, includeSubDomains: true, preload: true }));`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/default.conf',
        explanation: 'Add the add_header directive inside your server block.',
        diff: `server {
     listen 443 ssl http2;
     server_name example.com;
 
+    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
 }`,
      },
    },
    cliVerification: 'curl -s -I "YOUR_TARGET_URL" | grep -i "strict-transport-security"',
  };

  const mockFinding = {
    id: 'f-hsts-001',
    ruleId: 'ZX-HSTS-001',
    title: 'Missing HTTP Strict Transport Security (HSTS) Header',
    severity: 'HIGH',
    cweId: 'CWE-319',
    targetUrl: 'https://staging.zerivex.test',
  };

  /* ==========================================================================
     1. FrameworkRemediationTabs
     ========================================================================== */
  describe('FrameworkRemediationTabs: Accessible Segmented Tab Controls', () => {
    it('renders with role="tablist" and accessible label', () => {
      const frameworks: SupportedFramework[] = ['nextjs', 'express', 'nginx'];
      const html = renderToStaticMarkup(
        <FrameworkRemediationTabs
          frameworks={frameworks}
          activeFramework="nextjs"
          onSelectFramework={() => {}}
        />
      );

      expect(html).toContain('role="tablist"');
      expect(html).toContain('aria-label="Target Application Framework"');
      expect(html).toContain('zrm-tablist');
    });

    it('renders tabs with role="tab", aria-selected, and keyboard tabIndex', () => {
      const frameworks: SupportedFramework[] = ['nextjs', 'express', 'nginx'];
      const html = renderToStaticMarkup(
        <FrameworkRemediationTabs
          frameworks={frameworks}
          activeFramework="nextjs"
          onSelectFramework={() => {}}
        />
      );

      // Active tab (nextjs)
      expect(html).toContain('id="remediation-tab-nextjs"');
      expect(html).toContain('aria-selected="true"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-controls="remediation-panel-nextjs"');
      expect(html).toContain('is-active');

      // Inactive tab (express)
      expect(html).toContain('id="remediation-tab-express"');
      expect(html).toContain('aria-selected="false"');
      expect(html).toContain('tabindex="-1"');
      expect(html).toContain('aria-controls="remediation-panel-express"');
      expect(html).not.toMatch(/id="remediation-tab-express"[^>]*is-active/);

      // Inactive tab (nginx)
      expect(html).toContain('id="remediation-tab-nginx"');
      expect(html).toContain('aria-selected="false"');
    });

    it('supports only actual supported frameworks without fabricating unsupported ones', () => {
      const singleFw: SupportedFramework[] = ['nginx'];
      const html = renderToStaticMarkup(
        <FrameworkRemediationTabs
          frameworks={singleFw}
          activeFramework="nginx"
          onSelectFramework={() => {}}
        />
      );

      expect(html).toContain('Nginx Conf');
      expect(html).not.toContain('Next.js');
      expect(html).not.toContain('Express.js');
      expect(html).not.toContain('Apache');
      expect(html).not.toContain('Django');
    });
  });

  /* ==========================================================================
     2. CodeViewer & Diff Surface
     ========================================================================== */
  describe('CodeViewer: Unified Diff & Copy Fidelity Surface', () => {
    it('renders file location and unified diff badge in toolbar', () => {
      const html = renderToStaticMarkup(
        <CodeViewer
          filename="next.config.mjs"
          diffCode={mockRemediationData.frameworks.nextjs!.diff}
          explanation={mockRemediationData.frameworks.nextjs!.explanation}
        />
      );

      expect(html).toContain('next.config.mjs');
      expect(html).toContain('UNIFIED DIFF');
      expect(html).toContain('zrm-diff-pill');
    });

    it('renders syntax-colored additions and deletions accurately', () => {
      const html = renderToStaticMarkup(
        <CodeViewer
          filename="next.config.mjs"
          diffCode={mockRemediationData.frameworks.nextjs!.diff}
        />
      );

      // Lines starting with + have zrm-line-add class
      expect(html).toContain('zrm-line-add');
      expect(html).toContain('Strict-Transport-Security');

      // Comments have zrm-line-comment class
      expect(html).toContain('zrm-line-comment');
    });

    it('code pre has tabIndex="0", aria-label, and overflow-x auto styling', () => {
      const html = renderToStaticMarkup(
        <CodeViewer
          filename="next.config.mjs"
          diffCode={mockRemediationData.frameworks.nextjs!.diff}
        />
      );

      expect(html).toContain('class="zrm-code-pre"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="Remediation patch for next.config.mjs"');
    });

    it('renders accessible Copy Code button with clear icon and label', () => {
      const html = renderToStaticMarkup(
        <CodeViewer
          filename="next.config.mjs"
          diffCode={mockRemediationData.frameworks.nextjs!.diff}
        />
      );

      expect(html).toContain('zrm-copy-btn');
      expect(html).toContain('Copy Code');
      expect(html).toContain('aria-label="Copy remediation code for next.config.mjs"');
    });
  });

  /* ==========================================================================
     3. TerminalVerificationCommand
     ========================================================================== */
  describe('TerminalVerificationCommand: CLI Probe Presentation', () => {
    it('renders terminal prompt character with aria-hidden="true"', () => {
      const cmd = 'curl -s -I "https://app.zerivex.test" | grep -i "strict-transport-security"';
      const html = renderToStaticMarkup(
        <TerminalVerificationCommand command={cmd} />
      );

      expect(html).toContain('class="zrm-cli-prompt"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('$');
    });

    it('displays command in code container with Copy Command button', () => {
      const cmd = 'curl -s -I "https://app.zerivex.test"';
      const html = renderToStaticMarkup(
        <TerminalVerificationCommand command={cmd} />
      );

      expect(html).toContain('curl -s -I &quot;https://app.zerivex.test&quot;');
      expect(html).toContain('Copy Command');
      expect(html).toContain('aria-label="Copy curl verification command"');
    });
  });

  /* ==========================================================================
     4. FrameworkRemediationModal Workstation
     ========================================================================== */
  describe('FrameworkRemediationModal: Workstation Dialog & State Machine', () => {
    it('renders modal dialog with accessible ARIA semantics', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="remediation-modal-title"');
      expect(html).toContain('id="remediation-modal-title"');
      expect(html).toContain('Missing HTTP Strict Transport Security (HSTS) Header');
    });

    it('renders rule metadata: Rule ID, CWE tag, and OWASP category', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );

      expect(html).toContain('ZX-HSTS-001');
      expect(html).toContain('CWE-319');
      expect(html).toContain('A05');
    });

    it('renders vulnerability impact callout', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );

      expect(html).toContain('zrm-impact-card');
      expect(html).toContain('Vulnerability Impact &amp; Exploitation Vector');
      expect(html).toContain('Man-in-the-middle attackers can downgrade HTTPS connections');
    });

    it('renders CLI verification probe with target URL interpolated', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );

      expect(html).toContain('https://staging.zerivex.test');
      expect(html).not.toContain('YOUR_TARGET_URL');
    });

    it('renders live verification action in Ready state', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
          isVerifying={false}
          verificationResult={null}
        />
      );

      expect(html).toContain('zrm-btn-verify');
      expect(html).toContain('Verify Fix on Live Target');
      expect(html).toContain('aria-label="Verify fix for ZX-HSTS-001 on live target"');
    });

    it('renders live verification action in Verifying state with spinner', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
          isVerifying={true}
          verificationResult={null}
        />
      );

      expect(html).toContain('disabled=""');
      expect(html).toContain('zrm-spinner');
      expect(html).toContain('Re-testing Endpoint...');
    });

    it('renders successful live verification banner with alert semantics', () => {
      const successResult = {
        fixed: true,
        diagnostic: 'Strict-Transport-Security header detected with max-age=63072000.',
      };

      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
          isVerifying={false}
          verificationResult={successResult}
        />
      );

      // In initial render, activeFramework is nextjs and verification was associated with it
      // Result banner should be present with alert semantics
      expect(html).toContain('role="alert"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('result-success');
      expect(html).toContain('Target Fix Successfully Verified');
      expect(html).toContain('Strict-Transport-Security header detected with max-age=63072000.');
    });

    it('renders failed live verification diagnostic banner honestly without false claims', () => {
      const failureResult = {
        fixed: false,
        diagnostic: 'HTTP/1.1 200 OK returned but Strict-Transport-Security header was missing.',
      };

      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
          isVerifying={false}
          verificationResult={failureResult}
        />
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain('result-failure');
      expect(html).toContain('Fix Verification Incomplete (Rule Condition Still Triggered)');
      expect(html).toContain('HTTP/1.1 200 OK returned but Strict-Transport-Security header was missing.');
    });

    it('returns null if finding or remediationData is null', () => {
      const html1 = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={null}
          remediationData={mockRemediationData}
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );
      expect(html1).toBe('');

      const html2 = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={null}
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );
      expect(html2).toBe('');
    });

    it('zero AI-slop: contains no animated terminal hacks, fake typing loops, or matrix rain', () => {
      const html = renderToStaticMarkup(
        <FrameworkRemediationModal
          finding={mockFinding}
          remediationData={mockRemediationData}
          targetUrl="https://staging.zerivex.test"
          onClose={() => {}}
          onVerifyFix={() => {}}
        />
      );

      expect(html).not.toContain('matrix');
      expect(html).not.toContain('neon-glow');
      expect(html).not.toContain('AUTO-FIXING');
      expect(html).not.toContain('terminal-cursor');
    });
  });
});
