'use client';

import { useState } from 'react';
import { adaptPlans } from '@/adapters/adapters';
import Link from 'next/link';
import { Check, ArrowRight, Shield } from 'lucide-react';

export function PricingTeaser() {
  const [isAnnual, setIsAnnual] = useState(false);
  const plans = adaptPlans(undefined, isAnnual);

  return (
    <section
      style={{
        padding: '96px 24px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
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
          <Shield size={14} />
          <span>Simple, Transparent Plans</span>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(30px, 4vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: 'var(--ds-text-primary)',
            margin: '0 0 16px',
          }}
        >
          Free proves the problem. Paid fixes it for good.
        </h2>

        <p
          style={{
            fontSize: '17px',
            color: 'var(--ds-text-secondary)',
            maxWidth: '640px',
            margin: '0 auto 28px',
            lineHeight: 1.5,
          }}
        >
          Start with a free perimeter scan. Upgrade when you need continuous monitoring, automated fix verification, or team governance.
        </p>

        {/* Monthly / Annual Toggle */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            padding: '4px',
            borderRadius: 'var(--ds-radius-pill)',
            backgroundColor: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border-default)',
          }}
        >
          <button
            type="button"
            onClick={() => setIsAnnual(false)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--ds-radius-pill)',
              border: 'none',
              backgroundColor: !isAnnual ? 'var(--ds-bg-card)' : 'transparent',
              color: !isAnnual ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
              fontWeight: !isAnnual ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: !isAnnual ? 'var(--ds-shadow-1)' : 'none',
            }}
          >
            Monthly billing
          </button>
          <button
            type="button"
            onClick={() => setIsAnnual(true)}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--ds-radius-pill)',
              border: 'none',
              backgroundColor: isAnnual ? 'var(--ds-bg-card)' : 'transparent',
              color: isAnnual ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
              fontWeight: isAnnual ? 700 : 500,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: isAnnual ? 'var(--ds-shadow-1)' : 'none',
            }}
          >
            Annual billing <span style={{ color: 'var(--ds-success)', fontWeight: 700 }}>Save ~17%</span>
          </button>
        </div>
      </div>

      {/* Plan Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '32px',
          alignItems: 'stretch',
        }}
      >
        {plans.map((p) => {
          const isHighlighted = p.highlighted;

          return (
            <div
              key={p.id}
              style={{
                borderRadius: 'var(--ds-radius-xl)',
                backgroundColor: 'var(--ds-bg-card)',
                border: isHighlighted ? '2px solid var(--ds-action-brand)' : '1px solid var(--ds-border-default)',
                boxShadow: isHighlighted ? 'var(--ds-shadow-sticker)' : 'var(--ds-shadow-1)',
                padding: '36px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
              }}
            >
              {isHighlighted && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-13px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'var(--ds-action-brand)',
                    color: 'var(--ds-on-brand)',
                    fontWeight: 800,
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '3px 12px',
                    borderRadius: 'var(--ds-radius-pill)',
                  }}
                >
                  Most chosen
                </div>
              )}

              <div>
                {/* Header */}
                <div style={{ marginBottom: '20px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '24px',
                      fontWeight: 800,
                      color: 'var(--ds-text-primary)',
                      margin: '0 0 6px',
                    }}
                  >
                    {p.name}
                  </h3>
                  <p style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', margin: 0 }}>
                    {p.tagline}
                  </p>
                </div>

                {/* Price Display */}
                <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: '1px solid var(--ds-border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '44px',
                        fontWeight: 800,
                        letterSpacing: '-0.03em',
                        color: 'var(--ds-text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isAnnual ? p.formattedAnnualPrice : p.formattedMonthlyPrice}
                    </span>
                  </div>
                  {isAnnual && p.annualSavingsText && (
                    <div style={{ fontSize: '12px', color: 'var(--ds-success)', fontWeight: 600, marginTop: '4px' }}>
                      {p.annualSavingsText}
                    </div>
                  )}
                </div>

                {/* Features List */}
                <div style={{ marginBottom: '32px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ds-text-muted)', marginBottom: '16px' }}>
                    What&apos;s included
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {p.features.slice(0, 6).map((feat, fIdx) => (
                      <li key={fIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px', color: feat.enabled ? 'var(--ds-text-secondary)' : 'var(--ds-text-muted)' }}>
                        <Check size={16} style={{ color: feat.enabled ? 'var(--ds-success)' : 'var(--ds-text-muted)', flexShrink: 0, marginTop: '2px' }} />
                        <span>{feat.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div>
                <Link
                  href={p.cta.href}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 20px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: isHighlighted ? 'var(--ds-action-brand)' : 'var(--ds-bg-subtle)',
                    color: isHighlighted ? 'var(--ds-on-brand)' : 'var(--ds-text-primary)',
                    fontWeight: 700,
                    fontSize: '14px',
                    textDecoration: 'none',
                    border: isHighlighted ? 'none' : '1px solid var(--ds-border-default)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{p.cta.label}</span>
                  <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: '36px' }}>
        <Link
          href="/pricing"
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--ds-action-link)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>View full plan comparison &amp; capabilities matrix</span>
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}

export default PricingTeaser;
