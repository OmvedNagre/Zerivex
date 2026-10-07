'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { getRemediationForRule, RuleRemediation } from '@/core/remediation/remediation-catalog';
import { FindingsAccordionCard } from '@/components/dashboard/FindingsAccordionCard';
import { FrameworkRemediationModal } from '@/components/dashboard/FrameworkRemediationModal';
import { SeverityBadge } from '@/components/dashboard/SeverityBadge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  adaptFindingGroups,
  FindingGroupItem,
} from '@/adapters/dashboard-adapters';

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
  assignedUserId?: string | null;
  assignedUserEmail?: string | null;
  assignedUserName?: string | null;
}

export default function FindingsPage() {
  const [findings, setFindings] = useState<FindingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Status modal
  const [selectedFinding, setSelectedFinding] = useState<FindingItem | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<FindingGroupItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('OPEN');
  const [riskReason, setRiskReason] = useState<string>('');
  const [updating, setUpdating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Remediation & Fix Verification Modal
  const [remediationFinding, setRemediationFinding] = useState<FindingItem | null>(null);
  const [remediationData, setRemediationData] = useState<RuleRemediation | null>(null);
  const [verifyingFix, setVerifyingFix] = useState(false);
  const [verifyingFindingId, setVerifyingFindingId] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, { fixed: boolean; diagnostic: string }>>({});

  const fetchFindings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);

      const res = await fetch(`/api/findings?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch findings');
      }
      setFindings(data.data.findings || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load findings');
    } finally {
      setLoading(false);
    }
  }, [severityFilter, statusFilter]);

  useEffect(() => {
    fetchFindings();
  }, [fetchFindings]);

  // Adapt and group findings
  const { groups, stats } = useMemo(() => {
    return adaptFindingGroups(findings);
  }, [findings]);

  // Filter groups by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        g.ruleId.toLowerCase().includes(q) ||
        g.endpoint.toLowerCase().includes(q) ||
        g.targetUrl.toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const handleOpenRemediation = (finding: FindingItem) => {
    const data = getRemediationForRule(finding.ruleId);
    setRemediationFinding(finding);
    setRemediationData(data);
  };

  const handleVerifyFix = async (findingId: string) => {
    setVerifyingFix(true);
    setVerifyingFindingId(findingId);

    try {
      const res = await fetch(`/api/findings/${findingId}/verify`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify fix');
      }

      const resObj = { fixed: data.data.fixed, diagnostic: data.data.diagnostic };
      setFixResults((prev) => ({ ...prev, [findingId]: resObj }));

      const updatedStatus = data.data.fixed ? 'FIXED' : data.data.newStatus;
      setFindings((prev) =>
        prev.map((f) => (f.id === findingId ? { ...f, status: updatedStatus } : f))
      );
    } catch (err: any) {
      setFixResults((prev) => ({
        ...prev,
        [findingId]: { fixed: false, diagnostic: err.message || 'Verification failed' },
      }));
    } finally {
      setVerifyingFix(false);
      setVerifyingFindingId(null);
    }
  };

  // Status update (single or batch)
  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFinding && !selectedGroup) return;

    if (newStatus === 'ACCEPTED_RISK' && !riskReason.trim()) {
      setUpdateError('An explicit business justification is required for accepted risks.');
      return;
    }

    try {
      setUpdating(true);
      setUpdateError(null);

      if (selectedGroup) {
        // Batch apply sequentially to all occurrences with progress tracking
        const items = selectedGroup.occurrences;
        let failCount = 0;

        for (let i = 0; i < items.length; i++) {
          setBatchProgress({ current: i + 1, total: items.length });
          try {
            const res = await fetch(`/api/findings/${items[i].id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                status: newStatus,
                acceptedRiskReason: newStatus === 'ACCEPTED_RISK' ? riskReason : null,
              }),
            });
            if (!res.ok) failCount++;
          } catch {
            failCount++;
          }
        }

        if (failCount > 0) {
          setUpdateError(`Updated with ${failCount} failures out of ${items.length} items.`);
        } else {
          setSelectedGroup(null);
          setBatchProgress(null);
        }
        await fetchFindings();
      } else if (selectedFinding) {
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
      }
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update finding');
    } finally {
      setUpdating(false);
      setBatchProgress(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Page Header (eyebrow -> H1 -> subtitle -> actions) */}
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
            Findings
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
            Findings
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--ds-text-secondary)',
              margin: 0,
              maxWidth: '620px',
            }}
          >
            Open issues by severity across your verified sites with step-by-step code remediations.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={() => fetchFindings()} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
          <Button variant="brand" href="/dashboard/scans" icon={<Plus size={16} />}>
            Launch Scan
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 'var(--ds-radius-md)',
            backgroundColor: 'var(--ds-danger-bg)',
            border: '1px solid rgba(209, 0, 47, 0.25)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'var(--ds-danger)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => fetchFindings()} icon={<RefreshCw size={13} />}>
            Retry
          </Button>
        </div>
      )}

      {/* 4 Light Severity Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-danger)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Open Critical / High
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-danger)', margin: '6px 0 2px' }}>
            {stats.openCriticalHigh}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Requires priority remediation
          </div>
        </div>

        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-warning)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Needs Triage
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-warning)', margin: '6px 0 2px' }}>
            {stats.needsTriage}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Low and medium items open
          </div>
        </div>

        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Accepted Risk
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-text-primary)', margin: '6px 0 2px' }}>
            {stats.acceptedRisk}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Documented business exceptions
          </div>
        </div>

        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-success)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Fixed &amp; Verified
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-success)', margin: '6px 0 2px' }}>
            {stats.fixedAndVerified}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Closed via targeted verification
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 'var(--ds-radius-lg)',
          backgroundColor: 'var(--ds-bg-card)',
          border: '1px solid var(--ds-border-subtle)',
          boxShadow: 'var(--ds-shadow-1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Input with 42px leading padding */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ds-text-muted)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search findings or rules..."
              style={{
                width: '100%',
                padding: '8px 14px 8px 42px',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid var(--ds-border-default)',
                backgroundColor: 'var(--ds-bg-subtle)',
                color: 'var(--ds-text-primary)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--ds-radius-md)',
              border: '1px solid var(--ds-border-default)',
              backgroundColor: 'var(--ds-bg-card)',
              color: 'var(--ds-text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--ds-radius-md)',
              border: '1px solid var(--ds-border-default)',
              backgroundColor: 'var(--ds-bg-card)',
              color: 'var(--ds-text-primary)',
              fontSize: '13px',
              outline: 'none',
            }}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="ACCEPTED_RISK">Accepted Risk</option>
            <option value="FIXED">Fixed</option>
          </select>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--ds-text-muted)', fontWeight: 600 }}>
          {filteredGroups.length} unique {filteredGroups.length === 1 ? 'issue group' : 'issue groups'} ({findings.length} total occurrences)
        </div>
      </div>

      {/* Grouped Findings List */}
      {loading ? (
        <div style={{ padding: '64px', textAlign: 'center', color: 'var(--ds-text-muted)' }}>
          Loading security findings...
        </div>
      ) : filteredGroups.length === 0 ? (
        <div
          style={{
            padding: '72px 24px',
            textAlign: 'center',
            backgroundColor: 'var(--ds-bg-card)',
            borderRadius: 'var(--ds-radius-lg)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <CheckCircle2 size={40} style={{ color: 'var(--ds-success)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--ds-text-primary)', margin: '0 0 8px' }}>
            No matching findings
          </h3>
          <p style={{ fontSize: '13.5px', color: 'var(--ds-text-secondary)', maxWidth: '440px', margin: '0 auto 20px' }}>
            No security findings match your current filter parameters.
          </p>
          {(severityFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery) && (
            <Button
              variant="secondary"
              onClick={() => {
                setSeverityFilter('ALL');
                setStatusFilter('ALL');
                setSearchQuery('');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredGroups.map((group) => {
            const isExpanded = Boolean(expandedGroups[group.groupKey]);
            const latestFinding = group.latestFinding;

            return (
              <div
                key={group.groupKey}
                style={{
                  borderRadius: 'var(--ds-radius-lg)',
                  backgroundColor: 'var(--ds-bg-card)',
                  border: '1px solid var(--ds-border-subtle)',
                  boxShadow: 'var(--ds-shadow-1)',
                  overflow: 'hidden',
                }}
              >
                {/* Group Summary Header */}
                <div
                  style={{
                    padding: '20px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px',
                    cursor: 'pointer',
                    backgroundColor: isExpanded ? 'var(--ds-bg-subtle)' : 'var(--ds-bg-card)',
                    borderBottom: isExpanded ? '1px solid var(--ds-border-subtle)' : 'none',
                  }}
                  onClick={() => toggleGroupExpand(group.groupKey)}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <SeverityBadge severity={group.severity} />
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--ds-bg-subtle)',
                          color: 'var(--ds-text-muted)',
                        }}
                      >
                        {group.ruleId}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--ds-bg-subtle)',
                          color: 'var(--ds-text-secondary)',
                        }}
                      >
                        {group.confidenceLabel}
                      </span>
                      {group.occurrenceCount > 1 && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 'var(--ds-radius-pill)',
                            backgroundColor: 'rgba(255, 100, 45, 0.1)',
                            color: 'var(--ds-action-brand)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Layers size={11} />
                          Seen in {group.occurrenceCount} scans
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ds-text-primary)', margin: 0 }}>
                      {group.title}
                    </h3>

                    <div style={{ fontSize: '12px', color: 'var(--ds-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {group.endpoint}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenRemediation(latestFinding);
                      }}
                    >
                      See fix
                    </Button>

                    {group.occurrenceCount > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGroup(group);
                          setNewStatus('ACCEPTED_RISK');
                        }}
                      >
                        Apply to all ({group.occurrenceCount})
                      </Button>
                    )}

                    <div style={{ color: 'var(--ds-text-muted)', display: 'flex', alignItems: 'center' }}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </div>

                {/* Expanded Occurrences List */}
                {isExpanded && (
                  <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase' }}>
                      Occurrences ({group.occurrences.length})
                    </div>
                    {group.occurrences.map((occ) => (
                      <FindingsAccordionCard
                        key={occ.id}
                        finding={occ}
                        isExpanded={false}
                        onToggleExpand={() => {}}
                        onOpenRemediation={handleOpenRemediation}
                        onOpenStatusModal={(f) => {
                          setSelectedFinding(f);
                          setNewStatus(f.status || 'OPEN');
                        }}
                        onVerifyFix={handleVerifyFix}
                        isVerifying={verifyingFix && verifyingFindingId === occ.id}
                        verificationResult={fixResults[occ.id] || null}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remediation Modal */}
      {remediationFinding && (
        <FrameworkRemediationModal
          onClose={() => setRemediationFinding(null)}
          finding={remediationFinding}
          remediationData={remediationData}
          onVerifyFix={handleVerifyFix}
          isVerifying={verifyingFix}
          verificationResult={remediationFinding ? fixResults[remediationFinding.id] : null}
        />
      )}

      {/* Status Modal (Single or Batch) */}
      {(selectedFinding || selectedGroup) && (
        <Modal
          isOpen={Boolean(selectedFinding || selectedGroup)}
          onClose={() => {
            if (!updating) {
              setSelectedFinding(null);
              setSelectedGroup(null);
              setUpdateError(null);
            }
          }}
          title={selectedGroup ? `Update ${selectedGroup.occurrenceCount} Occurrences` : 'Update Finding Status'}
        >
          <form onSubmit={handleUpdateStatus} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {updateError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--ds-radius-sm)',
                  backgroundColor: 'var(--ds-danger-bg)',
                  color: 'var(--ds-danger)',
                  fontSize: '12.5px',
                }}
              >
                {updateError}
              </div>
            )}

            {batchProgress && (
              <div style={{ fontSize: '13px', color: 'var(--ds-action-brand)', fontWeight: 600 }}>
                Applying status: {batchProgress.current} / {batchProgress.total}...
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                Select Status
              </label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--ds-radius-md)',
                  border: '1px solid var(--ds-border-default)',
                  backgroundColor: 'var(--ds-bg-card)',
                  color: 'var(--ds-text-primary)',
                  fontSize: '13.5px',
                }}
              >
                <option value="OPEN">Open (Active finding)</option>
                <option value="CONFIRMED">Confirmed (Verified defect)</option>
                <option value="ACCEPTED_RISK">Accepted Risk (Business exception)</option>
                <option value="FALSE_POSITIVE">False Positive (Scanner exception)</option>
                <option value="FIXED">Fixed (Resolved)</option>
              </select>
            </div>

            {newStatus === 'ACCEPTED_RISK' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                  Business Justification (Required)
                </label>
                <textarea
                  required
                  value={riskReason}
                  onChange={(e) => setRiskReason(e.target.value)}
                  placeholder="Explain why this finding is accepted as an operational risk..."
                  rows={3}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--ds-radius-md)',
                    border: '1px solid var(--ds-border-default)',
                    backgroundColor: 'var(--ds-bg-card)',
                    color: 'var(--ds-text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button
                variant="secondary"
                type="button"
                disabled={updating}
                onClick={() => {
                  setSelectedFinding(null);
                  setSelectedGroup(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="brand" type="submit" disabled={updating}>
                {updating ? 'Updating...' : selectedGroup ? `Apply to all ${selectedGroup.occurrenceCount}` : 'Update Status'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
