'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ScanJobRecord } from '@/core/scanner/scan-runner';
import { Target } from '@/core/targets/target-service';
import { ScanMode } from '@/core/scanner/checks/types';

export default function ScansPage() {
  const [scans, setScans] = useState<ScanJobRecord[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New scan modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('PUBLIC_PASSIVE');
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [scansRes, targetsRes] = await Promise.all([
        fetch('/api/scans'),
        fetch('/api/targets'),
      ]);

      const scansData = await scansRes.json();
      const targetsData = await targetsRes.json();

      if (!scansRes.ok) throw new Error(scansData.error || 'Failed to fetch scans');
      if (!targetsRes.ok) throw new Error(targetsData.error || 'Failed to fetch targets');

      setScans(scansData.data.scans || []);
      setTargets(targetsData.data.targets || []);
      if (targetsData.data.targets?.length > 0) {
        setSelectedTargetId(targetsData.data.targets[0].id);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLaunchScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunchError(null);
    setLaunching(true);

    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selectedTargetId,
          scanMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to launch scan');
      }

      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      setLaunchError((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);
  const isSelectedTargetVerified = selectedTarget?.verificationStatus === 'VERIFIED';

  const getScoreBadge = (score: number | null) => {
    if (score === null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;

    let badgeClass = 'cyber-badge-emerald';
    if (score < 50) {
      badgeClass = 'cyber-badge-red';
    } else if (score < 80) {
      badgeClass = 'cyber-badge-amber';
    }

    return (
      <span className={`cyber-badge ${badgeClass}`} style={{ fontFamily: 'var(--font-mono)' }}>
        {score} / 100
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="cyber-badge cyber-badge-emerald">
            ✓ COMPLETED
          </span>
        );
      case 'RUNNING':
        return (
          <span className="cyber-badge cyber-badge-cyan">
            <span style={{ display: 'inline-block', animation: 'spin 1.5s linear infinite' }}>⚙</span> RUNNING
          </span>
        );
      case 'FAILED':
        return (
          <span className="cyber-badge cyber-badge-red">
            ✗ FAILED
          </span>
        );
      default:
        return (
          <span className="cyber-badge cyber-badge-amber">
            ⏳ QUEUED
          </span>
        );
    }
  };

  const completedCount = scans.filter((s) => s.status === 'COMPLETED').length;
  const inFlightCount = scans.filter((s) => s.status === 'RUNNING' || s.status === 'QUEUED').length;
  const validScores = scans.filter((s) => s.score !== null).map((s) => s.score as number);
  const avgScore = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="pulse-indicator" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Deterministic Engine
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            Security Assessment Scans
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '650px' }}>
            Evidence-based vulnerability scanning engine for modern web endpoints, analyzing headers, TLS ciphers, leaked tokens, and cloud misconfigurations.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-cyber-primary"
          style={{ height: '42px' }}
        >
          <span>+</span> Launch New Scan
        </button>
      </div>

      {/* Metrics Ribbon */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Executions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {scans.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Historical scan runs recorded
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Completed Assessments
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>
            {completedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Deterministic reports generated
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active / Queued
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {inFlightCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Worker execution queue
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Fleet Mean Score
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#c4b5fd', marginTop: '0.25rem' }}>
            {avgScore}<span style={{ fontSize: '1rem', color: 'var(--text-dim)', fontWeight: 500 }}>/100</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Aggregate target baseline
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* Scans Table */}
      <div
        className="glass-panel"
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid rgba(59, 130, 246, 0.2)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: '1rem' }} />
            <div>Synchronizing scan execution records...</div>
          </div>
        ) : scans.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1.25rem' }}>
              🔬
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No scans executed yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              Launch your first security scan against a registered target to identify misconfigurations and vulnerabilities.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-cyber-primary"
            >
              + Launch First Scan
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Endpoint</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scan Mode</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Security Score</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Executed At</th>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action</th>
                </tr>
              </thead>
              <tbody>
              {scans.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.targetUrl}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.targetHostname}</div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.scanMode}</td>
                  <td style={{ padding: '1rem 1.25rem' }}>{getStatusBadge(s.status)}</td>
                  <td style={{ padding: '1rem 1.25rem' }}>{getScoreBadge(s.score)}</td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(s.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <Link
                      href={`/dashboard/scans/${s.id}`}
                      style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                        textDecoration: 'none',
                      }}
                    >
                      View Report →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Launch Scan Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: '540px',
              width: '100%',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Launch Security Scan</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {launchError && (
              <div
                style={{
                  padding: '0.85rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div>{launchError}</div>
                {(launchError.toLowerCase().includes('allocation') ||
                  launchError.toLowerCase().includes('plan') ||
                  launchError.toLowerCase().includes('upgrade')) && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <Link
                      href="/dashboard/billing"
                      style={{ color: '#60a5fa', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      View Billing & Upgrade Plan (INR ₹) &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleLaunchScan} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Target Endpoint <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.targetUrl} ({t.verificationStatus})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Scan Assessment Mode
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.85rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="scanMode"
                      value="PUBLIC_PASSIVE"
                      checked={scanMode === 'PUBLIC_PASSIVE'}
                      onChange={() => setScanMode('PUBLIC_PASSIVE')}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Public Passive Assessment</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Audits SSL/TLS, HTTP security headers, CORS, cookies, and public configurations without intrusive probing. Permitted on all targets.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '0.85rem',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      cursor: isSelectedTargetVerified ? 'pointer' : 'not-allowed',
                      opacity: isSelectedTargetVerified ? 1 : 0.6,
                    }}
                  >
                    <input
                      type="radio"
                      name="scanMode"
                      value="VERIFIED_ACTIVE"
                      checked={scanMode === 'VERIFIED_ACTIVE'}
                      onChange={() => isSelectedTargetVerified && setScanMode('VERIFIED_ACTIVE')}
                      disabled={!isSelectedTargetVerified}
                      style={{ marginTop: '0.2rem' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        Verified Active Scanning {!isSelectedTargetVerified && '(Requires Verification)'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Deep active probing for exposed secrets, sensitive files, debug routes, and API introspection. Gated per ADR-0008.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-cyber-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={launching}
                  className="btn-cyber-primary"
                  style={{ opacity: launching ? 0.7 : 1 }}
                >
                  {launching ? 'Executing Assessment...' : 'Start Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
