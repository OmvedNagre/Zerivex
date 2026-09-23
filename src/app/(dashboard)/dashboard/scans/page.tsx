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

    let color = '#34d399'; // Green (80-100)
    let bg = 'rgba(16, 185, 129, 0.15)';
    if (score < 50) {
      color = '#f87171'; // Red
      bg = 'rgba(239, 68, 68, 0.15)';
    } else if (score < 80) {
      color = '#fbbf24'; // Amber
      bg = 'rgba(245, 158, 11, 0.15)';
    }

    return (
      <span
        style={{
          padding: '0.2rem 0.6rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          fontWeight: 700,
          backgroundColor: bg,
          color,
          fontFamily: 'monospace',
        }}
      >
        {score} / 100
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span style={{ color: '#34d399', fontWeight: 600, fontSize: '0.8rem' }}>✓ COMPLETED</span>;
      case 'RUNNING':
        return <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.8rem' }}>⚙ RUNNING</span>;
      case 'FAILED':
        return <span style={{ color: '#f87171', fontWeight: 600, fontSize: '0.8rem' }}>✗ FAILED</span>;
      default:
        return <span style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.8rem' }}>⏳ QUEUED</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Security Assessment Scans
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Deterministic, evidence-based vulnerability scanning engine for modern web endpoints.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: '0.9rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          + Launch Scan
        </button>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', borderRadius: 'var(--radius-md)' }}>
          {error}
        </div>
      )}

      {/* Scans Table */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading scan history...
          </div>
        ) : scans.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🔬</div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>No scans executed yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
              Launch your first security scan against a registered target to identify misconfigurations and vulnerabilities.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              style={{
                padding: '0.6rem 1.2rem',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Launch First Scan
            </button>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Target Endpoint</th>
                <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Scan Mode</th>
                <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Security Score</th>
                <th style={{ padding: '0.85rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Executed At</th>
                <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
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
                {launchError}
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '0.65rem 1.25rem',
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={launching}
                  style={{
                    padding: '0.65rem 1.25rem',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: launching ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: launching ? 0.7 : 1,
                  }}
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
