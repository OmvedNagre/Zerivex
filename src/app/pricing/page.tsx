'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SmoothScroll from '@/components/motion/SmoothScroll';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { adaptPlans } from '@/adapters/adapters';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  Check,
  Minus,
  Hourglass,
  Shield,
  ArrowRight,
  ChevronDown,
  Coins,
} from 'lucide-react';

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);
  const [currentPlanId, setCurrentPlanId] = useState<string | undefined>(undefined);
  const [loadingCheckout, setLoadingCheckout] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  useEffect(() => {
    if (user) {
      fetch('/api/billing')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.data?.entitlements?.planId) {
            setCurrentPlanId(data.data.entitlements.planId);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const plans = adaptPlans(currentPlanId, isAnnual);

  const handlePlanAction = async (planId: string) => {
    if (!user) {
      router.push(`/login?returnTo=${encodeURIComponent(`/pricing?plan=${planId}`)}`);
      return;
    }

    if (planId === 'FREE_DEVELOPER') {
      router.push('/dashboard/targets');
      return;
    }

    if (planId === 'ENTERPRISE') {
      window.location.href = 'mailto:security@zerivex.com?subject=Enterprise%20Security%20Plan%20Inquiry';
      return;
    }

    try {
      setLoadingCheckout(planId);
      setCheckoutError(null);
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          billingCycle: isAnnual ? 'YEARLY' : 'MONTHLY',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate checkout session');
      }

      if (data.data?.url) {
        window.location.href = data.data.url;
      } else {
        router.push('/dashboard/billing?success=true');
      }
    } catch (err: any) {
      setCheckoutError(err.message || 'Checkout failed');
    } finally {
      setLoadingCheckout(null);
    }
  };

  const COMPARISON_GROUPS = [
    {
      group: 'Perimeter & Scanning',
      rows: [
        { name: 'Monitored Verified Targets', free: '1 Target', pro: '5 Targets', ent: 'Unlimited' },
        { name: 'Monthly Scan Allocation', free: '1 Scan / week', pro: '250 Scans / mo', ent: 'Custom Limits' },
        { name: 'Deterministic Check Engines', free: '14 Engines', pro: '14 Engines', ent: '14 Engines' },
        { name: 'Passive Header & AST Audits', free: true, pro: true, ent: true },
        { name: 'Active Non-Destructive Probes', free: 'Basic', pro: 'Full Battery', ent: 'Full Battery + Priority' },
        { name: 'Authenticated Scanning', free: 'soon', pro: 'soon', ent: 'soon' },
        { name: 'Repository & Dependency Scan', free: 'soon', pro: 'soon', ent: 'soon' },
      ],
    },
    {
      group: 'Fixes & Remediation',
      rows: [
        { name: 'Multi-Framework Code Patches', free: 'Next.js, Express, Nginx', pro: 'Next.js, Express, Nginx', ent: 'Custom Stacks' },
        { name: 'Targeted "Verify Fix Now"', free: true, pro: true, ent: true },
        { name: 'Continuous Monitoring & Alerts', free: false, pro: true, ent: true },
        { name: 'Score-Regression Webhooks', free: false, pro: true, ent: true },
      ],
    },
    {
      group: 'CI/CD & Integrations',
      rows: [
        { name: 'CI/CD Build-Breaker Gates', free: false, pro: true, ent: true },
        { name: 'OASIS SARIF v2.1.0 Export', free: false, pro: true, ent: true },
        { name: 'Pull Request Summary Comments', free: false, pro: true, ent: true },
        { name: 'API Key Access (zx_live_*)', free: false, pro: true, ent: true },
        { name: 'HMAC SHA-256 Webhooks', free: false, pro: true, ent: true },
      ],
    },
    {
      group: 'Team & Governance',
      rows: [
        { name: 'Included Team Members', free: '1 Member', pro: '10 Members', ent: 'Unlimited' },
        { name: '5-Tier RBAC Role Permissions', free: false, pro: true, ent: true },
        { name: 'Tamper-Evident Audit Vault', free: false, pro: true, ent: true },
        { name: 'CSV & SIEM JSON Audit Export', free: false, pro: true, ent: true },
        { name: 'Agency White-Label Reports', free: false, pro: 'Available', ent: 'Custom Branding' },
      ],
    },
  ];

  const FAQ_ITEMS = [
    {
      q: 'What counts towards my monthly scan allowance?',
      a: 'A scan is counted only when a scan job runs successfully against a verified target. Targeted re-tests ("Verify Fix Now") do not count against full scan limits. Failed scans never consume your scan allowance.',
    },
    {
      q: 'What happens if I reach my plan limit?',
      a: 'Your historical scan reports, audit ledger, and existing targets remain fully accessible. To initiate additional scans or monitor new target origins, you can upgrade your plan at any time.',
    },
    {
      q: 'What happens if I downgrade my subscription?',
      a: 'When you downgrade, your existing targets and reports are preserved. If you have more targets than your new plan allows, your existing targets stay active, but you cannot register new ones until you are within the limit.',
    },
    {
      q: 'Can I cancel at any time?',
      a: 'Yes. You can cancel your subscription with a single click in your billing dashboard via the Stripe customer portal. Your benefits will continue until the end of your prepaid billing period.',
    },
    {
      q: 'Do you offer an SLA or dedicated support?',
      a: 'Enterprise plans include tailored SLA agreements, dedicated security engineering support, and procurement review assistance.',
    },
  ];

  return (
    <SmoothScroll>
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--ds-bg-page)' }}>
        <AnnouncementBar
          id="zx-pricing-banner"
          message="Zero hidden fees. Transparent security subscriptions with annual discounts."
          ctaLabel="Explore Academy"
          ctaHref="/academy"
          dismissible={true}
        />

        <Header />

        <main style={{ flex: 1, padding: '48px 24px 96px', maxWidth: '1240px', margin: '0 auto', width: '100%' }}>
          {/* Hero Section */}
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
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
              <span>Predictable &amp; Transparent Security Pricing</span>
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(34px, 5vw, 56px)',
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.03em',
                color: 'var(--ds-text-primary)',
                margin: '0 0 16px',
              }}
            >
              Free proves the problem. Paid fixes it for good.
            </h1>

            <p
              style={{
                fontSize: '18px',
                color: 'var(--ds-text-secondary)',
                maxWidth: '680px',
                margin: '0 auto 32px',
                lineHeight: 1.55,
              }}
            >
              Start with a free scan. Upgrade when you need continuous monitoring, automated fix verification, CI/CD quality gates, or team governance.
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
                  padding: '8px 20px',
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
                  padding: '8px 20px',
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

          {checkoutError && (
            <div
              style={{
                maxWidth: '600px',
                margin: '0 auto 32px',
                padding: '12px 18px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: '#FFF1F2',
                border: '1px solid rgba(209,0,47,0.3)',
                color: 'var(--ds-danger)',
                fontSize: '13.5px',
                textAlign: 'center',
              }}
            >
              {checkoutError}
            </div>
          )}

          {/* Plan Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '32px',
              alignItems: 'stretch',
              marginBottom: '80px',
            }}
          >
            {plans.map((p) => {
              const isCurrent = currentPlanId === p.id;
              const isPopular = p.highlighted;

              return (
                <div
                  key={p.id}
                  style={{
                    borderRadius: 'var(--ds-radius-xl)',
                    backgroundColor: 'var(--ds-bg-card)',
                    border: isPopular ? '2px solid var(--ds-action-brand)' : '1px solid var(--ds-border-default)',
                    boxShadow: isPopular ? 'var(--ds-shadow-sticker)' : 'var(--ds-shadow-1)',
                    padding: '40px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative',
                  }}
                >
                  {isPopular && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '-14px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'var(--ds-action-brand)',
                        color: 'var(--ds-on-brand)',
                        fontWeight: 800,
                        fontSize: '11px',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '4px 14px',
                        borderRadius: 'var(--ds-radius-pill)',
                      }}
                    >
                      Most chosen
                    </div>
                  )}

                  <div>
                    {/* Header */}
                    <div style={{ marginBottom: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '26px',
                            fontWeight: 800,
                            color: 'var(--ds-text-primary)',
                            margin: 0,
                          }}
                        >
                          {p.name}
                        </h3>
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 'var(--ds-radius-sm)',
                              backgroundColor: 'rgba(89,221,170,0.2)',
                              color: 'var(--ds-success)',
                            }}
                          >
                            Active Plan
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', marginTop: '8px', lineHeight: 1.4 }}>
                        {p.tagline}
                      </p>
                    </div>

                    {/* Price */}
                    <div style={{ marginBottom: '28px', paddingBottom: '24px', borderBottom: '1px solid var(--ds-border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontSize: '48px',
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
                        <div style={{ fontSize: '12.5px', color: 'var(--ds-success)', fontWeight: 600, marginTop: '4px' }}>
                          {p.annualSavingsText}
                        </div>
                      )}
                    </div>

                    {/* Limits Quick Summary */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '8px',
                        padding: '12px',
                        borderRadius: 'var(--ds-radius-md)',
                        backgroundColor: 'var(--ds-bg-subtle)',
                        marginBottom: '28px',
                        textAlign: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>Targets</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                          {p.limits.apps === 1000 ? 'Unlimited' : p.limits.apps}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>Scans/mo</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                          {p.limits.scans === 1000 ? 'Custom' : p.limits.scans}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>Seats</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                          {p.limits.members === 100 ? 'Unlimited' : p.limits.members}
                        </div>
                      </div>
                    </div>

                    {/* Feature Rows */}
                    <div style={{ marginBottom: '36px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ds-text-muted)', marginBottom: '16px' }}>
                        Features Included
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {p.features.map((feat, fIdx) => (
                          <li key={fIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13.5px' }}>
                            {feat.comingSoon ? (
                              <Hourglass size={15} style={{ color: 'var(--ds-butter)', flexShrink: 0, marginTop: '3px' }} />
                            ) : feat.enabled ? (
                              <Check size={16} style={{ color: 'var(--ds-success)', flexShrink: 0, marginTop: '2px' }} />
                            ) : (
                              <Minus size={16} style={{ color: 'var(--ds-text-muted)', flexShrink: 0, marginTop: '2px' }} />
                            )}
                            <span style={{ color: feat.enabled ? 'var(--ds-text-secondary)' : 'var(--ds-text-muted)' }}>
                              {feat.text}
                              {feat.comingSoon && (
                                <span style={{ marginLeft: '6px', fontSize: '10.5px', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--ds-butter-bg)', color: 'var(--ds-butter)', fontWeight: 700 }}>
                                  Coming soon
                                </span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Plan CTA Button */}
                  <div>
                    <button
                      type="button"
                      disabled={loadingCheckout === p.id || isCurrent}
                      onClick={() => handlePlanAction(p.id)}
                      style={{
                        width: '100%',
                        padding: '14px 20px',
                        borderRadius: 'var(--ds-radius-md)',
                        backgroundColor: isPopular ? 'var(--ds-action-brand)' : 'var(--ds-bg-subtle)',
                        color: isPopular ? 'var(--ds-on-brand)' : 'var(--ds-text-primary)',
                        fontWeight: 700,
                        fontSize: '14.5px',
                        border: isPopular ? 'none' : '1px solid var(--ds-border-default)',
                        cursor: isCurrent ? 'default' : 'pointer',
                        opacity: isCurrent ? 0.7 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: isPopular ? 'var(--ds-shadow-1)' : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span>
                        {loadingCheckout === p.id
                          ? 'Starting checkout...'
                          : isCurrent
                          ? 'Your Current Plan'
                          : p.id === 'FREE_DEVELOPER'
                          ? 'Start Free Scan'
                          : p.id === 'TEAM_PRO'
                          ? user ? 'Upgrade to Team Pro' : 'Start with Team Pro'
                          : 'Talk to Security Team'}
                      </span>
                      {!isCurrent && <ArrowRight size={16} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Credit & Operation Weight Explainer */}
          <div
            style={{
              padding: '36px',
              borderRadius: 'var(--ds-radius-xl)',
              backgroundColor: 'var(--ds-bg-subtle)',
              border: '1px solid var(--ds-border-subtle)',
              marginBottom: '80px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Coins size={20} style={{ color: 'var(--ds-action-brand)' }} />
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--ds-text-primary)',
                }}
              >
                Scan Compute &amp; Operation Weights
              </h2>
            </div>
            <p style={{ fontSize: '14.5px', color: 'var(--ds-text-secondary)', lineHeight: 1.5, margin: '0 0 24px' }}>
              Different security operations consume varying compute resources. Your plan includes predictable allowances. Failed scans never consume your count, and every operation is logged in the tamper-evident audit ledger.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                { name: 'Quick Scan', weight: '0 credits', status: 'Included', note: 'Passive header & bundle checks' },
                { name: 'Deep Active Scan', weight: '2 weight', status: 'Included in Pro', note: 'Active probes with target proof' },
                { name: 'API Schema Scan', weight: '4 weight', status: 'Coming soon', note: 'Introspection & fuzzing' },
                { name: 'Authenticated Scan', weight: '5 weight', status: 'Coming soon', note: 'Session token traversal' },
                { name: 'AI Code Analysis', weight: '6 weight', status: 'Coming soon', note: 'Deep semantic reasoning' },
              ].map((op, i) => (
                <div
                  key={i}
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'var(--ds-bg-card)',
                    border: '1px solid var(--ds-border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)', marginBottom: '4px' }}>
                    {op.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--ds-action-brand)', fontWeight: 600, marginBottom: '6px' }}>
                    {op.weight}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                    {op.note}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Feature Comparison Table */}
          <div style={{ marginBottom: '80px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 800,
                color: 'var(--ds-text-primary)',
                textAlign: 'center',
                margin: '0 0 36px',
              }}
            >
              Comprehensive Feature Comparison
            </h2>

            <div
              data-lenis-prevent
              style={{
                overflowX: 'auto',
                borderRadius: 'var(--ds-radius-lg)',
                border: '1px solid var(--ds-border-default)',
                backgroundColor: 'var(--ds-bg-card)',
                boxShadow: 'var(--ds-shadow-1)',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--ds-bg-subtle)', borderBottom: '1px solid var(--ds-border-default)' }}>
                    <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                      Capability
                    </th>
                    <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-primary)', width: '22%' }}>
                      Free Developer
                    </th>
                    <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: 'var(--ds-action-brand)', width: '22%' }}>
                      Team Pro
                    </th>
                    <th style={{ padding: '16px 20px', fontSize: '14px', fontWeight: 700, color: 'var(--ds-text-primary)', width: '22%' }}>
                      Enterprise
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_GROUPS.map((grp) => (
                    <Fragment key={grp.group}>
                      <tr style={{ backgroundColor: 'var(--ds-bg-subtle)', borderBottom: '1px solid var(--ds-border-subtle)' }}>
                        <td
                          colSpan={4}
                          style={{
                            padding: '10px 20px',
                            fontSize: '12px',
                            fontWeight: 800,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: 'var(--ds-text-muted)',
                          }}
                        >
                          {grp.group}
                        </td>
                      </tr>
                      {grp.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          style={{
                            borderBottom: '1px solid var(--ds-border-subtle)',
                            backgroundColor: rIdx % 2 === 0 ? 'var(--ds-bg-card)' : 'var(--ds-bg-card-hover)',
                          }}
                        >
                          <td style={{ padding: '14px 20px', fontSize: '13.5px', color: 'var(--ds-text-primary)', fontWeight: 500 }}>
                            {row.name}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--ds-text-secondary)' }}>
                            {renderCell(row.free)}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--ds-text-secondary)', fontWeight: 600 }}>
                            {renderCell(row.pro)}
                          </td>
                          <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--ds-text-secondary)' }}>
                            {renderCell(row.ent)}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Billing FAQs */}
          <div style={{ maxWidth: '800px', margin: '0 auto 80px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 800,
                color: 'var(--ds-text-primary)',
                textAlign: 'center',
                margin: '0 0 32px',
              }}
            >
              Billing &amp; Subscription Questions
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    style={{
                      borderRadius: 'var(--ds-radius-lg)',
                      backgroundColor: 'var(--ds-bg-card)',
                      border: '1px solid',
                      borderColor: isOpen ? 'var(--ds-border-strong)' : 'var(--ds-border-subtle)',
                      boxShadow: isOpen ? 'var(--ds-shadow-1)' : 'none',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      style={{
                        width: '100%',
                        padding: '18px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'var(--ds-text-primary)',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700 }}>
                        {item.q}
                      </span>
                      <ChevronDown
                        size={18}
                        style={{
                          color: 'var(--ds-text-muted)',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease',
                          flexShrink: 0,
                        }}
                      />
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 24px 18px', fontSize: '14.5px', color: 'var(--ds-text-secondary)', lineHeight: 1.6 }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final CTA Strip */}
          <div
            style={{
              borderRadius: 'var(--ds-radius-xl)',
              backgroundColor: 'var(--ds-bg-ink)',
              color: 'var(--ds-text-on-ink)',
              padding: '56px 40px',
              textAlign: 'center',
              boxShadow: 'var(--ds-shadow-3)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 800,
                color: '#ffffff',
                margin: '0 0 12px',
              }}
            >
              Ready to verify your application?
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--ds-text-on-ink-dim)', maxWidth: '560px', margin: '0 auto 28px' }}>
              Run your first scan in under 60 seconds with no credit card required.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <Link
                href="/login"
                style={{
                  padding: '13px 26px',
                  borderRadius: 'var(--ds-radius-md)',
                  backgroundColor: 'var(--ds-action-brand)',
                  color: 'var(--ds-on-brand)',
                  fontWeight: 700,
                  fontSize: '14.5px',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>Start Free Scan</span>
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/academy"
                style={{
                  padding: '13px 22px',
                  borderRadius: 'var(--ds-radius-md)',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14.5px',
                  textDecoration: 'none',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                Browse Security Academy
              </Link>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </SmoothScroll>
  );
}

function renderCell(val: boolean | string) {
  if (val === true) {
    return <Check size={16} style={{ color: 'var(--ds-success)' }} />;
  }
  if (val === false) {
    return <Minus size={16} style={{ color: 'var(--ds-text-muted)' }} />;
  }
  if (val === 'soon') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--ds-butter)', fontWeight: 600 }}>
        <Hourglass size={12} />
        <span>Coming soon</span>
      </span>
    );
  }
  return <span>{val}</span>;
}
