'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  XCircle,
  Globe,
  ShieldCheck,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Activity,
  BarChart3,
  FileText,
} from 'lucide-react';
import { ScanJobRecord } from '@/core/scanner/scan-runner';
import { ScanMode } from '@/core/scanner/checks/types';
import { StaggeredText } from '@/components/ui/StaggeredText';

export interface ScansExecutionTableProps {
  scans: ScanJobRecord[];
  loading: boolean;
  error?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onLaunchNewScan?: () => void;
}

/**
 * ScoreBadge: Restrained security posture metric presentation.
 * Explicitly separates execution failure from security posture.
 */
export function ScoreBadge({
  score,
  status,
  errorMessage,
}: {
  score: number | null;
  status: string;
  errorMessage?: string | null;
}) {
  // If scan is still executing or queued, score is pending completion
  if (status === 'RUNNING' || status === 'QUEUED') {
    return (
      <span
        className="zse-score-placeholder"
        role="status"
        aria-label="Security score: Pending execution completion"
      >
        <span className="zse-score-dash">—</span>
        <span className="zse-score-reason">Pending</span>
      </span>
    );
  }

  // If scan failed, distinguish execution failure from a 0/100 score
  if (status === 'FAILED') {
    return (
      <span
        className="zse-score-placeholder"
        role="status"
        title={errorMessage || 'Execution halted prior to score generation'}
        aria-label="Security score: Not available (execution failed)"
      >
        <span className="zse-score-dash">—</span>
        <span className="zse-score-reason" style={{ color: '#f87171' }}>Failed</span>
      </span>
    );
  }

  // If scan completed but score is null
  if (score === null) {
    return (
      <span
        className="zse-score-placeholder"
        role="status"
        aria-label="Security score: Unavailable"
      >
        <span className="zse-score-dash">—</span>
      </span>
    );
  }

  // Determine semantic color based on verified product thresholds:
  // 80–100 -> Emerald
  // 50–79  -> Amber
  // 0–49   -> Red / Critical
  let scoreClass = 'zse-score-emerald';
  let accessibleRating = 'High';

  if (score < 50) {
    scoreClass = 'zse-score-red';
    accessibleRating = 'Critical';
  } else if (score < 80) {
    scoreClass = 'zse-score-amber';
    accessibleRating = 'Moderate';
  }

  return (
    <span
      className={`zse-score-badge ${scoreClass}`}
      role="status"
      aria-label={`Security score: ${score} out of 100 (${accessibleRating} posture)`}
    >
      <span className="zse-score-num">{score}</span>
      <span className="zse-score-denom">/100</span>
    </span>
  );
}

/**
 * ExecutionStatusBadge: Operational execution status.
 * Visual status pill with semantic SVG icon and accessible text.
 */
export function ExecutionStatusBadge({
  status,
  errorMessage,
}: {
  status: string;
  errorMessage?: string | null;
}) {
  switch (status) {
    case 'COMPLETED':
      return (
        <span
          className="zse-status-badge zse-status-completed"
          role="status"
          aria-label="Execution status: Completed"
        >
          <CheckCircle2 size={12} className="zse-status-icon" aria-hidden="true" />
          <span>COMPLETED</span>
        </span>
      );
    case 'RUNNING':
      return (
        <span
          className="zse-status-badge zse-status-running"
          role="status"
          aria-label="Execution status: Running in progress"
        >
          <Loader2 size={12} className="zse-status-icon zse-spin" aria-hidden="true" />
          <span>RUNNING</span>
        </span>
      );
    case 'QUEUED':
      return (
        <span
          className="zse-status-badge zse-status-queued"
          role="status"
          aria-label="Execution status: Queued in worker queue"
        >
          <Clock size={12} className="zse-status-icon" aria-hidden="true" />
          <span>QUEUED</span>
        </span>
      );
    case 'FAILED':
      return (
        <span
          className="zse-status-badge zse-status-failed"
          role="status"
          title={errorMessage || 'Scan job failed to complete'}
          aria-label={`Execution status: Failed${errorMessage ? ` - ${errorMessage}` : ''}`}
        >
          <AlertTriangle size={12} className="zse-status-icon" aria-hidden="true" />
          <span>FAILED</span>
        </span>
      );
    case 'CANCELLED':
    default:
      return (
        <span
          className="zse-status-badge zse-status-cancelled"
          role="status"
          aria-label={`Execution status: ${status || 'Cancelled'}`}
        >
          <XCircle size={12} className="zse-status-icon" aria-hidden="true" />
          <span>{status || 'CANCELLED'}</span>
        </span>
      );
  }
}

/**
 * ScanModeBadge: Technical assessment mode tag.
 * Reflects technical boundary difference without arbitrary ranking.
 */
export function ScanModeBadge({ mode }: { mode: ScanMode | string }) {
  if (mode === 'VERIFIED_ACTIVE') {
    return (
      <span
        className="zse-mode-badge zse-mode-active"
        title="Verified Active Scanning: Deep active security verification authorized per ADR-0008"
        aria-label="Scan mode: Verified Active"
      >
        <ShieldCheck size={11} aria-hidden="true" />
        <span>ACTIVE</span>
      </span>
    );
  }

  return (
    <span
      className="zse-mode-badge zse-mode-passive"
      title="Public Passive Assessment: Non-intrusive configuration and header evaluation"
      aria-label="Scan mode: Public Passive"
    >
      <Globe size={11} aria-hidden="true" />
      <span>PASSIVE</span>
    </span>
  );
}

/**
 * Format timestamp into exact human-readable date + time.
 */
function formatTimestamp(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '—';
  }
}

/**
 * Format relative time (e.g., '2m ago', '3h ago', 'yesterday').
 */
function formatRelativeTime(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

export function ScansExecutionTable({
  scans,
  loading,
  error,
  onRefresh,
  isRefreshing = false,
  onLaunchNewScan,
}: ScansExecutionTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter toolbar state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'FAILED'>('ALL');
  const [modeFilter, setModeFilter] = useState<'ALL' | 'PUBLIC_PASSIVE' | 'VERIFIED_ACTIVE'>('ALL');

  // GSAP subtle entrance animation on mount with reduced-motion support
  useEffect(() => {
    if (!containerRef.current) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        allowMotion: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion?: boolean };
        if (!reduceMotion && containerRef.current) {
          gsap.fromTo(
            containerRef.current,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
          );
        }
      }
    );

    return () => mm.revert();
  }, []);

  const handleCopyUrl = (id: string, url: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1800);
      });
    }
  };

  // Fleet Metrics Calculations (Derived deterministically from actual scan dataset)
  const completedCount = useMemo(() => scans.filter((s) => s.status === 'COMPLETED').length, [scans]);
  const runningCount = useMemo(() => scans.filter((s) => s.status === 'RUNNING').length, [scans]);
  const queuedCount = useMemo(() => scans.filter((s) => s.status === 'QUEUED').length, [scans]);
  const failedCount = useMemo(() => scans.filter((s) => s.status === 'FAILED').length, [scans]);
  const activeCount = runningCount + queuedCount;

  const fleetMeanScore = useMemo(() => {
    const validScores = scans
      .filter((s) => s.status === 'COMPLETED' && s.score !== null)
      .map((s) => s.score as number);
    if (validScores.length === 0) return scans.length > 0 ? null : 100;
    return Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length);
  }, [scans]);

  // Client-side filtering logic
  const filteredScans = useMemo(() => {
    return scans.filter((s) => {
      // 1. Search Query filter (matches targetUrl or targetHostname)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesUrl = s.targetUrl?.toLowerCase().includes(query);
        const matchesHost = s.targetHostname?.toLowerCase().includes(query);
        if (!matchesUrl && !matchesHost) return false;
      }

      // 2. Status filter
      if (statusFilter === 'ACTIVE') {
        if (s.status !== 'RUNNING' && s.status !== 'QUEUED') return false;
      } else if (statusFilter === 'COMPLETED') {
        if (s.status !== 'COMPLETED') return false;
      } else if (statusFilter === 'FAILED') {
        if (s.status !== 'FAILED') return false;
      }

      // 3. Mode filter
      if (modeFilter !== 'ALL') {
        if (s.scanMode !== modeFilter) return false;
      }

      return true;
    });
  }, [scans, searchQuery, statusFilter, modeFilter]);

  return (
    <div ref={containerRef} className="zse-container" aria-label="Security Scan Execution Ledger">
      {/* 1. Metrics Ribbon (Unified Summary Strip) */}
      <section className="zse-metrics-ribbon" aria-label="Fleet Execution Metrics">
        {/* Fleet Mean Score: Primary Anchor */}
        <div className="zse-metric-card zse-metric-primary">
          <div className="zse-metric-header">
            <span className="zse-metric-label">Fleet Mean Score</span>
            <BarChart3 size={16} className="zse-metric-icon" aria-hidden="true" />
          </div>
          <div className="zse-metric-value-wrap">
            <span className="zse-metric-value">
              {fleetMeanScore !== null ? fleetMeanScore : '—'}
            </span>
            {fleetMeanScore !== null && <span className="zse-metric-denom">/100</span>}
          </div>
          <div className="zse-metric-subtext">Aggregate verified baseline</div>
        </div>

        {/* Active / Queued: Operationally Crucial */}
        <div className="zse-metric-card zse-metric-active">
          <div className="zse-metric-header">
            <span className="zse-metric-label">Active / Queued</span>
            <Activity size={16} className="zse-metric-icon" aria-hidden="true" />
          </div>
          <div className="zse-metric-value-wrap">
            <span className="zse-metric-value">{activeCount}</span>
          </div>
          <div className="zse-metric-subtext">
            {runningCount} executing · {queuedCount} waiting
          </div>
        </div>

        {/* Completed Assessments: Supporting Context */}
        <div className="zse-metric-card zse-metric-completed">
          <div className="zse-metric-header">
            <span className="zse-metric-label">Completed</span>
            <CheckCircle2 size={16} className="zse-metric-icon" aria-hidden="true" />
          </div>
          <div className="zse-metric-value-wrap">
            <span className="zse-metric-value">{completedCount}</span>
          </div>
          <div className="zse-metric-subtext">Deterministic assessments verified</div>
        </div>

        {/* Total Executions: Supporting Context */}
        <div className="zse-metric-card zse-metric-total">
          <div className="zse-metric-header">
            <span className="zse-metric-label">Total Executions</span>
            <FileText size={16} className="zse-metric-icon" aria-hidden="true" />
          </div>
          <div className="zse-metric-value-wrap">
            <span className="zse-metric-value">{scans.length}</span>
          </div>
          <div className="zse-metric-subtext">Historical runs recorded</div>
        </div>
      </section>

      {/* 2. Live Execution Signal / Rail (Visible when scans are in flight) */}
      {activeCount > 0 && (
        <div className="zse-live-rail" role="status" aria-live="polite">
          <div className="zse-live-rail-status">
            <span className="zse-live-pulse-dot" aria-hidden="true" />
            <span className="zse-live-title">Live Execution:</span>
            <span className="zse-live-counts">
              <strong>{runningCount}</strong> active {runningCount === 1 ? 'assessment' : 'assessments'} in progress
              {queuedCount > 0 && <> · <strong>{queuedCount}</strong> queued</>}
            </span>
          </div>
          <div className="zse-live-sync-indicator">
            <RefreshCw size={12} className="zse-spin" aria-hidden="true" />
            <span>Autonomous worker queue polling</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="zse-error-banner" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Execution data error: {error}</span>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="zse-error-retry-btn"
              type="button"
              aria-label="Retry loading scan executions"
            >
              <RefreshCw size={12} aria-hidden="true" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Main Execution Table Card */}
      <section className="zse-table-card" aria-label="Scan Executions List">
        {/* Operational Toolbar */}
        <div className="zse-toolbar">
          <div className="zse-toolbar-left">
            {/* Search Input */}
            <div className="zse-search-wrap">
              <Search size={14} className="zse-search-icon" aria-hidden="true" />
              <input
                type="text"
                placeholder="Filter by target or host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="zse-search-input"
                aria-label="Filter scans by target URL or hostname"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="zse-search-clear"
                  title="Clear search"
                  aria-label="Clear target filter"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="zse-filter-tabs" role="tablist" aria-label="Filter scans by execution status">
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'ALL'}
                onClick={() => setStatusFilter('ALL')}
                className={`zse-filter-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
              >
                All
                <span className="zse-filter-count">{scans.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'ACTIVE'}
                onClick={() => setStatusFilter('ACTIVE')}
                className={`zse-filter-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
              >
                Active
                <span className="zse-filter-count">{activeCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={statusFilter === 'COMPLETED'}
                onClick={() => setStatusFilter('COMPLETED')}
                className={`zse-filter-tab ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
              >
                Completed
                <span className="zse-filter-count">{completedCount}</span>
              </button>
              {failedCount > 0 && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === 'FAILED'}
                  onClick={() => setStatusFilter('FAILED')}
                  className={`zse-filter-tab ${statusFilter === 'FAILED' ? 'active' : ''}`}
                >
                  Failed
                  <span className="zse-filter-count">{failedCount}</span>
                </button>
              )}
            </div>
          </div>

          <div className="zse-toolbar-right">
            {/* Mode Filter Selector */}
            <div className="zse-filter-tabs" role="group" aria-label="Filter scans by assessment mode">
              <button
                type="button"
                onClick={() => setModeFilter('ALL')}
                className={`zse-filter-tab ${modeFilter === 'ALL' ? 'active' : ''}`}
                aria-pressed={modeFilter === 'ALL'}
              >
                All Modes
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('PUBLIC_PASSIVE')}
                className={`zse-filter-tab ${modeFilter === 'PUBLIC_PASSIVE' ? 'active' : ''}`}
                aria-pressed={modeFilter === 'PUBLIC_PASSIVE'}
              >
                Passive
              </button>
              <button
                type="button"
                onClick={() => setModeFilter('VERIFIED_ACTIVE')}
                className={`zse-filter-tab ${modeFilter === 'VERIFIED_ACTIVE' ? 'active' : ''}`}
                aria-pressed={modeFilter === 'VERIFIED_ACTIVE'}
              >
                Active
              </button>
            </div>

            {/* Manual Refresh Button */}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="zse-refresh-btn"
                title="Synchronize scan records"
                aria-label="Refresh scan execution records"
              >
                <RefreshCw size={13} className={isRefreshing ? 'zse-spin' : ''} aria-hidden="true" />
                <span>Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="zse-skeleton-container" aria-busy="true" aria-label="Loading scan execution records">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="zse-skeleton-row">
                <div className="zse-skeleton-box" style={{ width: '240px', height: '22px' }} />
                <div className="zse-skeleton-box" style={{ width: '85px', height: '22px' }} />
                <div className="zse-skeleton-box" style={{ width: '100px', height: '22px' }} />
                <div className="zse-skeleton-box" style={{ width: '75px', height: '22px' }} />
                <div className="zse-skeleton-box" style={{ width: '130px', height: '22px' }} />
                <div className="zse-skeleton-box" style={{ width: '110px', height: '30px' }} />
              </div>
            ))}
          </div>
        ) : scans.length === 0 ? (
          /* Empty State: 0 total scans */
          <div className="zse-empty-state">
            <div className="zse-empty-icon-wrap" aria-hidden="true">
              <FileText size={26} />
            </div>
            <h3 className="zse-empty-title">
              <StaggeredText text="No Scan Executions Recorded" />
            </h3>
            <p className="zse-empty-desc">
              Execute a vulnerability assessment against a registered target to generate cryptographic findings, posture scores, and evidence reports.
            </p>
            {onLaunchNewScan && (
              <button
                type="button"
                onClick={onLaunchNewScan}
                className="zse-empty-cta"
              >
                <span>+</span>
                <span>Launch First Scan</span>
              </button>
            )}
          </div>
        ) : filteredScans.length === 0 ? (
          /* Filtered Empty State: Scans exist but search/filter returned 0 results */
          <div className="zse-empty-state" style={{ padding: '3.5rem 1.5rem' }}>
            <div className="zse-empty-icon-wrap" style={{ background: 'rgba(255, 255, 255, 0.04)', borderColor: 'var(--border-subtle)' }} aria-hidden="true">
              <Search size={22} style={{ color: 'var(--text-muted)' }} />
            </div>
            <h3 className="zse-empty-title" style={{ fontSize: '1.05rem' }}>
              No Matching Scan Executions
            </h3>
            <p className="zse-empty-desc" style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>
              No recorded scan executions match your current search query and filter criteria.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setModeFilter('ALL');
              }}
              className="zse-refresh-btn"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Native HTML Table (Desktop & Tablet >= 768px) */}
            <div className="zse-table-wrap">
              <table className="zse-table">
                <caption className="sr-only">Fleet Scan Execution History and Security Posture Ledger</caption>
                <thead className="zse-thead">
                  <tr>
                    <th scope="col" className="zse-th zse-col-target">Target Endpoint</th>
                    <th scope="col" className="zse-th zse-col-mode">Scan Mode</th>
                    <th scope="col" className="zse-th zse-col-status">Execution Status</th>
                    <th scope="col" className="zse-th zse-col-score">Security Score</th>
                    <th scope="col" className="zse-th zse-col-time">Executed At</th>
                    <th scope="col" className="zse-th zse-th-right zse-col-actions">Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScans.map((s) => {
                    const displayHostname =
                      s.targetHostname ||
                      (s.targetUrl ? s.targetUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') : 'Target Endpoint');
                    const fullUrl = s.targetUrl || `https://${displayHostname}`;

                    return (
                      <tr key={s.id} className="zse-row">
                        {/* 1. Target Identity */}
                        <td className="zse-td zse-col-target">
                          <div className="zse-target-main">
                            <Globe size={14} className="zse-target-icon" aria-hidden="true" />
                            <span className="zse-target-hostname" title={displayHostname}>
                              {displayHostname}
                            </span>
                          </div>
                          <div className="zse-target-sub">
                            <span className="zse-target-url" title={fullUrl}>
                              {fullUrl}
                            </span>
                            <div className="zse-target-actions">
                              <button
                                type="button"
                                onClick={() => handleCopyUrl(s.id, fullUrl)}
                                className="zse-icon-btn"
                                title="Copy endpoint URL"
                                aria-label={`Copy URL for ${displayHostname}`}
                              >
                                {copiedId === s.id ? (
                                  <Check size={11} className="zse-copied-indicator" aria-hidden="true" />
                                ) : (
                                  <Copy size={11} aria-hidden="true" />
                                )}
                              </button>
                              <a
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="zse-icon-btn"
                                title="Open endpoint in new tab"
                                aria-label={`Open ${displayHostname} in new tab`}
                              >
                                <ExternalLink size={11} aria-hidden="true" />
                              </a>
                            </div>
                          </div>
                        </td>

                        {/* 2. Scan Mode */}
                        <td className="zse-td zse-col-mode">
                          <ScanModeBadge mode={s.scanMode} />
                        </td>

                        {/* 3. Execution Status */}
                        <td className="zse-td zse-col-status">
                          <ExecutionStatusBadge
                            status={s.status}
                            errorMessage={s.errorMessage}
                          />
                        </td>

                        {/* 4. Security Score */}
                        <td className="zse-td zse-col-score">
                          <ScoreBadge
                            score={s.score}
                            status={s.status}
                            errorMessage={s.errorMessage}
                          />
                        </td>

                        {/* 5. Executed At Timestamp */}
                        <td className="zse-td zse-col-time">
                          <time dateTime={new Date(s.createdAt).toISOString()}>
                            <div className="zse-time-main">{formatTimestamp(s.createdAt)}</div>
                            <div className="zse-time-relative">{formatRelativeTime(s.createdAt)}</div>
                          </time>
                        </td>

                        {/* 6. Report Action */}
                        <td className="zse-td zse-col-actions">
                          <Link
                            href={`/dashboard/scans/${s.id}`}
                            className="zse-report-link"
                            aria-label={`View security assessment report for ${displayHostname}`}
                          >
                            <span>View Report</span>
                            <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Execution Cards (< 768px) */}
            <div className="zse-mobile-cards" role="region" aria-label="Mobile Scan Execution Cards">
              {filteredScans.map((s) => {
                const displayHostname =
                  s.targetHostname ||
                  (s.targetUrl ? s.targetUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') : 'Target Endpoint');
                const fullUrl = s.targetUrl || `https://${displayHostname}`;

                return (
                  <article key={s.id} className="zse-card" aria-labelledby={`mobile-scan-${s.id}`}>
                    <div className="zse-card-header">
                      <div className="zse-card-identity">
                        <h4 id={`mobile-scan-${s.id}`} className="zse-card-hostname">
                          {displayHostname}
                        </h4>
                        <div className="zse-card-url" title={fullUrl}>
                          {fullUrl}
                        </div>
                      </div>
                      <ExecutionStatusBadge
                        status={s.status}
                        errorMessage={s.errorMessage}
                      />
                    </div>

                    <div className="zse-card-meta-grid">
                      <div className="zse-card-meta-item">
                        <span className="zse-card-meta-label">Security Score</span>
                        <ScoreBadge
                          score={s.score}
                          status={s.status}
                          errorMessage={s.errorMessage}
                        />
                      </div>
                      <div className="zse-card-meta-item">
                        <span className="zse-card-meta-label">Assessment Mode</span>
                        <ScanModeBadge mode={s.scanMode} />
                      </div>
                    </div>

                    <div className="zse-card-footer">
                      <time dateTime={new Date(s.createdAt).toISOString()} className="zse-card-time">
                        {formatTimestamp(s.createdAt)}
                      </time>
                      <Link
                        href={`/dashboard/scans/${s.id}`}
                        className="zse-report-link"
                        aria-label={`View report for ${displayHostname}`}
                      >
                        <span>View Report</span>
                        <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
