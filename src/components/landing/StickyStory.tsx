'use client';

import { useState } from 'react';
import {
  Fingerprint,
  ScanSearch,
  ShieldCheck,
  CheckCircle2,
  Lock,
  FileCode,
  Globe,
  Radio,
} from 'lucide-react';

interface StepData {
  id: string;
  number: string;
  title: string;
  headline: string;
  description: string;
  points: string[];
}

const STEPS: StepData[] = [
  {
    id: 'verify',
    number: '01',
    title: 'Verify',
    headline: "Prove it's your site first.",
    description:
      'We never run active intrusive probes against unconfirmed targets. Prove ownership with one simple cryptographic challenge before any active test begins.',
    points: [
      '4 ownership challenge methods: DNS TXT, HTTP Header, HTML Meta, or File upload',
      'Uses tamper-evident tokens: zx_verify_<hex32>',
      'Prevents unauthorized security testing against third-party systems',
    ],
  },
  {
    id: 'detect',
    number: '02',
    title: 'Detect',
    headline: 'Deterministic checks. No synthetic noise.',
    description:
      'Our 14 deterministic engines inspect client bundles, headers, cookies, TLS, CORS, and injection vulnerabilities. If we flag it, we captured the proof.',
    points: [
      'Passive mode audits public endpoints, headers, and AST bundle keys',
      'Active mode runs non-destructive SQLi and XSS payloads with strict rate limits',
      'All passwords, tokens, cookies, and credit cards are automatically redacted',
    ],
  },
  {
    id: 'defend',
    number: '03',
    title: 'Defend',
    headline: 'Multi-framework diffs. One-click re-verify.',
    description:
      'Stop copying generic OWASP documentation. Zerivex generates exact before/after patches for Next.js, Express, and Nginx, then re-tests only that specific check.',
    points: [
      'Exact framework code diffs with copyable snippets',
      'Targeted "Verify Fix Now" re-runs only the failing check in seconds',
      'Continuous monitoring triggers alerts when security scores drop 10+ points',
    ],
  },
];

export function StickyStory() {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [verifyTab, setVerifyTab] = useState<'dns' | 'http' | 'meta' | 'file'>('dns');

  return (
    <section
      style={{
        padding: '96px 24px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: 'var(--ds-radius-pill)',
            backgroundColor: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border-default)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--ds-text-primary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          <span>The Security Lifecycle</span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 4.5vw, 52px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: 'var(--ds-text-primary)',
            margin: '0 0 16px',
          }}
        >
          Verify. Detect. Defend.
        </h2>
        <p
          style={{
            fontSize: '17px',
            color: 'var(--ds-text-secondary)',
            maxWidth: '620px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          A principled security architecture engineered for modern developers. From domain proof to automated patch verification.
        </p>
      </div>

      {/* Grid: Left Steps, Right Sticky Visual */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '48px',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Interactive Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {STEPS.map((step, idx) => {
            const isSelected = activeStep === idx;
            return (
              <div
                key={step.id}
                onClick={() => setActiveStep(idx)}
                style={{
                  padding: '28px',
                  borderRadius: 'var(--ds-radius-lg)',
                  backgroundColor: isSelected ? 'var(--ds-bg-card)' : 'transparent',
                  border: isSelected ? '1px solid var(--ds-border-strong)' : '1px solid transparent',
                  boxShadow: isSelected ? 'var(--ds-shadow-2)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: isSelected ? 'var(--ds-action-brand)' : 'var(--ds-text-muted)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: isSelected ? 'rgba(255,100,45,0.1)' : 'var(--ds-bg-subtle)',
                    }}
                  >
                    STEP {step.number}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: isSelected ? 'var(--ds-text-primary)' : 'var(--ds-text-secondary)',
                    }}
                  >
                    {step.title}
                  </span>
                </div>

                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--ds-text-primary)',
                    margin: '0 0 10px',
                  }}
                >
                  {step.headline}
                </h3>

                <p
                  style={{
                    fontSize: '15px',
                    lineHeight: 1.55,
                    color: 'var(--ds-text-secondary)',
                    margin: '0 0 16px',
                  }}
                >
                  {step.description}
                </p>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {step.points.map((pt, pIdx) => (
                    <li key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--ds-text-secondary)' }}>
                      <CheckCircle2 size={16} style={{ color: 'var(--ds-success)', flexShrink: 0, marginTop: '2px' }} />
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Right Column: Visual Island */}
        <div
          style={{
            position: 'sticky',
            top: '110px',
            backgroundColor: 'var(--ds-bg-ink)',
            borderRadius: 'var(--ds-radius-lg)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: '28px',
            boxShadow: 'var(--ds-shadow-3)',
            minHeight: '440px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          {/* Visual Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {activeStep === 0 && <Fingerprint size={20} style={{ color: 'var(--ds-action-brand)' }} />}
              {activeStep === 1 && <ScanSearch size={20} style={{ color: 'var(--ds-action-brand)' }} />}
              {activeStep === 2 && <ShieldCheck size={20} style={{ color: 'var(--ds-action-brand)' }} />}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#ffffff', fontWeight: 600 }}>
                {activeStep === 0 && 'Target Ownership Verification'}
                {activeStep === 1 && 'Deterministic Scan Engine Battery'}
                {activeStep === 2 && 'Remediation & Targeted Re-Test'}
              </span>
            </div>

            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--ds-text-on-ink-dim)',
              }}
            >
              MODULE {activeStep + 1}/3
            </span>
          </div>

          {/* Dynamic Content based on activeStep */}
          <div style={{ padding: '24px 0', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {activeStep === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'dns', label: 'DNS TXT' },
                    { id: 'http', label: 'HTTP Header' },
                    { id: 'meta', label: 'HTML Meta' },
                    { id: 'file', label: 'File Upload' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setVerifyTab(tab.id as any)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: verifyTab === tab.id ? 'var(--ds-action-brand)' : 'rgba(255, 255, 255, 0.05)',
                        color: verifyTab === tab.id ? 'var(--ds-on-brand)' : 'var(--ds-text-on-ink)',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--ds-bg-ink-raised)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: 1.7,
                    color: 'var(--ds-text-on-ink)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  {verifyTab === 'dns' && (
                    <>
                      <div style={{ color: 'var(--ds-text-on-ink-dim)' }}># DNS TXT Challenge Record</div>
                      <div>Host: <span style={{ color: '#ffffff' }}>_zerivex-challenge.your-domain.com</span></div>
                      <div>Type: <span style={{ color: 'var(--ds-butter)' }}>TXT</span></div>
                      <div>Value: <span style={{ color: 'var(--ds-mint)' }}>zx_verify_9b8f2c4a7e1d5a8b</span></div>
                    </>
                  )}
                  {verifyTab === 'http' && (
                    <>
                      <div style={{ color: 'var(--ds-text-on-ink-dim)' }}># Response Header Challenge</div>
                      <div>Header: <span style={{ color: '#ffffff' }}>X-Zerivex-Verification</span></div>
                      <div>Value: <span style={{ color: 'var(--ds-mint)' }}>zx_verify_9b8f2c4a7e1d5a8b</span></div>
                      <div>Route: <span style={{ color: 'var(--ds-butter)' }}>/ or /api/health</span></div>
                    </>
                  )}
                  {verifyTab === 'meta' && (
                    <>
                      <div style={{ color: 'var(--ds-text-on-ink-dim)' }}># HTML Meta Tag Challenge</div>
                      <div style={{ color: 'var(--ds-mint)' }}>
                        &lt;meta name=&quot;zerivex-verification&quot; content=&quot;zx_verify_9b8f2c4a7e1d5a8b&quot; /&gt;
                      </div>
                    </>
                  )}
                  {verifyTab === 'file' && (
                    <>
                      <div style={{ color: 'var(--ds-text-on-ink-dim)' }}># Verification File Challenge</div>
                      <div>Path: <span style={{ color: '#ffffff' }}>/.well-known/zerivex-verification.txt</span></div>
                      <div>Body: <span style={{ color: 'var(--ds-mint)' }}>zx_verify_9b8f2c4a7e1d5a8b</span></div>
                    </>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ds-mint)' }}>
                  <Lock size={14} />
                  <span>Protects third-party systems from unauthorized scans.</span>
                </div>
              </div>
            )}

            {activeStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--ds-bg-ink-raised)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Radio size={14} style={{ color: 'var(--ds-butter)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>Passive Engine</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--ds-text-on-ink-dim)', margin: 0, lineHeight: 1.5 }}>
                      Non-intrusive header audits, bundle AST token inspection, CORS wildcard analysis.
                    </p>
                  </div>

                  <div
                    style={{
                      padding: '14px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--ds-bg-ink-raised)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Globe size={14} style={{ color: 'var(--ds-mint)' }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>Active Probes</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--ds-text-on-ink-dim)', margin: 0, lineHeight: 1.5 }}>
                      Deterministic SQLi, XSS, and SSRF probes. Requires verified target ownership.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(255, 100, 45, 0.08)',
                    borderRadius: '8px',
                    padding: '12px',
                    border: '1px solid rgba(255, 100, 45, 0.2)',
                    fontSize: '12px',
                    color: 'var(--ds-text-on-ink)',
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: 'var(--ds-action-brand)', fontWeight: 600 }}>Evidence Redaction:</span> Sensitive auth tokens, passwords, cookies, and keys are automatically sanitized before vault recording.
                </div>
              </div>
            )}

            {activeStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div
                  style={{
                    backgroundColor: 'var(--ds-bg-ink-raised)',
                    borderRadius: '8px',
                    padding: '16px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--ds-text-on-ink)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div style={{ color: 'var(--ds-text-on-ink-dim)', marginBottom: '8px' }}>
                    # Targeted Re-Test Pipeline
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--ds-butter)' }}>[CHECK #04]</span>
                    <span>ZX-HDR-001 (Strict-Transport-Security)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--ds-mint)' }}>[STATUS]</span>
                    <span>Re-executing single deterministic check...</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--ds-action-brand)' }}>[VAULT]</span>
                    <span>Recorded tamper-evident resolution hash</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ds-mint)' }}>
                  <FileCode size={14} />
                  <span>Generates Next.js, Express, and Nginx code patches.</span>
                </div>
              </div>
            )}
          </div>

          {/* Visual Footer */}
          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--ds-text-on-ink-dim)',
            }}
          >
            <span>Continuous Protection Active</span>
            <span style={{ color: 'var(--ds-mint)' }}>100% Deterministic</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StickyStory;
