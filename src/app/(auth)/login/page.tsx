'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Fingerprint, ScanSearch, FileCode } from 'lucide-react';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        backgroundColor: 'var(--ds-bg-page)',
        position: 'relative',
      }}
    >
      {/* Back to Home Link */}
      <Link
        href="/"
        style={{
          position: 'fixed',
          top: '24px',
          left: '24px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--ds-text-secondary)',
          textDecoration: 'none',
          padding: '8px 14px',
          borderRadius: 'var(--ds-radius-pill)',
          backgroundColor: 'var(--ds-bg-card)',
          border: '1px solid var(--ds-border-default)',
          boxShadow: 'var(--ds-shadow-1)',
          zIndex: 50,
          transition: 'color 0.15s ease',
        }}
        aria-label="Back to home page"
      >
        <ArrowLeft size={14} />
        <span>Back to Zerivex</span>
      </Link>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          width: '100%',
          minHeight: '100vh',
        }}
      >
        {/* Left Column: Sign-In Form */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px 48px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '420px' }}>
            <Suspense fallback={<div style={{ minHeight: '380px' }} />}>
              <LoginForm />
            </Suspense>
          </div>
        </div>

        {/* Right Column: "What happens next" Dark Terminal Island */}
        <div
          style={{
            backgroundColor: 'var(--ds-bg-ink)',
            color: 'var(--ds-text-on-ink)',
            padding: '80px 48px 48px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ maxWidth: '480px', margin: '0 auto', width: '100%' }}>
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
                marginBottom: '20px',
              }}
            >
              <span>Onboarding Workflow</span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 12px',
                letterSpacing: '-0.02em',
              }}
            >
              What happens next
            </h2>

            <p style={{ fontSize: '15px', color: 'var(--ds-text-on-ink-dim)', margin: '0 0 36px', lineHeight: 1.55 }}>
              Security testing shouldn&apos;t be intimidating. Here is exactly how your first verification workflow proceeds:
            </p>

            {/* 3 Progress Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
              {/* Step 1 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ds-action-brand)',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  01
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px' }}>
                    Register Target Application
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--ds-text-on-ink-dim)', margin: 0, lineHeight: 1.5 }}>
                    Enter your application URL or API origin. We initiate non-intrusive perimeter discovery immediately.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ds-mint)',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  <Fingerprint size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px' }}>
                    Verify Target Ownership
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--ds-text-on-ink-dim)', margin: 0, lineHeight: 1.5 }}>
                    Prove domain control via DNS TXT, HTTP header, HTML meta tag, or file upload to unlock active vulnerability probes.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--ds-butter)',
                    flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  <ScanSearch size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff', margin: '0 0 4px' }}>
                    First Deterministic Scan &amp; Patches
                  </h3>
                  <p style={{ fontSize: '13.5px', color: 'var(--ds-text-on-ink-dim)', margin: 0, lineHeight: 1.5 }}>
                    Receive verified findings with ready-to-copy code diffs for Next.js, Express, and Nginx. Re-test fixes in seconds.
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom trust line */}
            <div
              style={{
                marginTop: '40px',
                paddingTop: '24px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--ds-text-on-ink-dim)',
              }}
            >
              <FileCode size={14} style={{ color: 'var(--ds-action-brand)' }} />
              <span>100% deterministic &bull; Sensitive evidence automatically redacted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
