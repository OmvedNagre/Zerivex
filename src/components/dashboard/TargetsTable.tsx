'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Play,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  ShieldCheck,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Target, VerificationStatus, VerificationMethod, VerificationScope } from '@/core/targets/target-service';
import { StaggeredText } from '@/components/ui/StaggeredText';

export interface TargetsTableProps {
  targets: Target[];
  loading: boolean;
  error?: string | null;
  scanningTargetId?: string | null;
  onRunScan: (targetId: string, isVerified: boolean) => void;
  onDeleteTarget: (targetId: string, targetUrl: string) => void;
  onOpenRegisterModal?: () => void;
  onRetry?: () => void;
}

export function StatusBadge({ status }: { status: VerificationStatus | string }) {
  switch (status) {
    case 'VERIFIED':
      return (
        <span
          className="ztt-badge ztt-badge-verified"
          role="status"
          aria-label="Verification status: Verified"
        >
          <CheckCircle2 size={12} className="ztt-badge-icon" aria-hidden="true" />
          <span>VERIFIED</span>
        </span>
      );
    case 'PENDING':
      return (
        <span
          className="ztt-badge ztt-badge-pending"
          role="status"
          aria-label="Verification status: Pending"
        >
          <Clock size={12} className="ztt-badge-icon" aria-hidden="true" />
          <span>PENDING</span>
        </span>
      );
    case 'UNVERIFIED':
      return (
        <span
          className="ztt-badge ztt-badge-unverified"
          role="status"
          aria-label="Verification status: Unverified"
        >
          <AlertTriangle size={12} className="ztt-badge-icon" aria-hidden="true" />
          <span>UNVERIFIED</span>
        </span>
      );
    case 'REVOKED':
    default:
      return (
        <span
          className="ztt-badge ztt-badge-revoked"
          role="status"
          aria-label={`Verification status: ${status || 'Revoked'}`}
        >
          <ShieldAlert size={12} className="ztt-badge-icon" aria-hidden="true" />
          <span>{status || 'REVOKED'}</span>
        </span>
      );
  }
}

function formatScope(scope?: VerificationScope | string): string {
  switch (scope) {
    case 'EXACT_HOST':
      return 'Exact Host';
    case 'DOMAIN':
      return 'Apex Domain';
    case 'SUBDOMAIN_WILDCARD':
      return 'Wildcard (*)';
    case 'URL_PATH':
      return 'Path Prefix';
    default:
      return scope || 'Exact Host';
  }
}

function formatMethod(method?: VerificationMethod | string): string {
  switch (method) {
    case 'DNS_TXT':
      return 'DNS TXT';
    case 'HTML_META':
      return 'HTML Meta';
    case 'HTTP_HEADER':
      return 'HTTP Header';
    default:
      return method || 'DNS TXT';
  }
}

function formatDate(dateInput: Date | string | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

export function TargetsTable({
  targets,
  loading,
  error,
  scanningTargetId,
  onRunScan,
  onDeleteTarget,
  onOpenRegisterModal,
  onRetry,
}: TargetsTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // GSAP subtle entrance animation
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

  const handleTriggerDelete = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = (id: string, url: string) => {
    setConfirmDeleteId(null);
    onDeleteTarget(id, url);
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  // Close delete confirmation on outside click or escape
  useEffect(() => {
    if (!confirmDeleteId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmDeleteId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmDeleteId]);

  return (
    <div ref={containerRef} className="ztt-container" aria-label="Target Asset Registry">
      {/* Error Banner */}
      {error && (
        <div className="ztt-error-banner" role="alert">
          <div className="ztt-error-msg-wrap">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Failed to load targets: {error}</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ztt-error-retry-btn"
              type="button"
              aria-label="Retry loading targets"
            >
              <RefreshCw size={13} aria-hidden="true" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="ztt-skeleton-container" aria-busy="true" aria-label="Loading registered targets">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="ztt-skeleton-row">
              <div className="ztt-skeleton-box" style={{ width: '220px', height: '22px' }} />
              <div className="ztt-skeleton-box" style={{ width: '90px', height: '22px' }} />
              <div className="ztt-skeleton-box" style={{ width: '80px', height: '22px' }} />
              <div className="ztt-skeleton-box" style={{ width: '70px', height: '22px' }} />
              <div className="ztt-skeleton-box" style={{ width: '85px', height: '22px' }} />
              <div className="ztt-skeleton-box" style={{ width: '140px', height: '32px', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>
      ) : targets.length === 0 ? (
        /* Empty State */
        <div className="ztt-empty-state">
          <div className="ztt-empty-icon-wrap" aria-hidden="true">
            <ShieldCheck size={28} />
          </div>
          <h3 className="ztt-empty-title">
            <StaggeredText text="No Targets Registered Yet" />
          </h3>
          <p className="ztt-empty-desc">
            Register your production web applications, APIs, or domains to initiate cryptographic ownership verification and automated vulnerability assessments.
          </p>
          {onOpenRegisterModal && (
            <button
              onClick={onOpenRegisterModal}
              className="ztt-empty-cta"
              type="button"
            >
              <span>+</span>
              <span>Register First Target</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop & Tablet Table */}
          <div className="ztt-table-wrap">
            <table className="ztt-table">
              <thead className="ztt-thead">
                <tr>
                  <th scope="col" className="ztt-th ztt-endpoint-col">Target Endpoint</th>
                  <th scope="col" className="ztt-th ztt-status-col">Verification Status</th>
                  <th scope="col" className="ztt-th ztt-scope-col">Scope</th>
                  <th scope="col" className="ztt-th ztt-method-col">Method</th>
                  <th scope="col" className="ztt-th ztt-date-col">Registered</th>
                  <th scope="col" className="ztt-th ztt-th-actions ztt-actions-col">Actions</th>
                </tr>
              </thead>
              <tbody className="ztt-tbody">
                {targets.map((t) => {
                  const isScanning = scanningTargetId === t.id;
                  const isVerified = t.verificationStatus === 'VERIFIED';
                  const isConfirmingDelete = confirmDeleteId === t.id;
                  const displayHostname = t.hostname || t.targetUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

                  return (
                    <tr key={t.id} className="ztt-row">
                      {/* 1. Target Identity */}
                      <td className="ztt-td ztt-endpoint-col">
                        <div className="ztt-endpoint-main">
                          <Globe size={14} className="ztt-endpoint-icon" aria-hidden="true" />
                          <span className="ztt-hostname" title={displayHostname}>{displayHostname}</span>
                        </div>
                        <div className="ztt-endpoint-sub">
                          <span className="ztt-url-text" title={t.targetUrl}>
                            {t.targetUrl}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(t.id, t.targetUrl)}
                            className="ztt-quick-btn"
                            title="Copy full target URL"
                            aria-label={`Copy URL for ${displayHostname}`}
                          >
                            {copiedId === t.id ? (
                              <Check size={12} className="ztt-copied-indicator" aria-hidden="true" />
                            ) : (
                              <Copy size={12} aria-hidden="true" />
                            )}
                          </button>
                          <a
                            href={t.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ztt-quick-btn"
                            title="Open URL in new tab"
                            aria-label={`Open ${displayHostname} in new tab`}
                          >
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </div>
                      </td>

                      {/* 2. Verification Status */}
                      <td className="ztt-td ztt-status-col">
                        <StatusBadge status={t.verificationStatus} />
                      </td>

                      {/* 3. Scope */}
                      <td className="ztt-td ztt-scope-col">
                        <span className="ztt-scope-tag">{formatScope(t.verificationScope)}</span>
                      </td>

                      {/* 4. Method */}
                      <td className="ztt-td ztt-method-col">
                        <span className="ztt-method-text">{formatMethod(t.verificationMethod)}</span>
                      </td>

                      {/* 5. Registered Date */}
                      <td className="ztt-td ztt-date-col">
                        <time dateTime={new Date(t.createdAt).toISOString()} className="ztt-date-text">
                          {formatDate(t.createdAt)}
                        </time>
                      </td>

                      {/* 6. Row Actions */}
                      <td className="ztt-td ztt-actions-col">
                        <div className="ztt-actions-group">
                          {/* Primary Action: Run Scan */}
                          <button
                            type="button"
                            onClick={() => onRunScan(t.id, isVerified)}
                            disabled={isScanning}
                            className="ztt-btn-scan"
                            title={isVerified ? 'Launch verified active security scan' : 'Launch public passive security scan'}
                            aria-label={`Run security scan on ${displayHostname}`}
                          >
                            {isScanning ? (
                              <>
                                <Loader2 size={12} className="ztt-spin" aria-hidden="true" />
                                <span>Scanning...</span>
                              </>
                            ) : (
                              <>
                                <Play size={11} fill="currentColor" aria-hidden="true" />
                                <span>Run Scan</span>
                              </>
                            )}
                          </button>

                          {/* Secondary Action: Details or Verify Domain */}
                          <Link
                            href={`/dashboard/targets/${t.id}`}
                            className={`ztt-link-details ${!isVerified ? 'ztt-link-verify' : ''}`}
                            aria-label={isVerified ? `View target details for ${displayHostname}` : `Verify domain ownership for ${displayHostname}`}
                          >
                            <span>{isVerified ? 'Details' : 'Verify Domain'}</span>
                            <span aria-hidden="true">→</span>
                          </Link>

                          {/* Destructive Action: Delete */}
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <button
                              type="button"
                              onClick={() => handleTriggerDelete(t.id)}
                              className="ztt-btn-delete"
                              title="Delete target asset"
                              aria-label={`Delete target ${displayHostname}`}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>

                            {/* Safe Inline Delete Confirmation */}
                            {isConfirmingDelete && (
                              <div className="ztt-delete-confirm-popover" role="dialog" aria-label="Confirm Target Deletion">
                                <span className="ztt-confirm-text">Delete target?</span>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDelete(t.id, t.targetUrl)}
                                  className="ztt-confirm-btn-yes"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelDelete}
                                  className="ztt-confirm-btn-cancel"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Transformation (< 640px) */}
          <div className="ztt-mobile-cards" role="region" aria-label="Target Asset Cards">
            {targets.map((t) => {
              const isScanning = scanningTargetId === t.id;
              const isVerified = t.verificationStatus === 'VERIFIED';
              const isConfirmingDelete = confirmDeleteId === t.id;
              const displayHostname = t.hostname || t.targetUrl.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

              return (
                <article key={t.id} className="ztt-card" aria-labelledby={`mobile-card-title-${t.id}`}>
                  {/* Card Header: Identity & Status */}
                  <div className="ztt-card-header">
                    <div className="ztt-card-identity">
                      <h4 id={`mobile-card-title-${t.id}`} className="ztt-card-hostname">
                        {displayHostname}
                      </h4>
                      <div className="ztt-card-url" title={t.targetUrl}>
                        {t.targetUrl}
                      </div>
                    </div>
                    <StatusBadge status={t.verificationStatus} />
                  </div>

                  {/* Card Metadata Grid */}
                  <div className="ztt-card-meta-grid">
                    <div className="ztt-card-meta-item">
                      <span className="ztt-card-meta-label">Scope</span>
                      <span className="ztt-card-meta-value">{formatScope(t.verificationScope)}</span>
                    </div>
                    <div className="ztt-card-meta-item">
                      <span className="ztt-card-meta-label">Method</span>
                      <span className="ztt-card-meta-value">{formatMethod(t.verificationMethod)}</span>
                    </div>
                    <div className="ztt-card-meta-item">
                      <span className="ztt-card-meta-label">Registered</span>
                      <time dateTime={new Date(t.createdAt).toISOString()} className="ztt-card-meta-value">
                        {formatDate(t.createdAt)}
                      </time>
                    </div>
                    <div className="ztt-card-meta-item">
                      <span className="ztt-card-meta-label">Quick Copy</span>
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(t.id, t.targetUrl)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: copiedId === t.id ? 'var(--emerald)' : 'var(--accent-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedId === t.id ? (
                          <>
                            <Check size={12} aria-hidden="true" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={12} aria-hidden="true" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Actions Bar */}
                  <div className="ztt-card-actions">
                    <button
                      type="button"
                      onClick={() => onRunScan(t.id, isVerified)}
                      disabled={isScanning}
                      className="ztt-card-btn-scan"
                      aria-label={`Run scan on ${displayHostname}`}
                    >
                      {isScanning ? (
                        <>
                          <Loader2 size={13} className="ztt-spin" aria-hidden="true" />
                          <span>Scanning...</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="currentColor" aria-hidden="true" />
                          <span>Run Scan</span>
                        </>
                      )}
                    </button>

                    <Link
                      href={`/dashboard/targets/${t.id}`}
                      className="ztt-card-link-details"
                      aria-label={isVerified ? `View details for ${displayHostname}` : `Verify domain ownership for ${displayHostname}`}
                    >
                      <span>{isVerified ? 'Details' : 'Verify'}</span>
                      <span aria-hidden="true">→</span>
                    </Link>

                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => handleTriggerDelete(t.id)}
                        className="ztt-card-btn-delete"
                        aria-label={`Delete target ${displayHostname}`}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>

                      {isConfirmingDelete && (
                        <div
                          className="ztt-delete-confirm-popover"
                          style={{ right: 0, bottom: '48px' }}
                          role="dialog"
                          aria-label="Confirm Target Deletion"
                        >
                          <span className="ztt-confirm-text">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleConfirmDelete(t.id, t.targetUrl)}
                            className="ztt-confirm-btn-yes"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelDelete}
                            className="ztt-confirm-btn-cancel"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
