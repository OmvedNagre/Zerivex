'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Play,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  MoreHorizontal,
  Trash2,
  Crosshair,
  ShieldCheck,
  Eye,
  CalendarClock,
  Lock,
} from 'lucide-react';
import { VerificationStatus } from '@/core/targets/target-service';
import { EnrichedTargetRow } from '@/adapters/dashboard-adapters';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import '@/styles/targets-table.css';

export interface TargetsTableProps {
  rows: EnrichedTargetRow[];
  loading: boolean;
  error?: string | null;
  scanningTargetId?: string | null;
  onRunScan: (targetId: string, isVerified: boolean) => void;
  onDeleteTarget: (targetId: string, hostname: string) => Promise<void> | void;
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

function formatRelativeTime(dateInput: string | null): string {
  if (!dateInput) return 'Never';
  try {
    const diffMs = Date.now() - new Date(dateInput).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateInput));
  } catch {
    return '—';
  }
}

export function TargetsTable({
  rows,
  loading,
  error,
  scanningTargetId,
  onRunScan,
  onDeleteTarget,
  onOpenRegisterModal,
  onRetry,
}: TargetsTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Type-to-confirm delete modal state
  const [targetToDelete, setTargetToDelete] = useState<{ id: string; hostname: string } | null>(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopyUrl = async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleExecuteDelete = async () => {
    if (!targetToDelete) return;
    try {
      setIsDeleting(true);
      await onDeleteTarget(targetToDelete.id, targetToDelete.hostname);
      setTargetToDelete(null);
      setConfirmInput('');
    } finally {
      setIsDeleting(false);
    }
  };

  // 1. Loading Skeleton
  if (loading && rows.length === 0) {
    return (
      <div
        style={{
          padding: '64px',
          textAlign: 'center',
          backgroundColor: 'var(--ds-bg-card)',
          borderRadius: 'var(--ds-radius-lg)',
          border: '1px solid var(--ds-border-subtle)',
          color: 'var(--ds-text-muted)',
          boxShadow: 'var(--ds-shadow-1)',
        }}
      >
        <Loader2 size={24} className="zse-spin" style={{ margin: '0 auto 12px' }} />
        <span>Loading registered sites...</span>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div
        style={{
          padding: '36px',
          textAlign: 'center',
          backgroundColor: 'var(--ds-danger-bg)',
          borderRadius: 'var(--ds-radius-lg)',
          border: '1px solid rgba(209, 0, 47, 0.2)',
          color: 'var(--ds-danger)',
        }}
      >
        <AlertTriangle size={28} style={{ margin: '0 auto 12px' }} />
        <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
          Couldn&apos;t load sites
        </div>
        <p style={{ fontSize: '13px', margin: '0 0 16px', color: 'var(--ds-text-secondary)' }}>{error}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  // 3. Empty State
  if (rows.length === 0) {
    return (
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
        <Crosshair size={40} style={{ color: 'var(--ds-action-brand)', margin: '0 auto 16px' }} />
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: 'var(--ds-text-primary)',
            margin: '0 0 8px',
            fontFamily: 'var(--font-display)',
          }}
        >
          No sites added yet
        </h3>
        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--ds-text-secondary)',
            maxWidth: '440px',
            margin: '0 auto 24px',
            lineHeight: 1.5,
          }}
        >
          Add your site, prove it&apos;s yours with a DNS TXT record or HTML meta tag, then run deterministic vulnerability checks.
        </p>
        {onOpenRegisterModal && (
          <Button variant="brand" onClick={onOpenRegisterModal}>
            Register your first site
          </Button>
        )}
      </div>
    );
  }

  // 4. Enriched Targets Table
  return (
    <>
      <div
        style={{
          backgroundColor: 'var(--ds-bg-card)',
          borderRadius: 'var(--ds-radius-lg)',
          border: '1px solid var(--ds-border-subtle)',
          overflow: 'hidden',
          boxShadow: 'var(--ds-shadow-1)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--ds-bg-subtle)', borderBottom: '1px solid var(--ds-border-subtle)' }}>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Site
                </th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Status
                </th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Score
                </th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Open Issues
                </th>
                <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Last Scan
                </th>
                <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isScanning = scanningTargetId === row.targetId;
                const isVerified = row.verificationStatus === 'VERIFIED';

                return (
                  <tr
                    key={row.targetId}
                    style={{
                      borderBottom: '1px solid var(--ds-border-subtle)',
                      transition: 'background-color 120ms ease',
                    }}
                  >
                    {/* Column 1: Site */}
                    <td style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Link
                            href={`/dashboard/targets/${row.targetId}`}
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: 'var(--ds-text-primary)',
                              textDecoration: 'none',
                            }}
                          >
                            {row.hostname}
                          </Link>
                          <a
                            href={row.targetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--ds-text-muted)', display: 'inline-flex' }}
                            title="Open site in new tab"
                            aria-label={`Open ${row.hostname} in new tab`}
                          >
                            <ExternalLink size={12} />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(row.targetId, row.targetUrl)}
                            style={{
                              border: 'none',
                              background: 'none',
                              color: copiedId === row.targetId ? 'var(--ds-success)' : 'var(--ds-text-muted)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              padding: 0,
                            }}
                            title="Copy URL"
                            aria-label="Copy URL"
                          >
                            {copiedId === row.targetId ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--ds-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {row.targetUrl}
                        </span>
                      </div>
                    </td>

                    {/* Column 2: Status Pill */}
                    <td style={{ padding: '16px 20px' }}>
                      <StatusBadge status={row.verificationStatus} />
                    </td>

                    {/* Column 3: Score */}
                    <td style={{ padding: '16px 20px' }}>
                      {row.score !== null ? (
                        <span
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            fontFamily: 'var(--font-mono)',
                            color:
                              row.score >= 90
                                ? 'var(--ds-success)'
                                : row.score >= 70
                                ? 'var(--ds-warning)'
                                : 'var(--ds-danger)',
                          }}
                        >
                          {row.score} / 100
                        </span>
                      ) : (
                        <span style={{ fontSize: '12.5px', color: 'var(--ds-text-muted)' }}>n/a</span>
                      )}
                    </td>

                    {/* Column 4: Open Issues */}
                    <td style={{ padding: '16px 20px' }}>
                      {row.openIssues.total > 0 ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {row.openIssues.critical > 0 && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--ds-danger-bg)',
                                color: 'var(--ds-danger)',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {row.openIssues.critical}C
                            </span>
                          )}
                          {row.openIssues.high > 0 && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--ds-warning-bg)',
                                color: 'var(--ds-warning)',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {row.openIssues.high}H
                            </span>
                          )}
                          {row.openIssues.medium > 0 && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--ds-info-bg)',
                                color: 'var(--ds-info)',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {row.openIssues.medium}M
                            </span>
                          )}
                          {row.openIssues.low > 0 && (
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'var(--ds-bg-subtle)',
                                color: 'var(--ds-text-secondary)',
                                fontSize: '11px',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                              }}
                            >
                              {row.openIssues.low}L
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--ds-success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} />
                          <span>0 issues</span>
                        </span>
                      )}
                    </td>

                    {/* Column 5: Last Scan */}
                    <td style={{ padding: '16px 20px', color: 'var(--ds-text-secondary)', fontSize: '13px' }}>
                      {formatRelativeTime(row.lastScanTimestamp)}
                    </td>

                    {/* Column 6: Actions */}
                    <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {/* Primary per-row action: Run scan (secondary button) */}
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isScanning}
                          onClick={() => onRunScan(row.targetId, isVerified)}
                          icon={
                            isScanning ? (
                              <Loader2 size={13} className="zse-spin" />
                            ) : (
                              <Play size={11} fill="currentColor" />
                            )
                          }
                        >
                          {isScanning ? 'Scanning...' : isVerified ? 'Run scan' : 'Scan (passive)'}
                        </Button>

                        {/* `⋯` Action Menu */}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              type="button"
                              className="zx-row-more-btn"
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: 'var(--ds-radius-md)',
                                border: '1px solid var(--ds-border-subtle)',
                                backgroundColor: 'var(--ds-bg-card)',
                                color: 'var(--ds-text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                              aria-label={`Actions for ${row.hostname}`}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </DropdownMenu.Trigger>

                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              side="bottom"
                              align="end"
                              sideOffset={6}
                              style={{
                                width: '200px',
                                backgroundColor: 'var(--ds-bg-card)',
                                borderRadius: 'var(--ds-radius-md)',
                                border: '1px solid var(--ds-border-subtle)',
                                boxShadow: 'var(--ds-shadow-2)',
                                padding: '6px',
                                zIndex: 100,
                              }}
                            >
                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/dashboard/targets/${row.targetId}`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    fontSize: '13px',
                                    color: 'var(--ds-text-primary)',
                                    textDecoration: 'none',
                                    borderRadius: 'var(--ds-radius-sm)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Eye size={14} />
                                  <span>Details</span>
                                </Link>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/dashboard/targets/${row.targetId}/surface`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    fontSize: '13px',
                                    color: 'var(--ds-text-primary)',
                                    textDecoration: 'none',
                                    borderRadius: 'var(--ds-radius-sm)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <ShieldCheck size={14} />
                                  <span>Attack Surface &amp; Verify</span>
                                </Link>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/dashboard/targets/${row.targetId}/monitoring`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    fontSize: '13px',
                                    color: 'var(--ds-text-primary)',
                                    textDecoration: 'none',
                                    borderRadius: 'var(--ds-radius-sm)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <CalendarClock size={14} />
                                  <span>Monitoring &amp; Schedules</span>
                                </Link>
                              </DropdownMenu.Item>

                              <DropdownMenu.Item asChild>
                                <Link
                                  href={`/dashboard/targets/${row.targetId}/ci-cd`}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    fontSize: '13px',
                                    color: 'var(--ds-text-primary)',
                                    textDecoration: 'none',
                                    borderRadius: 'var(--ds-radius-sm)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Lock size={14} />
                                  <span>CI/CD Quality Gates</span>
                                </Link>
                              </DropdownMenu.Item>

                              <DropdownMenu.Separator style={{ height: '1px', backgroundColor: 'var(--ds-border-subtle)', margin: '4px 0' }} />

                              <DropdownMenu.Item
                                onSelect={() => {
                                  setTargetToDelete({ id: row.targetId, hostname: row.hostname });
                                  setConfirmInput('');
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 10px',
                                  fontSize: '13px',
                                  color: 'var(--ds-danger)',
                                  borderRadius: 'var(--ds-radius-sm)',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={14} />
                                <span>Delete Site...</span>
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Type-To-Confirm Delete Dialog */}
      {targetToDelete && (
        <Modal
          isOpen={Boolean(targetToDelete)}
          onClose={() => {
            if (!isDeleting) {
              setTargetToDelete(null);
              setConfirmInput('');
            }
          }}
          title="Delete Target Site"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13.5px', color: 'var(--ds-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              This action cannot be undone. All recorded vulnerabilities, historical scan reports, and verification tokens for{' '}
              <strong style={{ color: 'var(--ds-text-primary)' }}>{targetToDelete.hostname}</strong> will be permanently purged.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                Type <code style={{ color: 'var(--ds-danger)', fontFamily: 'var(--font-mono)' }}>{targetToDelete.hostname}</code> to confirm:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={targetToDelete.hostname}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--ds-radius-md)',
                  border: '1px solid var(--ds-border-default)',
                  backgroundColor: 'var(--ds-bg-card)',
                  color: 'var(--ds-text-primary)',
                  fontSize: '13.5px',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button
                variant="secondary"
                disabled={isDeleting}
                onClick={() => {
                  setTargetToDelete(null);
                  setConfirmInput('');
                }}
              >
                Cancel
              </Button>
              <button
                type="button"
                disabled={confirmInput !== targetToDelete.hostname || isDeleting}
                onClick={handleExecuteDelete}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--ds-radius-md)',
                  border: 'none',
                  backgroundColor: 'var(--ds-danger)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: confirmInput === targetToDelete.hostname && !isDeleting ? 'pointer' : 'not-allowed',
                  opacity: confirmInput === targetToDelete.hostname && !isDeleting ? 1 : 0.5,
                }}
              >
                {isDeleting ? 'Deleting...' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
