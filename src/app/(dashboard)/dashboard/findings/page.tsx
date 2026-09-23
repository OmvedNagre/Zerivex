'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getRemediationForRule, RuleRemediation } from '@/core/remediation/remediation-catalog';

interface FindingItem {
  id: string;
  scanId: string;
  targetId: string;
  targetUrl: string;
  ruleId: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  confidence: string;
  category: string;
  resourceEndpoint: string | null;
  evidenceJson: Record<string, unknown>;
  status: 'OPEN' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'ACCEPTED_RISK' | 'FIXED' | 'REOPENED';
  acceptedRiskReason: string | null;
  cweId: string | null;
  owaspCategory: string | null;
  createdAt: string;
}

export default function FindingsPage() {
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});

  // Status modal
  const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('OPEN');
  const [riskReason, setRiskReason] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Remediation & Fix Verification Modal
  const [remediationFinding, setRemediationFinding] = useState<FindingItem | null>(null);
  const [remediationData, setRemediationData] = useState<RuleRemediation | null>(null);
  const [activeFramework, setActiveFramework] = useState<'nextjs' | 'express' | 'nginx'>('nextjs');
  const [verifyingFix, setVerifyingFix] = useState(false);
  const [fixResult, setFixResult] = useState<{ fixed: boolean; diagnostic: string } | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);

  const fetchFindings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/findings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch findings');
      }
      setFindings(data.data.findings || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  const toggleExpand = (findingId: string) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [findingId]: !prev[findingId],
    }));
  };

  const handleOpenStatusModal = (f: FindingItem) => {
    setSelectedFinding(f);
    setNewStatus(f.status);
    setRiskReason(f.acceptedRiskReason || '');
    setUpdateError(null);
  };

  const handleOpenRemediationModal = (finding: FindingItem) => {
    const data = getRemediationForRule(finding.ruleId);
    setRemediationFinding(finding);
    setRemediationData(data);
    setFixResult(null);
    setCopiedCli(false);

    if (data.frameworks.nextjs) setActiveFramework('nextjs');
    else if (data.frameworks.express) setActiveFramework('express');
    else if (data.frameworks.nginx) setActiveFramework('nginx');
  };

  const handleVerifyFix = async (findingId: string) => {
    setVerifyingFix(true);
    setFixResult(null);

    try {
      const res = await fetch(`/api/findings/${findingId}/verify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify fix');
      }

      setFixResult({
        fixed: data.data.fixed,
        diagnostic: data.data.diagnostic,
      });

      const updatedStatus = data.data.fixed ? 'FIXED' : data.data.newStatus;
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: updatedStatus } : f))
      );
    } catch (err) {
      setFixResult({
        fixed: false,
        diagnostic: (err as Error).message,
      });
    } finally {
      setVerifyingFix(false);
    }
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinding) return;

    if (newStatus === 'ACCEPTED_RISK' && !riskReason.trim()) {
      setUpdateError('An explicit business justification is required for accepted risks.');
      return;
    }

    try {
      setUpdating(true);
      setUpdateError(null);
      const res = await fetch(`/api/findings/${selectedFinding.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          acceptedRiskReason: newStatus === 'ACCEPTED_RISK' ? riskReason : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update finding status');
      }

      setFindings((prev) =>
        prev.map((item) =>
          item.id === selectedFinding.id
            ? { ...item, status: newStatus as any, acceptedRiskReason: riskReason }
            : item
        )
      );

      setSelectedFinding(null);
    } catch (err) {
      setUpdateError((err as Error).message);
    } finally {
      setUpdating(false);
    }
  };

  const filteredFindings = findings.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.ruleId.toLowerCase().includes(q) ||
      f.targetUrl.toLowerCase().includes(q) ||
      (f.resourceEndpoint || '').toLowerCase().includes(q)
    );
  });

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return { label: 'CRITICAL', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
      case 'HIGH':
        return { label: 'HIGH', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' };
      case 'MEDIUM':
        return { label: 'MEDIUM', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
      case 'LOW':
        return { label: 'LOW', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)' };
      default:
        return { label: 'INFO', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return { label: 'OPEN', color: '#f87171', bg: 'rgba(239, 68, 68, 0.1)' };
      case 'CONFIRMED':
        return { label: 'CONFIRMED', color: '#fb923c', bg: 'rgba(249, 115, 22, 0.1)' };
      case 'FIXED':
        return { label: 'FIXED', color: '#34d399', bg: 'rgba(16, 185, 129, 0.1)' };
      case 'REOPENED':
        return { label: 'REOPENED', color: '#f87171', bg: 'rgba(239, 68, 68, 0.15)' };
      case 'ACCEPTED_RISK':
        return { label: 'ACCEPTED RISK', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.1)' };
      case 'FALSE_POSITIVE':
        return { label: 'FALSE POSITIVE', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
      default:
        return { label: status, color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' };
    }
  };

  const totalCount = findings.length;
  const criticalHighOpenCount = findings.filter(
    (f) => (f.severity === 'CRITICAL' || f.severity === 'HIGH') && (f.status === 'OPEN' || f.status === 'CONFIRMED' || f.status === 'REOPENED')
  ).length;
  const acceptedRiskCount = findings.filter((f) => f.status === 'ACCEPTED_RISK').length;
  const fixedCount = findings.filter((f) => f.status === 'FIXED').length;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
            Security Findings Inventory
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Consolidated vulnerability database from deterministic scanner runs with closed-loop fix verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => fetchFindings()} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            Refresh
          </button>
          <Link href="/dashboard/scans" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            Launch Scan
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            Total Findings
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {totalCount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#f87171', marginBottom: '0.35rem' }}>
            Open Critical / High
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f87171', fontFamily: 'monospace' }}>
            {criticalHighOpenCount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#fbbf24', marginBottom: '0.35rem' }}>
            Accepted Risks
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#fbbf24', fontFamily: 'monospace' }}>
            {acceptedRiskCount}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#34d399', marginBottom: '0.35rem' }}>
            Resolved (Fixed)
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>
            {fixedCount}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          backgroundColor: 'var(--bg-card)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Severity
            </label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: '0.85rem',
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="ACCEPTED_RISK">Accepted Risk</option>
              <option value="FALSE_POSITIVE">False Positive</option>
              <option value="FIXED">Fixed</option>
              <option value="REOPENED">Reopened</option>
            </select>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>
            Search Findings
          </label>
          <input
            type="text"
            placeholder="Search title, rule, target, or endpoint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              width: '280px',
            }}
          />
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '1rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: '#f87171',
            marginBottom: '1.5rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Findings List */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading findings...
        </div>
      ) : filteredFindings.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            No Findings Found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '450px', margin: '0 auto' }}>
            No vulnerability records match your criteria.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredFindings.map((finding) => {
            const sev = getSeverityBadge(finding.severity);
            const stat = getStatusBadge(finding.status);
            const isExpanded = !!expandedFindings[finding.id];

            return (
              <div
                key={finding.id}
                className="card"
                style={{
                  border: `1px solid ${isExpanded ? sev.border : 'var(--border-subtle)'}`,
                  backgroundColor: 'var(--bg-card)',
                  padding: '1.25rem 1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: sev.bg,
                          color: sev.color,
                          border: `1px solid ${sev.border}`,
                        }}
                      >
                        {sev.label}
                      </span>

                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                        }}
                      >
                        {finding.ruleId}
                      </span>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '0.1rem 0.45rem',
                          borderRadius: '4px',
                          backgroundColor: stat.bg,
                          color: stat.color,
                        }}
                      >
                        {stat.label}
                      </span>

                      {finding.cweId && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {finding.cweId}
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                      {finding.title}
                    </h3>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      <div>
                        Target:{' '}
                        <Link href={`/dashboard/targets/${finding.targetId}`} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>
                          {finding.targetUrl}
                        </Link>
                      </div>
                      {finding.resourceEndpoint && (
                        <div>
                          Endpoint: <span style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{finding.resourceEndpoint}</span>
                        </div>
                      )}
                      <div>
                        Detected:{' '}
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {new Date(finding.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleOpenRemediationModal(finding)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      ⚡ Fix Guide & Verify
                    </button>

                    <Link
                      href={`/dashboard/scans/${finding.scanId}`}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
                    >
                      Scan Details
                    </Link>

                    <button
                      onClick={() => handleOpenStatusModal(finding)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      Triage
                    </button>

                    <button
                      onClick={() => toggleExpand(finding.id)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      {isExpanded ? 'Hide Evidence ▲' : 'Evidence ▼'}
                    </button>
                  </div>
                </div>

                {/* Evidence Drawer */}
                {isExpanded && (
                  <div
                    style={{
                      marginTop: '1rem',
                      padding: '1.25rem',
                      backgroundColor: '#0a0d14',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Deterministic Evidence (Redacted per ADR-0007)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(finding.evidenceJson, null, 2));
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Copy JSON
                      </button>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        padding: '1rem',
                        backgroundColor: '#05070a',
                        borderRadius: '4px',
                        overflowX: 'auto',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                        color: '#a5f3fc',
                        lineHeight: 1.5,
                      }}
                    >
                      {JSON.stringify(finding.evidenceJson, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remediation & Fix Verification Modal */}
      {remediationFinding && remediationData && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '2rem',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                    }}
                  >
                    {remediationData.ruleId}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {remediationData.cwe}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {remediationData.title}
                </h3>
              </div>

              <button
                onClick={() => setRemediationFinding(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Verification Result Banner */}
            {fixResult && (
              <div
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '1.25rem',
                  backgroundColor: fixResult.fixed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${fixResult.fixed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  color: fixResult.fixed ? '#34d399' : '#f87171',
                  fontSize: '0.9rem',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                  {fixResult.fixed ? '✓ Remediation Verified!' : '✗ Vulnerability Still Present'}
                </div>
                <div>{fixResult.diagnostic}</div>
              </div>
            )}

            {/* Impact */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Vulnerability Impact
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {remediationData.impact}
              </p>
            </div>

            {/* Framework Diffs */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Code Remediation Diff
                </div>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {(['nextjs', 'express', 'nginx'] as const).map((fw) => {
                    const available = !!remediationData.frameworks[fw];
                    if (!available) return null;
                    const isActive = activeFramework === fw;

                    return (
                      <button
                        key={fw}
                        onClick={() => setActiveFramework(fw)}
                        style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: isActive ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                          color: isActive ? '#ffffff' : 'var(--text-secondary)',
                          border: 'none',
                        }}
                      >
                        {fw === 'nextjs' ? 'Next.js' : fw === 'express' ? 'Express' : 'Nginx'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {remediationData.frameworks[activeFramework] ? (
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    {remediationData.frameworks[activeFramework]?.explanation}
                  </div>
                  <pre
                    style={{
                      margin: 0,
                      padding: '1rem',
                      backgroundColor: '#0a0d14',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      overflowX: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      color: '#e2e8f0',
                      lineHeight: 1.45,
                    }}
                  >
                    {remediationData.frameworks[activeFramework]?.diff}
                  </pre>
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {remediationData.summary}
                </div>
              )}
            </div>

            {/* CLI Verification */}
            {remediationData.cliVerification && (
              <div style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Local CLI Verification (curl)
                  </span>
                  <button
                    onClick={() => {
                      const cmd = remediationData.cliVerification.replace('YOUR_TARGET_URL', remediationFinding.targetUrl);
                      navigator.clipboard.writeText(cmd);
                      setCopiedCli(true);
                      setTimeout(() => setCopiedCli(false), 2000);
                    }}
                    style={{ background: 'transparent', border: 'none', color: copiedCli ? '#34d399' : 'var(--text-secondary)', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    {copiedCli ? '✓ Copied' : 'Copy command'}
                  </button>
                </div>
                <code style={{ fontSize: '0.8rem', color: '#67e8f9', wordBreak: 'break-all' }}>
                  {remediationData.cliVerification.replace('YOUR_TARGET_URL', remediationFinding.targetUrl)}
                </code>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => setRemediationFinding(null)}
                className="btn btn-secondary"
              >
                Close Guide
              </button>

              <button
                type="button"
                onClick={() => handleVerifyFix(remediationFinding.id)}
                disabled={verifyingFix}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {verifyingFix ? (
                  <>
                    <span>⚡</span>
                    <span>Re-testing Endpoint...</span>
                  </>
                ) : (
                  <>
                    <span>✓</span>
                    <span>Verify Fix Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {selectedFinding && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '520px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '1.75rem',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Triage & Update Status
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Updating finding: <strong>{selectedFinding.title}</strong>
            </p>

            {updateError && (
              <div
                style={{
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                }}
              >
                {updateError}
              </div>
            )}

            <form onSubmit={handleUpdateStatus}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                  Lifecycle Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="OPEN">OPEN (Unaddressed)</option>
                  <option value="CONFIRMED">CONFIRMED (Triage Verified)</option>
                  <option value="FIXED">FIXED (Remediated)</option>
                  <option value="ACCEPTED_RISK">ACCEPTED_RISK (Risk Documented)</option>
                  <option value="FALSE_POSITIVE">FALSE_POSITIVE (Invalid Finding)</option>
                </select>
              </div>

              {newStatus === 'ACCEPTED_RISK' && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#fbbf24', marginBottom: '0.4rem' }}>
                    Required Business Justification
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Document business justification and compensating controls..."
                    value={riskReason}
                    onChange={(e) => setRiskReason(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(245, 158, 11, 0.4)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setSelectedFinding(null)}
                  className="btn btn-secondary"
                  disabled={updating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updating}
                >
                  {updating ? 'Saving...' : 'Save Triage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
