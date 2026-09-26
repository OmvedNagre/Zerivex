'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Target, VerificationMethod, VerificationScope } from '@/core/targets/target-service';

export default function TargetsPage() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState<VerificationMethod>('DNS_TXT');
  const [scope, setScope] = useState<VerificationScope>('EXACT_HOST');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTargets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/targets');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch targets');
      }
      setTargets(data.data.targets || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

  const handleRegisterTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          verificationMethod: method,
          verificationScope: scope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setTargetUrl('');
      setIsModalOpen(false);
      await fetchTargets();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTarget = async (id: string, url: string) => {
    if (!confirm(`Are you sure you want to delete target "${url}"? All associated findings and verification records will be permanently removed.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete target');
      }
      await fetchTargets();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            ✓ VERIFIED
          </span>
        );
      case 'PENDING':
        return (
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            ⏳ PENDING
          </span>
        );
      default:
        return (
          <span
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            ⚠️ UNVERIFIED
          </span>
        );
    }
  };

  const verifiedCount = targets.filter((t) => t.verificationStatus === 'VERIFIED').length;
  const pendingCount = targets.filter((t) => t.verificationStatus === 'PENDING').length;
  const unverifiedCount = targets.filter((t) => t.verificationStatus !== 'VERIFIED' && t.verificationStatus !== 'PENDING').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="pulse-indicator" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Attack Surface Management
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            Authorized Targets & Domains
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '650px' }}>
            Register and cryptographically verify domain ownership to authorize passive and intrusive security scans according to RFC 9116 and strict egress validation.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-cyber-primary"
          style={{ height: '42px' }}
        >
          <span>+</span> Register New Target
        </button>
      </div>

      {/* KPI Cards Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Scope Endpoints
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            {targets.length}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Endpoints configured in policy
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--emerald)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Verified & Scannable
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399', marginTop: '0.25rem' }}>
            {verifiedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Ownership cryptographically proven
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--cyan)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.25rem' }}>
            {pendingCount + unverifiedCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Awaiting DNS TXT or HTTP token
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Target Table */}
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
            <div>Synchronizing registered targets...</div>
          </div>
        ) : targets.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1.25rem' }}>
              🎯
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>No targets registered yet</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
              Add your web applications, APIs, or domains to begin automated verification and vulnerability assessments.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-cyber-primary"
            >
              + Register First Target
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Target Endpoint</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verification Status</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Scope</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Method</th>
                  <th style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Registered</th>
                  <th style={{ padding: '1rem 1.25rem', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
              {targets.map((t) => (
                <tr
                  key={t.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.targetUrl}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.hostname}</div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>{getStatusBadge(t.verificationStatus)}</td>
                  <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.verificationScope}</td>
                  <td style={{ padding: '1rem 1.25rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{t.verificationMethod}</td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.75rem', alignItems: 'center' }}>
                      <Link
                        href={`/dashboard/targets/${t.id}`}
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--accent-primary)',
                          textDecoration: 'none',
                        }}
                      >
                        {t.verificationStatus === 'VERIFIED' ? 'View Details' : 'Verify Domain →'}
                      </Link>
                      <button
                        onClick={() => handleDeleteTarget(t.id, t.targetUrl)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                        title="Delete target"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Register Target Modal */}
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
              maxWidth: '560px',
              width: '100%',
              padding: '2rem',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Register Attack Surface Target</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            {formError && (
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
                <div>{formError}</div>
                {formError.toLowerCase().includes('limit') && (
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

            <form onSubmit={handleRegisterTarget} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Target URL <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="url"
                  placeholder="https://app.example.com"
                  required
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
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
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                  Must begin with http:// or https://. Private IPs and localhost are strictly prohibited.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Verification Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as VerificationMethod)}
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
                  <option value="DNS_TXT">DNS TXT Record (Recommended for production domains)</option>
                  <option value="HTML_META">HTML Meta Tag (For web applications)</option>
                  <option value="HTTP_HEADER">HTTP Response Header (For APIs and custom proxies)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Verification Scope (ADR-0008)
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as VerificationScope)}
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
                  <option value="EXACT_HOST">EXACT_HOST — Authorizes only this specific hostname</option>
                  <option value="DOMAIN">DOMAIN — Authorizes apex domain and first-party paths</option>
                  <option value="SUBDOMAIN_WILDCARD">SUBDOMAIN_WILDCARD — Authorizes *.domain.com</option>
                  <option value="URL_PATH">URL_PATH — Authorizes only specific path prefix</option>
                </select>
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
                  disabled={submitting}
                  className="btn-cyber-primary"
                  style={{ opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? 'Registering...' : 'Register Target'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
