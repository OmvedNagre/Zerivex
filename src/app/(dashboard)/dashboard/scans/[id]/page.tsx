'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ScanJobRecord, FindingRecord } from '@/core/scanner/scan-runner';
import { getRemediationForRule, RuleRemediation } from '@/core/remediation/remediation-catalog';
import { FindingsAccordionCard } from '@/components/dashboard/FindingsAccordionCard';
import { FrameworkRemediationModal } from '@/components/dashboard/FrameworkRemediationModal';
import { ArrowLeft, RotateCw, Printer, AlertTriangle, Zap, Search, Shield } from 'lucide-react';

export default function ScanReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [scan, setScan] = useState<ScanJobRecord | null>(null);
  const [findings, setFindings] = useState<FindingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [rescanError, setRescanError] = useState<string | null>(null);

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
  const [verifyingFix, setVerifyingFix] = useState(false);
  const [verifyingFindingId, setVerifyingFindingId] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<{ fixed: boolean; diagnostic: string } | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, { fixed: boolean; diagnostic: string }>>({});

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
  };

  const handleVerifyFix = async (findingId: string) => {
    setVerifyingFix(true);
    setVerifyingFindingId(findingId);
    setFixResult(null);

    try {
      const res = await fetch(`/api/findings/${findingId}/verify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify fix');
      }

      const resObj = {
        fixed: data.data.fixed,
        diagnostic: data.data.diagnostic,
      };
      setFixResult(resObj);
      setFixResults((prev) => ({ ...prev, [findingId]: resObj }));

      // Update finding in local state
      const updatedStatus = data.data.fixed ? 'FIXED' : data.data.newStatus;
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: updatedStatus } : f))
      );
    } catch (err) {
      const errObj = {
        fixed: false,
        diagnostic: (err as Error).message,
      };
      setFixResult(errObj);
      setFixResults((prev) => ({ ...prev, [findingId]: errObj }));
    } finally {
      setVerifyingFix(false);
      setVerifyingFindingId(null);
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

  const handleRescanTarget = async () => {
    if (!scan) return;
    try {
      setRescanning(true);
      setRescanError(null);
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: scan.targetId,
          scanMode: scan.scanMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-scan target');
      }
      const newScanId = data.data?.scanJob?.id;
      if (newScanId) {
        router.push(`/dashboard/scans/${newScanId}`);
      }
    } catch (err) {
      setRescanError((err as Error).message);
    } finally {
      setRescanning(false);
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
          <Link href="/dashboard/scans" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> Return to Scans
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
          <Link href="/dashboard/scans" style={{ color: 'var(--text-secondary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={14} /> All Scans
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>/</span>
          <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
            {scan.id.substring(0, 13)}...
          </span>
        </div>

        {/* Action Buttons: Export Report & New Scan */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleRescanTarget}
            disabled={rescanning}
            className="zx-btn zx-btn--brand zx-btn--sm"
            style={{
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: rescanning ? 'not-allowed' : 'pointer',
            }}
            title="Re-run security scan against this target with latest engine"
          >
            {rescanning ? (
              <>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>Re-Scanning Target...</span>
              </>
            ) : (
              <>
                <RotateCw size={14} />
                <span>Re-Scan Target Now</span>
              </>
            )}
          </button>

          <a
            href={`/api/scans/${scan.id}/report?format=html`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Printer size={14} />
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

          <Link href="/dashboard/scans" className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>
            All Scans
          </Link>
        </div>
      </div>

      {rescanError && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <AlertTriangle size={14} /> {rescanError}
          </div>
        </div>
      )}

      {/* Hero Summary Card */}
      <div
        className="card"
        style={{
          marginBottom: '2rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-card)',
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
                {scan.scanMode === 'VERIFIED_ACTIVE' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Zap size={12} /> Verified Active
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Search size={12} /> Public Passive
                  </span>
                )}
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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
            <Shield size={36} />
          </div>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {findings.length === 0 ? 'No Security Vulnerabilities Detected' : 'No findings match current filter'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto' }}>
            All deterministic checks passed with clean responses.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredFindings.map((finding) => (
            <FindingsAccordionCard
              key={finding.id}
              finding={{
                ...finding,
                targetUrl: scan?.targetUrl || undefined,
              }}
              isExpanded={!!expandedFindings[finding.id]}
              onToggleExpand={toggleExpand}
              onOpenRemediation={handleOpenRemediationModal}
              onOpenStatusModal={handleOpenStatusModal}
              onVerifyFix={handleVerifyFix}
              isVerifying={verifyingFindingId === finding.id}
              verificationResult={fixResults[finding.id] || null}
            />
          ))}
        </div>
      )}

      {/* Remediation & Fix Verification Modal */}
      {remediationFinding && remediationData && (
        <FrameworkRemediationModal
          finding={remediationFinding}
          remediationData={remediationData}
          targetUrl={scan?.targetUrl || ''}
          onClose={() => setRemediationFinding(null)}
          onVerifyFix={handleVerifyFix}
          isVerifying={verifyingFix}
          verificationResult={fixResult}
        />
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
                  className="zx-btn zx-btn--secondary zx-btn--sm"
                  disabled={updatingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="zx-btn zx-btn--brand zx-btn--sm"
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
