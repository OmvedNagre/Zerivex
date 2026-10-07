'use client';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, Mail } from 'lucide-react';

export function FinalCtaCard() {
  return (
    <section
      style={{
        padding: '0 24px',
        maxWidth: '1240px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 2,
        marginBottom: '-48px',
      }}
    >
      <div
        style={{
          borderRadius: 'var(--ds-radius-xl)',
          backgroundColor: 'var(--ds-bg-ink)',
          color: 'var(--ds-text-on-ink)',
          padding: '64px 48px',
          boxShadow: 'var(--ds-shadow-3)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
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
            <ShieldCheck size={14} />
            <span>Verify. Detect. Defend.</span>
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(32px, 4.5vw, 52px)',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#ffffff',
              margin: '0 0 16px',
            }}
          >
            Find what shipped with your AI app.
          </h2>

          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.55,
              color: 'var(--ds-text-on-ink-dim)',
              margin: '0 0 36px',
            }}
          >
            Launch an instant perimeter scan or speak with our security engineering team for multi-app enterprise coverage.
          </p>

          {/* Two-Path CTA Split */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              marginBottom: '28px',
            }}
          >
            <a
              href="#hero-scan"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 28px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: 'var(--ds-action-brand)',
                color: 'var(--ds-on-brand)',
                fontWeight: 700,
                fontSize: '15px',
                textDecoration: 'none',
                boxShadow: 'var(--ds-shadow-1)',
              }}
            >
              <span>Scan my site free</span>
              <ArrowRight size={16} />
            </a>

            <Link
              href="/pricing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 24px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '15px',
                textDecoration: 'none',
                border: '1px solid rgba(255, 255, 255, 0.15)',
              }}
            >
              <Mail size={16} />
              <span>Talk to Security Team</span>
            </Link>
          </div>

          {/* Reassurance Microcopy */}
          <div
            style={{
              fontSize: '12px',
              color: 'var(--ds-text-on-ink-dim)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}
          >
            <span>&bull; No credit card required</span>
            <span>&bull; 14 deterministic engines</span>
            <span>&bull; Automatic secret redaction</span>
            <span>&bull; RFC 9116 security.txt aligned</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FinalCtaCard;
