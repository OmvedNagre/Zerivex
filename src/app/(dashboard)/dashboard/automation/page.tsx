'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  Lock,
  Plus,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getScanModeLabel } from '@/lib/labels';

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'gates'>('schedules');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [targets, setTargets] = useState<any[]>([]);
  const [qualityGatePolicy, setQualityGatePolicy] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [schedulesRes, targetsRes, qgRes] = await Promise.allSettled([
        fetch('/api/schedules').then((r) => r.json()),
        fetch('/api/targets').then((r) => r.json()),
        fetch('/api/quality-gates').then((r) => r.json()),
      ]);

      if (schedulesRes.status === 'fulfilled' && schedulesRes.value?.success) {
        setSchedules(schedulesRes.value.data?.schedules || []);
      }
      if (targetsRes.status === 'fulfilled' && targetsRes.value?.success) {
        setTargets(targetsRes.value.data?.targets || []);
      }
      if (qgRes.status === 'fulfilled' && qgRes.value?.success) {
        setQualityGatePolicy(qgRes.value.data?.policy || null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load automation items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Header (eyebrow -> H1 -> subtitle -> brand CTA) */}
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
            Automation
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
            Schedules &amp; CI Gates
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--ds-text-secondary)',
              margin: 0,
              maxWidth: '620px',
            }}
          >
            Automate recurring perimeter scans and enforce security thresholds directly inside pull requests.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={fetchData} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
          <Button
            variant="brand"
            href="/dashboard/targets"
            icon={<Plus size={16} />}
          >
            Configure Target
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--ds-border-subtle)',
          gap: '24px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          style={{
            padding: '12px 4px',
            fontSize: '14px',
            fontWeight: activeTab === 'schedules' ? 700 : 500,
            color: activeTab === 'schedules' ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
            border: 'none',
            borderBottom: activeTab === 'schedules' ? '2px solid var(--ds-action-brand)' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Clock size={16} />
          <span>Schedules ({schedules.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gates')}
          style={{
            padding: '12px 4px',
            fontSize: '14px',
            fontWeight: activeTab === 'gates' ? 700 : 500,
            color: activeTab === 'gates' ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
            border: 'none',
            borderBottom: activeTab === 'gates' ? '2px solid var(--ds-action-brand)' : '2px solid transparent',
            background: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Lock size={16} />
          <span>CI Quality Gates</span>
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-danger-bg)',
            border: '1px solid rgba(209, 0, 47, 0.25)',
            color: 'var(--ds-danger)',
            fontSize: '13.5px',
          }}
        >
          {error}
        </div>
      )}

      {/* Content Area */}
      {loading ? (
        <div
          style={{
            padding: '48px',
            textAlign: 'center',
            backgroundColor: 'var(--ds-bg-card)',
            borderRadius: 'var(--ds-radius-lg)',
            border: '1px solid var(--ds-border-subtle)',
            color: 'var(--ds-text-muted)',
          }}
        >
          Loading automation settings...
        </div>
      ) : activeTab === 'schedules' ? (
        schedules.length === 0 ? (
          <div
            style={{
              padding: '64px 32px',
              textAlign: 'center',
              backgroundColor: 'var(--ds-bg-card)',
              borderRadius: 'var(--ds-radius-lg)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
            }}
          >
            <Clock size={36} style={{ color: 'var(--ds-text-muted)', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 8px', color: 'var(--ds-text-primary)' }}>
              No scheduled scans configured
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--ds-text-secondary)', maxWidth: '460px', margin: '0 auto 20px' }}>
              Set up automated daily or weekly security audits to detect newly exposed credentials and configuration drift.
            </p>
            <Button variant="secondary" href="/dashboard/targets">
              Select a target to schedule
            </Button>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--ds-bg-card)',
              borderRadius: 'var(--ds-radius-lg)',
              border: '1px solid var(--ds-border-subtle)',
              overflow: 'hidden',
              boxShadow: 'var(--ds-shadow-1)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ds-border-subtle)', backgroundColor: 'var(--ds-bg-subtle)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--ds-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Schedule Name
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--ds-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Frequency
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--ds-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Mode
                  </th>
                  <th style={{ padding: '14px 20px', fontWeight: 700, color: 'var(--ds-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Status
                  </th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontWeight: 700, color: 'var(--ds-text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {schedules.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid var(--ds-border-subtle)' }}>
                    <td style={{ padding: '16px 20px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                      {s.name || 'Automated Scan'}
                    </td>
                    <td style={{ padding: '16px 20px', color: 'var(--ds-text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12.5px' }}>
                      {s.frequency || 'WEEKLY'}
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ds-text-secondary)' }}>
                        {getScanModeLabel(s.scanMode || 'PUBLIC_PASSIVE')}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: s.enabled ? 'var(--ds-success)' : 'var(--ds-text-muted)', fontWeight: 600 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: s.enabled ? 'var(--ds-success)' : 'var(--ds-text-muted)' }} />
                        {s.enabled ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <Link
                        href={`/dashboard/targets/${s.targetId}/monitoring`}
                        style={{ fontSize: '12.5px', color: 'var(--ds-text-link)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* Quality Gates Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              padding: '24px',
              backgroundColor: 'var(--ds-bg-card)',
              borderRadius: 'var(--ds-radius-lg)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px', color: 'var(--ds-text-primary)' }}>
                  Organization Quality Gate Policy
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--ds-text-secondary)', margin: 0 }}>
                  Enforced when scans run in CI Gate mode (`ZX_CLI_SCAN`).
                </p>
              </div>

              {qualityGatePolicy ? (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--ds-radius-pill)',
                    backgroundColor: 'var(--ds-success-bg)',
                    color: 'var(--ds-success)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  ARMED
                </span>
              ) : (
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--ds-radius-pill)',
                    backgroundColor: 'var(--ds-bg-subtle)',
                    color: 'var(--ds-text-muted)',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                >
                  NOT CONFIGURED
                </span>
              )}
            </div>

            {qualityGatePolicy ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '16px' }}>
                <div style={{ padding: '14px', borderRadius: 'var(--ds-radius-md)', backgroundColor: 'var(--ds-bg-subtle)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Min Score Threshold
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ds-text-primary)', marginTop: '4px' }}>
                    {qualityGatePolicy.minSecurityScore ?? 80} / 100
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: 'var(--ds-radius-md)', backgroundColor: 'var(--ds-bg-subtle)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Block on Critical
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: qualityGatePolicy.failOnCritical ? 'var(--ds-danger)' : 'var(--ds-text-muted)', marginTop: '8px' }}>
                    {qualityGatePolicy.failOnCritical ? 'Enforced (Exit 1)' : 'Allowed'}
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: 'var(--ds-radius-md)', backgroundColor: 'var(--ds-bg-subtle)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Max High Issues
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ds-text-primary)', marginTop: '4px' }}>
                    {qualityGatePolicy.maxHighFindings ?? 0}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px 0', color: 'var(--ds-text-muted)', fontSize: '13.5px' }}>
                No custom gate policy saved. Set one up to automatically fail GitHub Actions / CI runs on critical defects.
              </div>
            )}
          </div>

          {/* Targets with CI Integration list */}
          <div
            style={{
              padding: '24px',
              backgroundColor: 'var(--ds-bg-card)',
              borderRadius: 'var(--ds-radius-lg)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
            }}
          >
            <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: 'var(--ds-text-primary)' }}>
              Configure CI/CD Per Target
            </h3>
            {targets.length === 0 ? (
              <div style={{ color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                No sites registered yet. <Link href="/dashboard/targets?new=true" style={{ color: 'var(--ds-action-brand)' }}>Add a site</Link> to configure CI gates.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {targets.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: 'var(--ds-radius-md)',
                      border: '1px solid var(--ds-border-subtle)',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                        {t.hostname || t.targetUrl}
                      </div>
                      <div style={{ fontSize: '11.5px', color: 'var(--ds-text-muted)' }}>
                        {t.targetUrl}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/targets/${t.id}/ci-cd`}
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--ds-text-link)',
                        fontWeight: 600,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <span>CI/CD Setup</span>
                      <ExternalLink size={13} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
