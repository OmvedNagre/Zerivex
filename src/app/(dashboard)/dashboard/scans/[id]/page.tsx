'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ScanJobRecord, FindingRecord } from '@/core/scanner/scan-runner';
import { getRemediationForRule, RuleRemediation } from '@/core/remediation/remediation-catalog';

export default function ScanReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [scan, setScan] = useState<ScanJobRecord | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({});

  // Status update modal
  const [selectedFinding, setSelectedFinding] = useState<FindingRecord | null>(null);
  const [newStatus, setNewStatus] = useState<string>('OPEN');
  const [riskReason, setRiskReason] = useState<string>('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Remediation & Fix Verification Modal
  const [remediationFinding, setRemediationFinding] = useState<FindingRecord | null>(null);
  const [remediationData, setRemediationData] = useState<RuleRemediation | null>(null);
  const [activeFramework, setActiveFramework] = useState<'nextjs' | 'express' | 'nginx'>('nextjs');
  const [verifyingFix, setVerifyingFix] = useState(false);
  const [fixResult, setFixResult] = useState<{ fixed: boolean; diagnostic: string } | null>(null);
  const [copiedCli, setCopiedCli] = useState(false);

  const fetchScanReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/scans/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch scan report');
      }
      setScan(data.data.scanJob);
      setFindings(data.data.findings || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchScanReport();
  }, [fetchScanReport]);

  const toggleExpand = (findingId: string) => {
    setExpandedFindings((prev) => ({
      ...prev,
      [findingId]: !prev[findingId],
    }));
  };

  const handleOpenStatusModal = (finding: FindingRecord) => {
    setSelectedFinding(finding);
    setNewStatus(finding.status);
    setRiskReason(finding.acceptedRiskReason || '');
    setUpdateError(null);
  };

  const handleOpenRemediationModal = (finding: FindingRecord) => {
    const data = getRemediationForRule(finding.ruleId);
    setRemediationFinding(finding);
    setRemediationData(data);
    setFixResult(null);
    setCopiedCli(false);

    // Pick first available framework if current doesn't exist
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

      // Update finding in local state
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
      setUpdatingStatus(true);
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
        prev.map((f) =>
          f.id === selectedFinding.id
            ? { ...f, status: newStatus as any, acceptedRiskReason: riskReason }
            : f
        )
      );

      setSelectedFinding(null);
    } catch (err) {
      setUpdateError((err as Error).message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredFindings = findings.filter((f) => {
    if (severityFilter !== 'ALL' && f.severity !== severityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = f.title.toLowerCase().includes(q);
      const matchRule = f.ruleId.toLowerCase().includes(q);
      const matchEndpoint = (f.resourceEndpoint || '').toLowerCase().includes(q);
      if (!matchTitle && !matchRule && !matchEndpoint) return false;
    }
    return true;
  });

  const getScoreColor = (score: number | null) => {
    if (score === null) return '#94a3b8';
    if (score >= 85) return '#34d399';
    if (score >= 70) return '#fbbf24';
    if (score >= 50) return '#fb923c';
    return '#f87171';
  };

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

  if (loading) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading security scan report...</p>
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem' }}>
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
          <h2 style={{ color: '#f87171', marginBottom: '0.75rem' }}>Scan Report Error</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {error || 'Unable to retrieve scan report.'}
          </p>
          <Link href="/dashboard/scans" className="btn btn-secondary">
            ← Return to Scans
          </Link>
        </div>
      </div>
    );
  }

  const scoreColor = getScoreColor(scan.score);
  const criticalCount = findings.filter((f) => f.severity === 'CRITICAL').length;
  const highCount = findings.filter((f) => f.severity === 'HIGH').length;
  const mediumCount = findings.filter((f) => f.severity === 'MEDIUM').length;
  const lowCount = findings.filter((f) => f.severity === 'LOW').length;

  return (
    <div className="container" style={{ padding: '2rem 1.5rem 5rem' }}>
      {/* Breadcrumb & Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          <Link href="/dashboard/scans" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>
            ← All Scans
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {scan.id.substring(0, 13)}...
          </span>
        </div>

        {/* Action Buttons: Export Report & New Scan */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href={`/api/scans/${scan.id}/report?format=html`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span>🖨️</span>
            <span>Executive PDF / Print</span>
          </a>

          <a
            href={`/api/scans/${scan.id}/report?format=json`}
            download
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <span>⬇</span>
            <span>Technical JSON</span>
          </a>

          <Link href="/dashboard/scans" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
            New Scan
          </Link>
        </div>
      </div>

      {/* Hero Summary Card */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          background: 'linear-gradient(180deg, var(--bg-card) 0%, rgba(20, 24, 33, 0.6) 100%)',
          border: '1px solid var(--border-subtle)',
          padding: '2rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            alignItems: 'center',
          }}
        >
          {/* Left Column: Target & Status */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  backgroundColor:
                    scan.status === 'COMPLETED'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : scan.status === 'RUNNING'
                      ? 'rgba(59, 130, 246, 0.15)'
                      : scan.status === 'FAILED'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(148, 163, 184, 0.15)',
                  color:
                    scan.status === 'COMPLETED'
                      ? '#34d399'
                      : scan.status === 'RUNNING'
                      ? '#60a5fa'
                      : scan.status === 'FAILED'
                      ? '#f87171'
                      : '#94a3b8',
                }}
              >
                {scan.status}
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {scan.scanMode === 'VERIFIED_ACTIVE' ? '⚡ Verified Active' : '🔍 Public Passive'}
              </span>
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              {scan.targetUrl}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <div>
                Triggered:{' '}
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(scan.createdAt).toLocaleString()}
                </span>
              </div>
              {scan.completedAt && (
                <div>
                  Duration:{' '}
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {Math.max(
                      1,
                      Math.round(
                        (new Date(scan.completedAt).getTime() -
                          new Date(scan.startedAt || scan.createdAt).getTime()) /
                          1000
                      )
                    )}
                    s
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Deterministic Security Score */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2.5rem',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              padding: '1.75rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                Security Score
              </div>
              <div
                style={{
                  fontSize: '3.5rem',
                  fontWeight: 800,
                  lineHeight: 1,
                  color: scoreColor,
                  fontFamily: 'monospace',
                }}
              >
                {scan.score !== null ? scan.score : '—'}
                <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                {scan.score === null
                  ? 'Pending Analysis'
                  : scan.score >= 85
                  ? 'Strong Baseline'
                  : scan.score >= 70
                  ? 'Needs Attention'
                  : 'Vulnerabilities Detected'}
              </div>
            </div>

            <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: '2rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Confirmed Findings:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.4rem 1rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#f87171', fontWeight: 600 }}>Critical:</span>
                <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{criticalCount}</span>

                <span style={{ color: '#fb923c', fontWeight: 600 }}>High:</span>
                <span style={{ fontFamily: 'monospace', color: '#fb923c' }}>{highCount}</span>

                <span style={{ color: '#fbbf24', fontWeight: 600 }}>Medium:</span>
                <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>{mediumCount}</span>

                <span style={{ color: '#60a5fa', fontWeight: 600 }}>Low:</span>
                <span style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{lowCount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Findings Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Scan Findings ({filteredFindings.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Deterministic findings with developer fix guides and automated fix verification.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search findings or rule ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              width: '220px',
            }}
          />

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-card)',
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
      </div>

      {/* Findings List */}
      {filteredFindings.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛡️</div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {findings.length === 0 ? 'No Security Vulnerabilities Detected' : 'No findings match current filter'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
            All deterministic checks passed with clean responses.
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

                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                      {finding.title}
                    </h3>

                    {finding.resourceEndpoint && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '0.5rem' }}>
                        Endpoint: <span style={{ color: 'var(--text-secondary)' }}>{finding.resourceEndpoint}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions: Remediation & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => handleOpenRemediationModal(finding)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                    >
                      ⚡ Fix Guide & Verify
                    </button>

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
                      marginTop: '1.25rem',
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

            {/* Impact Explanation */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Vulnerability Impact
              </div>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {remediationData.impact}
              </p>
            </div>

            {/* Framework Tabs & Code Diff */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Code Remediation Diff
                </div>

                {/* Framework Selector */}
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

              {/* Code Diff Box */}
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

            {/* CLI Verification Command */}
            {remediationData.cliVerification && (
              <div style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Local CLI Verification (curl)
                  </span>
                  <button
                    onClick={() => {
                      const cmd = remediationData.cliVerification.replace('YOUR_TARGET_URL', scan?.targetUrl || '');
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
                  {remediationData.cliVerification.replace('YOUR_TARGET_URL', scan?.targetUrl || '')}
                </code>
              </div>
            )}

            {/* Modal Actions */}
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

      {/* Status Update Modal */}
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
              Update Finding Status
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Modify lifecycle status for <strong>{selectedFinding.title}</strong> ({selectedFinding.ruleId}).
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
                  <option value="OPEN">OPEN (Needs Remediation)</option>
                  <option value="CONFIRMED">CONFIRMED (Triage Verified)</option>
                  <option value="FIXED">FIXED (Resolved)</option>
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
                    placeholder="Describe why this risk is accepted and what compensating controls exist..."
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
                  disabled={updatingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={updatingStatus}
                >
                  {updatingStatus ? 'Updating...' : 'Save Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
