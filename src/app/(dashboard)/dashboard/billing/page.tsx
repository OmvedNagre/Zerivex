'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

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
  id: 'FREE_DEVELOPER' | 'TEAM_PRO' | 'ENTERPRISE';
  name: string;
  tagline: string;
  badge?: string;
  pricing: PlanPricing;
  limits: PlanLimits;
  features: PlanFeatures;
}

interface SubscriptionRecord {
  id: string;
  planId: 'FREE_DEVELOPER' | 'TEAM_PRO' | 'ENTERPRISE';
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
      if (urlParams.get('session_id') || urlParams.get('mock_checkout') === 'success') {
        const upgradedPlan = urlParams.get('plan') || 'TEAM_PRO';
        setFeedback({
          type: 'success',
          message: `Subscription successfully updated to ${upgradedPlan}! Your enterprise quotas are active.`,
        });
      } else if (urlParams.get('canceled') === 'true') {
        setFeedback({
          type: 'error',
          message: 'Checkout was canceled. Your current subscription tier remains unchanged.',
        });
      } else if (urlParams.get('portal_simulated') === 'true') {
        setFeedback({
          type: 'success',
          message: 'Simulated Customer Portal: Invoices, payment methods, and billing details managed.',
        });
      }
    }
  }, []);

  const handleUpgrade = async (planId: 'TEAM_PRO' | 'ENTERPRISE') => {
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
              <span>💳</span>
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
          <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
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
            🛡️
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

      {/* Pricing Matrix in INR (₹) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {/* FREE DEVELOPER */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: currentSub?.planId === 'FREE_DEVELOPER' ? '2px solid #3b82f6' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {currentSub?.planId === 'FREE_DEVELOPER' && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                right: '24px',
                backgroundColor: '#3b82f6',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              CURRENT PLAN
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Free Developer
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', minHeight: '38px' }}>
              Essential perimeter reconnaissance for individual developers & security enthusiasts.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹0</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>/ month</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Free forever • No credit card required
            </div>
          </div>

          <div style={{ flex: 1, borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              INCLUDED QUOTAS:
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 1 Verified Target
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 10 Monthly Scans
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 1 Team Member Seat
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> Public Passive Scans
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <span>✕</span> Deep Active Vulnerability Scanning
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <span>✕</span> Attack Surface Route Crawler
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                <span>✕</span> CI/CD & API Keys
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 7-Day Log Retention
              </li>
            </ul>
          </div>

          <button
            disabled={currentSub?.planId === 'FREE_DEVELOPER'}
            style={{
              backgroundColor: currentSub?.planId === 'FREE_DEVELOPER' ? 'rgba(255, 255, 255, 0.05)' : 'var(--accent-primary)',
              color: currentSub?.planId === 'FREE_DEVELOPER' ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: currentSub?.planId === 'FREE_DEVELOPER' ? 'default' : 'pointer',
            }}
          >
            {currentSub?.planId === 'FREE_DEVELOPER' ? 'Current Tier' : 'Downgrade to Free'}
          </button>
        </div>

        {/* TEAM PRO */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: currentSub?.planId === 'TEAM_PRO' ? '2px solid #10b981' : '1px solid rgba(59, 130, 246, 0.4)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '24px',
              backgroundColor: '#10b981',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              letterSpacing: '0.05em',
            }}
          >
            MOST POPULAR
          </div>

          {currentSub?.planId === 'TEAM_PRO' && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                right: '24px',
                backgroundColor: '#10b981',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              CURRENT PLAN
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Team Pro
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', minHeight: '38px' }}>
              Deep active scanning, automated crawlers, and CI/CD quality gates for agile security teams.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {billingCycle === 'YEARLY' ? formatRupees(39990) : formatRupees(3999)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {billingCycle === 'YEARLY' ? '/ year' : '/ month'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '0.25rem' }}>
              {billingCycle === 'YEARLY' ? '₹3,332/mo billed annually (Save ₹7,998/yr)' : 'Billed monthly in INR'}
            </div>
          </div>

          <div style={{ flex: 1, borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              EVERYTHING IN FREE, PLUS:
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> <strong>5 Verified Targets</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> <strong>250 Monthly Scans</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> <strong>5 Team Member Seats</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> Deep Active Scanning (SQLi, XSS, CSRF, SSRF)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> Attack Surface Route Crawler & Tech Fingerprinting
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> CI/CD Integrations, API Keys & Webhooks
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> Finding Collaboration (Comments & Assignees)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#10b981' }}>✓</span> 30-Day Audit & Finding Retention
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleUpgrade('TEAM_PRO')}
            disabled={currentSub?.planId === 'TEAM_PRO' || actionLoading === 'upgrade-TEAM_PRO'}
            style={{
              backgroundColor: currentSub?.planId === 'TEAM_PRO' ? 'rgba(255, 255, 255, 0.05)' : '#3b82f6',
              color: currentSub?.planId === 'TEAM_PRO' ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: currentSub?.planId === 'TEAM_PRO' ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {actionLoading === 'upgrade-TEAM_PRO'
              ? 'Opening Checkout...'
              : currentSub?.planId === 'TEAM_PRO'
              ? 'Current Tier'
              : 'Upgrade to Team Pro'}
          </button>
        </div>

        {/* ENTERPRISE */}
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: currentSub?.planId === 'ENTERPRISE' ? '2px solid #8b5cf6' : '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-12px',
              left: '24px',
              backgroundColor: '#8b5cf6',
              color: '#fff',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              letterSpacing: '0.05em',
            }}
          >
            ENTERPRISE COMPLIANCE
          </div>

          {currentSub?.planId === 'ENTERPRISE' && (
            <div
              style={{
                position: 'absolute',
                top: '-12px',
                right: '24px',
                backgroundColor: '#8b5cf6',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                letterSpacing: '0.05em',
              }}
            >
              CURRENT PLAN
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Enterprise
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem', minHeight: '38px' }}>
              Continuous monitoring, cryptographic audit vaults, and unlimited scale for mission-critical security.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {billingCycle === 'YEARLY' ? formatRupees(199990) : formatRupees(19999)}
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {billingCycle === 'YEARLY' ? '/ year' : '/ month'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#c084fc', marginTop: '0.25rem' }}>
              {billingCycle === 'YEARLY' ? '₹16,665/mo billed annually (Save ₹39,998/yr)' : 'Billed monthly in INR'}
            </div>
          </div>

          <div style={{ flex: 1, borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              EVERYTHING IN TEAM PRO, PLUS:
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> <strong>Unlimited Verified Targets</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> <strong>Unlimited Monthly Scans</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> <strong>Unlimited Team Members</strong>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> Continuous Security Monitoring & Score Regression
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> Cryptographic Compliance Audit Vault (CSV/SIEM)
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> Monotonic SHA-256 Chain Verification
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> Priority Remediation SLAs & Dedicated Support
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#8b5cf6' }}>✓</span> 365-Day Extended Log Retention
              </li>
            </ul>
          </div>

          <button
            onClick={() => handleUpgrade('ENTERPRISE')}
            disabled={currentSub?.planId === 'ENTERPRISE' || actionLoading === 'upgrade-ENTERPRISE'}
            style={{
              backgroundColor: currentSub?.planId === 'ENTERPRISE' ? 'rgba(255, 255, 255, 0.05)' : '#8b5cf6',
              color: currentSub?.planId === 'ENTERPRISE' ? 'var(--text-muted)' : '#fff',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: currentSub?.planId === 'ENTERPRISE' ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {actionLoading === 'upgrade-ENTERPRISE'
              ? 'Opening Checkout...'
              : currentSub?.planId === 'ENTERPRISE'
              ? 'Current Tier'
              : 'Upgrade to Enterprise'}
          </button>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Feature & Capability Comparison
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Transparent specifications for every tier. All pricing calculated in Indian Rupees (₹).
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '0.9rem 1.5rem', color: 'var(--text-muted)', fontWeight: 600 }}>Capability / Resource</th>
                <th style={{ padding: '0.9rem 1.5rem', color: 'var(--text-primary)', fontWeight: 600 }}>Free Developer (₹0)</th>
                <th style={{ padding: '0.9rem 1.5rem', color: '#60a5fa', fontWeight: 600 }}>Team Pro (₹3,999/mo)</th>
                <th style={{ padding: '0.9rem 1.5rem', color: '#c084fc', fontWeight: 600 }}>Enterprise (₹19,999/mo)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Verified Targets</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>1 Target</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>5 Targets</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Monthly Scans</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>10 / mo</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>250 / mo</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Team Members</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>1 Seat</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>5 Seats</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>Unlimited</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Scan Modes</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>Passive Recon</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>Passive + Deep Active</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>All Modes + Custom Profiles</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Attack Surface Crawler</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ padding: '0.8rem 1.5rem', color: '#10b981' }}>Included</td>
                <td style={{ padding: '0.8rem 1.5rem', color: '#10b981' }}>Included</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>CI/CD Quality Gates & API Keys</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ padding: '0.8rem 1.5rem', color: '#10b981' }}>Included</td>
                <td style={{ padding: '0.8rem 1.5rem', color: '#10b981' }}>Included</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Continuous Security Monitoring</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>Weekly Cadence</td>
                <td style={{ padding: '0.8rem 1.5rem', color: '#10b981' }}>Hourly / Daily + Regression Alerts</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Cryptographic Compliance Audit Vault</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-muted)' }}>—</td>
                <td style={{ padding: '0.8rem 1.5rem', color: '#10b981' }}>RFC 4180 CSV & SIEM JSON</td>
              </tr>
              <tr>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-primary)', fontWeight: 500 }}>Log & Audit Retention</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>7 Days</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>30 Days</td>
                <td style={{ padding: '0.8rem 1.5rem', color: 'var(--text-secondary)' }}>365 Days</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
