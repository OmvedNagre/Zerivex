'use client';

import { useState, useEffect } from 'react';
import { PLANS, type PlanId } from '@/core/billing/types';
import { CONTACT_EMAIL } from '@/lib/contact';
import { useAuth } from '@/components/auth/AuthProvider';
import { Check, CreditCard, AlertTriangle, Shield } from 'lucide-react';

interface PlanPricing {
  monthlyInr: number;
  yearlyInr: number;
  currency: 'INR';
}

interface PlanLimits {
  maxVerifiedTargets: number;
  maxMonthlyScans: number;
  maxTeamMembers: number;
}

interface PlanFeatures {
  attackSurfaceCrawler: boolean;
  cicdIntegrations: boolean;
  continuousMonitoring: boolean;
  complianceAuditVault: boolean;
  findingCollaboration: boolean;
  deepActiveScans: boolean;
  logRetentionDays: number;
}

interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  badge?: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
}

interface SubscriptionRecord {
  id: string;
  planId: PlanId;
  status: 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currency: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

interface OrgEntitlementSummary {
  subscription: SubscriptionRecord;
  plan: PlanDefinition;
  isOwnerBypass: boolean;
  scanCredits: number;
  usage: {
    targets: { current: number; max: number; percentage: number };
    monthlyScans: { current: number; max: number; percentage: number };
    teamMembers: { current: number; max: number; percentage: number };
  };
  features: PlanFeatures;
}

export default function BillingPage() {
  const { isOwner } = useAuth();
  const [entitlements, setEntitlements] = useState<OrgEntitlementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing');
      if (!res.ok) {
        throw new Error(`Failed to load billing details (${res.status})`);
      }
      const json = await res.json();
      if (json.success) {
        setEntitlements(json.data.entitlements);
        if (json.data.entitlements?.subscription?.billingCycle) {
          setBillingCycle(json.data.entitlements.subscription.billingCycle);
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();

    // Check query params for checkout / portal redirects
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('simulated') === 'true' || urlParams.get('mock_checkout') === 'success') {
        setFeedback({ type: 'success', message: 'Local checkout simulation completed. No payment was taken or subscription changed.' });
      } else if (urlParams.get('session_id')) {
        setFeedback({ type: 'success', message: 'Checkout returned. Subscription changes appear after the signed payment event is verified.' });
      } else if (urlParams.get('canceled') === 'true') {
        setFeedback({
          type: 'error',
          message: 'Checkout was canceled. Your current subscription tier remains unchanged.',
        });
      } else if (urlParams.get('portal_simulated') === 'true') {
        setFeedback({
          type: 'success',
          message: 'Local billing portal simulation. No payment details were changed.',
        });
      }
    }
  }, []);

  const handleUpgrade = async (planId: 'PRO' | 'TEAM') => {
    try {
      setActionLoading(`upgrade-${planId}`);
      setFeedback(null);

      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingCycle }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate checkout session');
      }

      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
      setActionLoading(null);
    }
  };

  const handleOpenPortal = async () => {
    try {
      setActionLoading('portal');
      setFeedback(null);

      const res = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch (err) {
      setFeedback({ type: 'error', message: (err as Error).message });
      setActionLoading(null);
    }
  };

  const formatRupees = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ marginTop: '1rem', fontSize: '0.95rem' }}>Loading subscription ledger & quotas...</div>
      </div>
    );
  }

  const currentSub = entitlements?.subscription;
  const isBypass = entitlements?.isOwnerBypass || isOwner;

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>Subscription & Billing</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                }}
              >
                CURRENCY: INR (₹)
              </span>
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.4rem', marginBottom: 0 }}>
              Manage your enterprise plan, monitor monthly scan ledgers, and scale attack surface coverage.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={handleOpenPortal}
              disabled={actionLoading === 'portal'}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <CreditCard size={15} />
              <span>{actionLoading === 'portal' ? 'Opening Portal...' : 'Billing Portal & Invoices'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {feedback && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '1.75rem',
            backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          {feedback.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Platform Owner Override Banner */}
      {isBypass && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(168, 85, 247, 0.15) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.4)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(168, 85, 247, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.25rem',
              color: '#c084fc',
              flexShrink: 0,
            }}
          >
            <Shield size={20} />
          </div>
          <div>
            <div style={{ color: '#e9d5ff', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Platform Owner Mode Active</span>
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', backgroundColor: '#9333ea', color: '#fff' }}>
                OVERRIDE
              </span>
            </div>
            <div style={{ color: '#c4b5fd', fontSize: '0.85rem', marginTop: '0.2rem' }}>
              All target bounds, scan allocations, and enterprise feature gates (Compliance Audit Vault, Deep Scans, Crawlers) are automatically unlocked without customer record mutation.
            </div>
          </div>
        </div>
      )}

      {/* Real-time Usage & Allocation Ledgers */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Current Allocation & Real-Time Usage
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Target Quota */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                VERIFIED TARGETS
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {entitlements?.usage.targets.current} / {(entitlements?.usage.targets.max ?? 0) >= 999999 ? '∞ Unlimited' : (entitlements?.usage.targets.max ?? 0)}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${entitlements?.usage.targets.percentage || 0}%`,
                  height: '100%',
                  backgroundColor:
                    (entitlements?.usage.targets.percentage || 0) >= 100
                      ? '#ef4444'
                      : (entitlements?.usage.targets.percentage || 0) >= 80
                      ? '#f59e0b'
                      : '#10b981',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Perimeter domains & web applications actively registered
            </div>
          </div>

          {/* Monthly Scans */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                MONTHLY SCANS (UTC)
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {entitlements?.usage.monthlyScans.current} / {(entitlements?.usage.monthlyScans.max ?? 0) >= 999999 ? '∞ Unlimited' : (entitlements?.usage.monthlyScans.max ?? 0)}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${entitlements?.usage.monthlyScans.percentage || 0}%`,
                  height: '100%',
                  backgroundColor:
                    (entitlements?.usage.monthlyScans.percentage || 0) >= 100
                      ? '#ef4444'
                      : (entitlements?.usage.monthlyScans.percentage || 0) >= 80
                      ? '#f59e0b'
                      : '#3b82f6',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Resets at beginning of each calendar month (UTC)
            </div>
          </div>

          {/* Team Seats */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                TEAM MEMBERS
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                {entitlements?.usage.teamMembers.current} / {(entitlements?.usage.teamMembers.max ?? 0) >= 999999 ? '∞ Unlimited' : (entitlements?.usage.teamMembers.max ?? 0)}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${entitlements?.usage.teamMembers.percentage || 0}%`,
                  height: '100%',
                  backgroundColor: '#8b5cf6',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Collaborators with role-based access control
            </div>
          </div>
        </div>
      </div>

      {/* Plan Switcher Toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
        <button
          onClick={() => setBillingCycle('MONTHLY')}
          style={{
            backgroundColor: billingCycle === 'MONTHLY' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Monthly Billing
        </button>
        <button
          onClick={() => setBillingCycle('YEARLY')}
          style={{
            backgroundColor: billingCycle === 'YEARLY' ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: 'none',
            padding: '0.6rem 1.25rem',
            borderRadius: '999px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>Annual Billing</span>
          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: '#10b981', color: '#fff', borderRadius: '4px' }}>
            SAVE ~17%
          </span>
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
        Additional scan credits: <strong>{entitlements?.scanCredits ?? 0}</strong>. Credits apply after your monthly allowance and do not unlock other plan features.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '1.5rem' }}>
        {(['STARTER', 'PRO', 'TEAM', 'ENTERPRISE'] as const).map((id) => {
          const plan = PLANS[id];
          const current = currentSub?.planId === id;
          const custom = id === 'ENTERPRISE';
          const amount = billingCycle === 'YEARLY' ? plan.pricing.yearlyInr : plan.pricing.monthlyInr;
          return <section key={id} style={{ padding: '1.5rem', border: `1px solid ${current ? 'var(--accent-primary)' : 'var(--border-subtle)'}`, borderRadius: '12px', background: 'var(--bg-card)' }}>
            <h2>{plan.name}</h2>
            <p>{plan.tagline}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{custom ? 'Custom pricing' : formatRupees(amount)}{!custom && amount > 0 ? (billingCycle === 'YEARLY' ? ' / year' : ' / month') : ''}</p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
              <li>{plan.limits.maxSites} targets</li>
              <li>{plan.limits.maxMonthlyScans} scans each month</li>
              <li>{plan.limits.maxTeamMembers} team members</li>
              <li>{plan.limits.historyDays} days of history</li>
              <li>{plan.features.activeVerifiedTests ? 'Active tests on verified targets' : 'Passive security checks'}</li>
              {plan.features.ciGates && <li>CI quality gates and SARIF</li>}
              {plan.features.scheduledScans && <li>Scheduled scanning</li>}
            </ul>
            {current ? <p><strong>Current tier</strong></p> : id === 'PRO' || id === 'TEAM' ?
              <button type="button" disabled={actionLoading !== null} onClick={() => handleUpgrade(id)} style={{ padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>
                {actionLoading === `upgrade-${id}` ? 'Opening checkout…' : `Choose ${plan.name}`}
              </button> : <a href={custom ? `mailto:${CONTACT_EMAIL}?subject=Enterprise%20plan` : '#'} onClick={custom ? undefined : (event) => { event.preventDefault(); handleOpenPortal(); }}>
                {custom ? 'Discuss Enterprise' : 'Manage plan in billing portal'}
              </a>}
          </section>;
        })}
      </div>
    </div>
  );
}
