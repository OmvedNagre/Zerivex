'use client';

import { ShieldCheck, RefreshCw, ScrollText, CheckCircle2 } from 'lucide-react';

export function VerificationProofCard() {
  return (
    <section
      style={{
        padding: '64px 24px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          borderRadius: 'var(--ds-radius-xl)',
          backgroundColor: 'var(--ds-bg-card)',
          border: '1px solid var(--ds-border-strong)',
          boxShadow: 'var(--ds-shadow-2)',
          padding: '48px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '40px',
          alignItems: 'center',
        }}
      >
        {/* Left: Headline & Explanation */}
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              borderRadius: 'var(--ds-radius-pill)',
              backgroundColor: 'rgba(89, 221, 170, 0.15)',
              border: '1px solid rgba(89, 221, 170, 0.3)',
              color: 'var(--ds-success)',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}
          >
            <ShieldCheck size={14} />
            <span>Verification Protocol</span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(28px, 3.5vw, 40px)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
              color: 'var(--ds-text-primary)',
              margin: '0 0 16px',
            }}
          >
            How we verify fixes in seconds.
          </h2>

          <p
            style={{
              fontSize: '16px',
              lineHeight: 1.6,
              color: 'var(--ds-text-secondary)',
              margin: 0,
            }}
          >
            Traditional scanners force you to wait for a full battery scan just to confirm one patch. Zerivex uses precision targeted re-testing: we re-probe the exact failing check against your target origin, verify the defense is live, and immediately certify the finding as RESOLVED.
          </p>
        </div>

        {/* Right: Three Pillars of Proof */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: 'var(--ds-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ds-action-brand)',
                flexShrink: 0,
              }}
            >
              <RefreshCw size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--ds-text-primary)' }}>
                Targeted Check Execution
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Instead of running all 14 engines, we isolate the specific check rule (e.g. ZX-HDR-001) for instantaneous feedback.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: 'var(--ds-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ds-success)',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--ds-text-primary)' }}>
                Deterministic Evidence Matching
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                The probe inspects live responses to confirm headers, token masks, or ORM parameterization are actively blocking attacks.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: 'var(--ds-bg-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--ds-action-brand)',
                flexShrink: 0,
              }}
            >
              <ScrollText size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--ds-text-primary)' }}>
                Tamper-Evident Audit Ledger
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Every verification is committed to the SHA-256 monotonic audit vault with immutable timestamps and actor attribution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default VerificationProofCard;
