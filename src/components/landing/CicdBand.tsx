'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { GitBranch, ShieldAlert, FileText, CheckCircle2 } from 'lucide-react';

const SNIPPETS = {
  github: `# .github/workflows/security.yml
name: ZERIVEX Security Gate
on: [pull_request, push]

jobs:
  security-gate:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run ZERIVEX Security Gate
        run: |
          curl -sSL https://get.zerivex.com/cli | bash
          zerivex gate \\
            --api-key=\${{ secrets.ZERIVEX_API_KEY }} \\
            --target=https://staging.myapp.com \\
            --fail-on=CRITICAL \\
            --sarif=results.sarif

      - name: Upload SARIF to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
          category: zerivex`,
  gitlab: `# .gitlab-ci.yml
stages:
  - test
  - security

zerivex-security-gate:
  stage: security
  image: curlimages/curl:latest
  script:
    - curl -sSL https://get.zerivex.com/cli | sh
    - zerivex gate --api-key=$ZERIVEX_API_KEY --target=$STAGING_URL --fail-on=CRITICAL --sarif=gl-security.sarif
  artifacts:
    reports:
      sast: gl-security.sarif
  only:
    - merge_requests`,
  curl: `# Direct CLI / Webhook Invocations
curl -X POST https://api.zerivex.com/api/scans \\
  -H "Authorization: Bearer zx_live_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "targetUrl": "https://staging.myapp.com",
    "mode": "PUBLIC_PASSIVE",
    "failOnSeverity": "CRITICAL"
  }'`,
};

export function CicdBand() {
  const [activeTab, setActiveTab] = useState<'github' | 'gitlab' | 'curl'>('github');

  return (
    <section
      style={{
        padding: '96px 24px',
        backgroundColor: 'var(--ds-bg-ink)',
        color: 'var(--ds-text-on-ink)',
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '48px',
            alignItems: 'center',
          }}
        >
          {/* Left Column: CI/CD Copy & Capabilities */}
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: 'var(--ds-radius-pill)',
                backgroundColor: 'rgba(255, 100, 45, 0.15)',
                border: '1px solid rgba(255, 100, 45, 0.3)',
                color: 'var(--ds-action-brand)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              <GitBranch size={14} />
              <span>CI/CD Quality Gates</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(30px, 4vw, 48px)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: '#ffffff',
                margin: '0 0 16px',
              }}
            >
              Halt security regressions before deployment.
            </h2>

            <p
              style={{
                fontSize: '17px',
                color: 'var(--ds-text-on-ink-dim)',
                lineHeight: 1.6,
                margin: '0 0 28px',
              }}
            >
              Integrate Zerivex directly into your deployment pipeline. Fail builds when critical flaws are introduced, view native OASIS SARIF v2.1.0 alerts inside GitHub Code Scanning, and get clear PR comments.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <ShieldAlert size={18} style={{ color: 'var(--ds-action-brand)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '14px', color: 'var(--ds-text-on-ink)' }}>
                  Configurable build-breaker thresholds: block builds on CRITICAL or HIGH findings.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <FileText size={18} style={{ color: 'var(--ds-mint)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '14px', color: 'var(--ds-text-on-ink)' }}>
                  Native OASIS SARIF v2.1.0 output feeds straight into GitHub Security tabs.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--ds-butter)', flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '14px', color: 'var(--ds-text-on-ink)' }}>
                  Comprehensive markdown summary comment posted to pull requests.
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Code Window with Tabs */}
          <div
            style={{
              backgroundColor: 'var(--ds-bg-ink-raised)',
              borderRadius: 'var(--ds-radius-lg)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: 'var(--ds-shadow-3)',
              overflow: 'hidden',
            }}
          >
            {/* Header / Tabs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { id: 'github', label: 'GitHub Actions' },
                  { id: 'gitlab', label: 'GitLab CI' },
                  { id: 'curl', label: 'cURL / Shell' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: activeTab === tab.id ? 'var(--ds-bg-ink)' : 'transparent',
                      color: activeTab === tab.id ? '#ffffff' : 'var(--ds-text-on-ink-dim)',
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      cursor: 'pointer',
                      fontWeight: activeTab === tab.id ? 700 : 500,
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <CopyButton value={SNIPPETS[activeTab]} label="Copy snippet" />
            </div>

            {/* Code Body */}
            <div
              style={{
                padding: '20px',
                overflowX: 'auto',
                maxHeight: '380px',
              }}
              data-lenis-prevent
            >
              <pre
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12.5px',
                  lineHeight: 1.6,
                  color: 'var(--ds-text-on-ink)',
                }}
              >
                <code>{SNIPPETS[activeTab]}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default CicdBand;
