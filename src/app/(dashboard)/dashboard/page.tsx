'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import * as Popover from '@radix-ui/react-popover';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { QuickScanLauncher } from '@/components/dashboard/QuickScanLauncher';
import { FirstRunChecklist, ChecklistState } from '@/components/dashboard/FirstRunChecklist';
import { FrameworkRemediationModal } from '@/components/dashboard/FrameworkRemediationModal';
import { SeverityBadge } from '@/components/dashboard/SeverityBadge';
import { getRemediationForRule, RuleRemediation } from '@/core/remediation/remediation-catalog';
import {
  adaptOverview,
  adaptNextBestAction,
  OverviewData,
  NextBestAction,
} from '@/adapters/dashboard-adapters';
import { getScanModeLabel, getScanStatusLabel } from '@/lib/labels';

export default function DashboardOverviewPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [nextAction, setNextAction] = useState<NextBestAction | null>(null);

  const [checklistState, setChecklistState] = useState<ChecklistState>({
    hasTarget: false,
    hasVerifiedTarget: false,
    hasCompletedScan: false,
    hasFixedFinding: false,
    hasCiGate: false,
  });

  // Framework remediation modal state
  const [selectedFindingForFix, setSelectedFindingForFix] = useState<any | null>(null);
  const [remediationData, setRemediationData] = useState<RuleRemediation | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [targetsRes, findingsRes, scansRes, qgRes, healthRes] =
        await Promise.allSettled([
          fetch('/api/targets').then((r) => r.json()),
          fetch('/api/findings').then((r) => r.json()),
          fetch('/api/scans').then((r) => r.json()),
          fetch('/api/quality-gates').then((r) => r.json()),
          fetch('/api/health').then((r) => r.json()),
        ]);

      let targetsList: any[] = [];
      let findingsList: any[] = [];
      let scansList: any[] = [];
      let qgData: any = null;
      let healthData: any = null;

      if (targetsRes.status === 'fulfilled' && targetsRes.value?.success) {
        targetsList = targetsRes.value.data?.targets || [];
      }
      if (findingsRes.status === 'fulfilled' && findingsRes.value?.success) {
        findingsList = findingsRes.value.data?.findings || [];
      }
      if (scansRes.status === 'fulfilled' && scansRes.value?.success) {
        scansList = scansRes.value.data?.scans || [];
      }
      if (qgRes.status === 'fulfilled' && qgRes.value?.success) {
        qgData = qgRes.value.data;
      }
      if (healthRes.status === 'fulfilled') {
        healthData = healthRes.value;
      }

      // 1. Adapt overview data with pure truthfulness adapter
      const adapted = adaptOverview({
        targets: targetsList,
        scans: scansList,
        findings: findingsList,
        qualityGate: qgData,
        health: healthData,
      });

      if (adapted.status === 'error') {
        setError(adapted.error || 'Failed to load dashboard data');
      } else {
        setOverviewData(adapted.data || null);
      }

      // 2. Next Best Action
      const nba = adaptNextBestAction({
        targets: targetsList,
        scans: scansList,
        findings: findingsList,
        qualityGatePolicy: qgData?.policy,
      });
      setNextAction(nba);

      // 3. Checklist state
      setChecklistState({
        hasTarget: targetsList.length > 0,
        hasVerifiedTarget: targetsList.some((t: any) => t.verificationStatus === 'VERIFIED'),
        hasCompletedScan: scansList.some((s: any) => s.status === 'COMPLETED'),
        hasFixedFinding: findingsList.some((f: any) => f.status === 'FIXED'),
        hasCiGate: Boolean(qgData?.policy),
      });
    } catch (err: any) {
      setError(err.message || 'Network error occurred while fetching dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleOpenFix = (finding: any) => {
    const rem = getRemediationForRule(finding.ruleId);
    setRemediationData(rem);
    setSelectedFindingForFix(finding);
  };

  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'there';
  const fleetScore = overviewData?.fleetScore;
  const hasScore = typeof fleetScore === 'number';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* 1. Page Header (eyebrow -> H1 -> subtitle -> scanner status dot) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ds-text-muted)',
              marginBottom: '6px',
            }}
          >
            Overview
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--ds-text-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 6px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Welcome back, {userDisplayName}
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--ds-text-secondary)',
              margin: 0,
            }}
          >
            Here&apos;s where your sites stand.
          </p>
        </div>

        {/* Engine Health Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: 'var(--ds-radius-pill)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--ds-text-secondary)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor:
                overviewData?.health?.status === 'nominal'
                  ? 'var(--ds-success)'
                  : overviewData?.health?.status === 'degraded'
                  ? 'var(--ds-warning)'
                  : overviewData?.health?.status === 'outage'
                  ? 'var(--ds-danger)'
                  : 'var(--ds-text-muted)',
            }}
          />
          <span>Scanner status: {overviewData?.health?.label || (loading ? 'Checking...' : 'Ready')}</span>
        </div>
      </div>

      {/* Error Banner with Retry */}
      {error && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-danger-bg)',
            border: '1px solid rgba(209, 0, 47, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--ds-danger)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13.5px' }}>
            <AlertTriangle size={18} />
            <span>Couldn&apos;t load dashboard data: {error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={loadDashboardData} icon={<RefreshCw size={13} />}>
            Retry
          </Button>
        </div>
      )}

      {/* 2. Next Best Action Card (strictly ordered per §A4) */}
      {nextAction && !loading && (
        <section
          aria-label="Next Best Action"
          style={{
            padding: '24px 28px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ maxWidth: '680px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--ds-action-brand)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '4px',
              }}
            >
              Recommended Next Step
            </div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--ds-text-primary)',
                margin: '0 0 6px',
              }}
            >
              {nextAction.title}
            </h2>
            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--ds-text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {nextAction.description}
            </p>
          </div>

          <Button
            variant="brand"
            href={nextAction.href}
            onClick={
              nextAction.actionId === 'fix_finding' && nextAction.findingId
                ? (e) => {
                    const f = overviewData?.topFixes?.find((item) => item.id === nextAction.findingId);
                    if (f) {
                      e.preventDefault();
                      handleOpenFix(f);
                    }
                  }
                : undefined
            }
            icon={<ArrowRight size={15} />}
          >
            {nextAction.cta}
          </Button>
        </section>
      )}

      {/* 3. First-Run Checklist (hides automatically when all 5 steps complete) */}
      <FirstRunChecklist state={checklistState} />

      {/* 4. Compact Quick Scan Launcher Bar */}
      <QuickScanLauncher />

      {/* 5. Main Dashboard Grid (Score + Top Fixes / Sites + Recent Scans) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Left Card: Security Score & Headline Status */}
        <div
          style={{
            padding: '28px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Header Row: Score Label & "How is this calculated?" Popover */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--ds-text-muted)',
              }}
            >
              Security Score
            </span>

            <Popover.Root>
              <Popover.Trigger asChild>
                <button
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: 'none',
                    background: 'none',
                    color: 'var(--ds-text-muted)',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  aria-label="How is this score calculated?"
                >
                  <Info size={14} />
                  <span>How is this calculated?</span>
                </button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  side="bottom"
                  align="end"
                  sideOffset={8}
                  style={{
                    width: '320px',
                    padding: '16px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'var(--ds-bg-card)',
                    border: '1px solid var(--ds-border-subtle)',
                    boxShadow: 'var(--ds-shadow-2)',
                    fontSize: '12.5px',
                    color: 'var(--ds-text-secondary)',
                    lineHeight: 1.5,
                    zIndex: 100,
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--ds-text-primary)', marginBottom: '6px' }}>
                    Deterministic Posture Formula
                  </div>
                  <div>
                    {overviewData?.scoreCalculationExplanation ||
                      'Security scores start at 100 per scan. Deductions are calculated per open issue: Critical -25, High -15, Medium -5, Low -2 (clamped 0–100). The fleet score is the arithmetic mean across verified sites.'}
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--ds-border-subtle)', fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                    Open issues matching OPEN, CONFIRMED, and REOPENED apply penalties.
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          {/* Score Presentation: Ring + Grade + Headline */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            {/* Score Ring */}
            <div style={{ position: 'relative', width: '100px', height: '100px', flexShrink: 0 }}>
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="var(--ds-bg-subtle)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={
                    !hasScore
                      ? 'var(--ds-border-default)'
                      : fleetScore >= 90
                      ? 'var(--ds-success)'
                      : fleetScore >= 70
                      ? 'var(--ds-warning)'
                      : 'var(--ds-danger)'
                  }
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={264}
                  strokeDashoffset={
                    !hasScore
                      ? 264
                      : 264 - (264 * fleetScore) / 100
                  }
                  transform="rotate(-90 50 50)"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: 'var(--ds-text-primary)',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1,
                  }}
                >
                  {hasScore ? fleetScore : '—'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--ds-text-muted)' }}>/ 100</span>
              </div>
            </div>

            {/* Headline and Grade Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 'var(--ds-radius-pill)',
                    backgroundColor: 'var(--ds-bg-subtle)',
                    color: 'var(--ds-text-primary)',
                    fontSize: '11px',
                    fontWeight: 800,
                    fontFamily: 'var(--font-mono)',
                    border: '1px solid var(--ds-border-subtle)',
                  }}
                >
                  GRADE {overviewData?.grade || '—'}
                </span>
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                {overviewData?.headlineTitle || 'Loading security posture...'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', lineHeight: 1.4 }}>
                {overviewData?.headlineDescription}
              </div>
            </div>
          </div>

          {/* Open Vulnerabilities Breakdown Cards */}
          <div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--ds-text-muted)',
                marginBottom: '10px',
              }}
            >
              Open Issues by Severity
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'CRIT', val: overviewData?.openFindings?.critical ?? 0, color: 'var(--ds-danger)' },
                { label: 'HIGH', val: overviewData?.openFindings?.high ?? 0, color: 'var(--ds-warning)' },
                { label: 'MED', val: overviewData?.openFindings?.medium ?? 0, color: 'var(--ds-info)' },
                { label: 'LOW', val: overviewData?.openFindings?.low ?? 0, color: 'var(--ds-text-secondary)' },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '10px',
                    borderRadius: 'var(--ds-radius-md)',
                    backgroundColor: 'var(--ds-bg-subtle)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 800,
                      color: item.val > 0 ? item.color : 'var(--ds-text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {item.val}
                  </div>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--ds-text-muted)', marginTop: '2px' }}>
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fix These First (Top 3 open findings deduped) */}
          <div style={{ borderTop: '1px solid var(--ds-border-subtle)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                Fix These First
              </span>
              <Link href="/dashboard/findings" style={{ fontSize: '12px', color: 'var(--ds-text-link)', textDecoration: 'none', fontWeight: 600 }}>
                View all findings →
              </Link>
            </div>

            {overviewData?.topFixes && overviewData.topFixes.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overviewData.topFixes.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--ds-radius-md)',
                      border: '1px solid var(--ds-border-subtle)',
                      backgroundColor: 'var(--ds-bg-card)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <SeverityBadge severity={f.severity} />
                        <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--ds-text-muted)' }}>
                          {f.ruleId}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.resourceEndpoint || f.targetUrl}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenFix(f)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 'var(--ds-radius-md)',
                        border: '1px solid var(--ds-border-default)',
                        backgroundColor: 'var(--ds-bg-card)',
                        color: 'var(--ds-text-primary)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      See fix
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '16px 0', color: 'var(--ds-text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} style={{ color: 'var(--ds-success)' }} />
                <span>Zero open critical or high defects detected.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sites Summary & Recent Scans */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Sites & Quality Gate Mini Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Sites Card */}
            <div
              style={{
                padding: '20px',
                borderRadius: 'var(--ds-radius-lg)',
                backgroundColor: 'var(--ds-bg-card)',
                border: '1px solid var(--ds-border-subtle)',
                boxShadow: 'var(--ds-shadow-1)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>
                Your Sites
              </div>
              <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-text-primary)', margin: '8px 0 2px' }}>
                {overviewData?.targetsCount || 0}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
                {overviewData?.verifiedTargetsCount || 0} verified
              </div>
              <Link
                href="/dashboard/targets"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ds-text-link)',
                  marginTop: '12px',
                  textDecoration: 'none',
                }}
              >
                <span>Manage sites</span>
                <ChevronRight size={13} />
              </Link>
            </div>

            {/* Quality Gate Card */}
            <div
              style={{
                padding: '20px',
                borderRadius: 'var(--ds-radius-lg)',
                backgroundColor: 'var(--ds-bg-card)',
                border: '1px solid var(--ds-border-subtle)',
                boxShadow: 'var(--ds-shadow-1)',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--ds-text-muted)' }}>
                CI Quality Gate
              </div>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 800,
                  color:
                    overviewData?.qualityGate?.status === 'PASSED'
                      ? 'var(--ds-success)'
                      : overviewData?.qualityGate?.status === 'FAILED'
                      ? 'var(--ds-danger)'
                      : 'var(--ds-text-muted)',
                  margin: '12px 0 4px',
                }}
              >
                {overviewData?.qualityGate?.label || (loading ? 'Checking...' : 'Not configured')}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)', lineHeight: 1.3 }}>
                {overviewData?.qualityGate?.description || (loading ? 'Loading automation status...' : 'No automated evaluation configured yet.')}
              </div>
              <Link
                href="/dashboard/automation"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--ds-text-link)',
                  marginTop: '12px',
                  textDecoration: 'none',
                }}
              >
                <span>Set up gate</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </div>

          {/* Recent Scans Card */}
          <div
            style={{
              padding: '24px',
              borderRadius: 'var(--ds-radius-lg)',
              backgroundColor: 'var(--ds-bg-card)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
              flex: 1,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                Recent Scans
              </span>
              <Link href="/dashboard/scans" style={{ fontSize: '12px', color: 'var(--ds-text-link)', textDecoration: 'none', fontWeight: 600 }}>
                View all scans →
              </Link>
            </div>

            {overviewData?.recentScans && overviewData.recentScans.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {overviewData.recentScans.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--ds-radius-md)',
                      border: '1px solid var(--ds-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                        {s.targetHostname}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>{getScanModeLabel(s.scanMode)}</span>
                        <span>•</span>
                        <span>{getScanStatusLabel(s.status)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 800,
                          fontFamily: 'var(--font-mono)',
                          color: s.score !== null ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
                        }}
                      >
                        {s.score !== null ? `${s.score}/100` : '—'}
                      </span>
                      <Link
                        href={`/dashboard/scans/${s.id}`}
                        style={{
                          color: 'var(--ds-text-link)',
                          fontSize: '12px',
                          fontWeight: 600,
                          textDecoration: 'none',
                        }}
                      >
                        Report
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                No scans executed yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 6. Multi-Framework Remediation Modal */}
      {selectedFindingForFix && (
        <FrameworkRemediationModal
          onClose={() => setSelectedFindingForFix(null)}
          finding={selectedFindingForFix}
          remediationData={remediationData}
          onVerifyFix={() => {}}
        />
      )}
    </div>
  );
}
