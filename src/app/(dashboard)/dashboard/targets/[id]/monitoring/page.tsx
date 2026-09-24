'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { Target } from '@/core/targets/target-service';
import { ScanScheduleRecord } from '@/core/scheduler/schedule-repository';
import { MonitoringAlertRecord, TargetSecurityTrend } from '@/core/monitoring/monitoring-repository';
import { ScheduleFrequency } from '@/core/scheduler/cron-evaluator';
import { ScanMode } from '@/core/scanner/checks/types';

export default function TargetMonitoringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [target, setTarget] = useState<Target | null>(null);
  const [trends, setTrends] = useState<TargetSecurityTrend[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlertRecord[]>([]);
  const [schedules, setSchedules] = useState<ScanScheduleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Form state for creating schedule
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [scheduleName, setScheduleName] = useState('');
  const [frequency, setFrequency] = useState<ScheduleFrequency>('DAILY');
  const [customCron, setCustomCron] = useState('0 2 * * *');
  const [scanMode, setScanMode] = useState<ScanMode>('PUBLIC_PASSIVE');
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Trigger running state
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  const fetchMonitoringData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/targets/${id}/monitoring`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch monitoring data');
      }

      setTarget(data.data.target);
      setTrends(data.data.trends || []);
      setAlerts(data.data.alerts || []);
      setSchedules(data.data.schedules || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMonitoringData();
  }, [fetchMonitoringData]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target.id,
          name: scheduleName.trim() || `${frequency} Security Scan`,
          frequency,
          customCron: frequency === 'CUSTOM' ? customCron : undefined,
          scanMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create scan schedule');
      }

      setActionSuccess('Schedule successfully created!');
      setShowCreateModal(false);
      setScheduleName('');
      setTimeout(() => setActionSuccess(null), 3500);
      await fetchMonitoringData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSchedule = async (schedule: ScanScheduleRecord) => {
    try {
      const res = await fetch(`/api/schedules/${schedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !schedule.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update schedule');
      }
      await fetchMonitoringData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this scan schedule?')) return;
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete schedule');
      }
      await fetchMonitoringData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTriggerNow = async (scheduleId: string) => {
    try {
      setRunningScheduleId(scheduleId);
      const res = await fetch(`/api/schedules/${scheduleId}/run`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger scan run');
      }
      setActionSuccess('Scheduled scan successfully triggered!');
      setTimeout(() => setActionSuccess(null), 3500);
      await fetchMonitoringData();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      await fetchMonitoringData();
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Loading continuous monitoring engine...
      </div>
    );
  }

  if (error && !target) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
        <Link href="/dashboard/targets" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
          ← Back to Targets
        </Link>
      </div>
    );
  }

  const isVerified = target?.verificationStatus === 'VERIFIED';
  const latestScore = trends.length > 0 ? trends[trends.length - 1]?.score : target ? 100 : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1100px' }}>
      {/* Header & Breadcrumb */}
      <div>
        <Link
          href="/dashboard/targets"
          style={{
            color: 'var(--text-muted)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            marginBottom: '0.75rem',
          }}
        >
          ← Back to Targets
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
              {target?.targetUrl}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Hostname: <code style={{ color: 'var(--accent-primary)' }}>{target?.hostname}</code> • Continuous Security Monitoring
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isVerified ? (
              <span
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                ✓ VERIFIED TARGET
              </span>
            ) : (
              <span
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fbbf24',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}
              >
                ⚠️ UNVERIFIED
              </span>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              + Create Schedule
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <Link
            href={`/dashboard/targets/${id}`}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            Verification Center
          </Link>
          <Link
            href={`/dashboard/targets/${id}/surface`}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            Attack Surface Map ↗
          </Link>
          <span
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
          >
            Continuous Monitoring
          </span>
          <Link
            href={`/dashboard/targets/${id}/ci-cd`}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            CI/CD & Integrations ↗
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          ✓ {actionSuccess}
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          ⚠ {error}
        </div>
      )}

      {/* KPI Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Latest Security Score</div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: (latestScore ?? 100) >= 80 ? '#34d399' : (latestScore ?? 100) >= 60 ? '#fbbf24' : '#f87171' }}>
            {latestScore ?? '—'} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {trends.length} recorded scan baseline(s)
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Active Schedules</div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: 'var(--accent-primary)' }}>
            {schedules.filter((s) => s.isActive).length} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ {schedules.length}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Automated recurring frequency
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Open Regression Alerts</div>
          <div style={{ fontSize: '2.25rem', fontWeight: 700, color: alerts.filter((a) => !a.isRead).length > 0 ? '#f87171' : 'var(--text-primary)' }}>
            {alerts.filter((a) => !a.isRead).length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Unacknowledged posture regressions
          </div>
        </div>
      </div>

      {/* Security Score History & Trendline */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>
          Historical Security Posture Timeline
        </h2>
        {trends.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem 0' }}>
            No historical completed scans found for this target. Run a scan or set up a recurring schedule to generate security baselines.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {trends.slice().reverse().map((t, idx) => (
              <div
                key={t.scanId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '1rem',
                      backgroundColor: t.score >= 80 ? 'rgba(16, 185, 129, 0.15)' : t.score >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: t.score >= 80 ? '#34d399' : t.score >= 60 ? '#fbbf24' : '#f87171',
                    }}
                  >
                    {t.score}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {new Date(t.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Mode: <strong>{t.scanMode}</strong> • {t.totalFindings} findings (
                      <span style={{ color: '#f87171' }}>{t.criticalCount} crit</span>,{' '}
                      <span style={{ color: '#fb923c' }}>{t.highCount} high</span>,{' '}
                      <span style={{ color: '#fbbf24' }}>{t.mediumCount} med</span>)
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {idx === 0 && (
                    <span style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--accent-primary)', color: '#fff', fontWeight: 600 }}>
                      LATEST
                    </span>
                  )}
                  <Link
                    href={`/dashboard/scans/${t.scanId}`}
                    style={{ color: 'var(--accent-primary)', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 600 }}
                  >
                    View Report ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scan Schedules Table */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>
            Scheduled Automated Scans
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--accent-primary)',
              border: '1px solid var(--accent-primary)',
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            + Add Schedule
          </button>
        </div>

        {schedules.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No recurring scan schedules configured for this target. Click "+ Add Schedule" to automate continuous scanning.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {schedules.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  opacity: s.isActive ? 1 : 0.65,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{s.name}</span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: s.scanMode === 'VERIFIED_ACTIVE' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                        color: s.scanMode === 'VERIFIED_ACTIVE' ? '#f87171' : '#60a5fa',
                      }}
                    >
                      {s.scanMode}
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      {s.frequency}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Cron: <code>{s.cronExpression}</code> • Next Run: <strong>{new Date(s.nextRunAt).toLocaleString()}</strong>
                    {s.lastRunAt && ` • Last Run: ${new Date(s.lastRunAt).toLocaleString()}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleTriggerNow(s.id)}
                    disabled={runningScheduleId === s.id}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#fff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: runningScheduleId === s.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {runningScheduleId === s.id ? 'Running...' : 'Run Now ⚡'}
                  </button>

                  <button
                    onClick={() => handleToggleSchedule(s)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    {s.isActive ? 'Pause' : 'Resume'}
                  </button>

                  <button
                    onClick={() => handleDeleteSchedule(s.id)}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      color: '#f87171',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      cursor: 'pointer',
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Regression & Monitoring Alerts */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>
          Security Regression & Posture Alerts
        </h2>
        {alerts.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem 0' }}>
            ✓ Zero alerts detected. Target security posture is stable.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  backgroundColor: alert.isRead ? 'var(--bg-secondary)' : 'rgba(239, 68, 68, 0.05)',
                  borderRadius: 'var(--radius-md)',
                  border: alert.isRead ? '1px solid var(--border-color)' : '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: alert.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.2)' : alert.severity === 'HIGH' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                        color: alert.severity === 'CRITICAL' ? '#f87171' : alert.severity === 'HIGH' ? '#fb923c' : '#fbbf24',
                      }}
                    >
                      {alert.severity}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{alert.title}</span>
                    {!alert.isRead && (
                      <span style={{ backgroundColor: '#f87171', color: '#fff', fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '9999px', fontWeight: 700 }}>
                        NEW
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0.25rem 0' }}>
                    {alert.message}
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Type: <code>{alert.alertType}</code> • {new Date(alert.createdAt).toLocaleString()}
                  </div>
                </div>

                {!alert.isRead && (
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Schedule Modal */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              maxWidth: '500px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              Configure Automated Scan Schedule
            </h3>

            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Schedule Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Daily Production Security Audit"
                  value={scheduleName}
                  onChange={(e) => setScheduleName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Scan Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="DAILY">Daily (02:00 UTC)</option>
                  <option value="WEEKLY">Weekly (Monday 03:00 UTC)</option>
                  <option value="BIWEEKLY">Bi-Weekly (1st & 15th 03:00 UTC)</option>
                  <option value="MONTHLY">Monthly (1st of month 04:00 UTC)</option>
                  <option value="CUSTOM">Custom Cron Expression</option>
                </select>
              </div>

              {frequency === 'CUSTOM' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Custom Cron Expression (UTC)
                  </label>
                  <input
                    type="text"
                    placeholder="*/30 * * * *"
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.8rem',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                    }}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Standard 5-part format: <code>minute hour dom month dow</code>
                  </span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                  Scan Mode Profile
                </label>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setScanMode('PUBLIC_PASSIVE')}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 'var(--radius-md)',
                      border: scanMode === 'PUBLIC_PASSIVE' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      backgroundColor: scanMode === 'PUBLIC_PASSIVE' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Public Passive Scan
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isVerified) {
                        alert('Active scans require verified domain ownership (ADR-0008). Verify this target first.');
                        return;
                      }
                      setScanMode('VERIFIED_ACTIVE');
                    }}
                    style={{
                      flex: 1,
                      padding: '0.6rem',
                      borderRadius: 'var(--radius-md)',
                      border: scanMode === 'VERIFIED_ACTIVE' ? '2px solid #f87171' : '1px solid var(--border-color)',
                      backgroundColor: scanMode === 'VERIFIED_ACTIVE' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
                      color: isVerified ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: isVerified ? 'pointer' : 'not-allowed',
                      opacity: isVerified ? 1 : 0.5,
                    }}
                  >
                    Full Active Scan {isVerified ? '✓' : '🔒'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {submitting ? 'Saving...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
