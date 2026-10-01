'use client';

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { SeverityBadge } from './SeverityBadge';
import { getRemediationForRule } from '@/core/remediation/remediation-catalog';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export interface FindingItemData {
  id: string;
  scanId?: string;
  targetId?: string;
  organizationId?: string;
  targetUrl?: string;
  ruleId: string;
  title: string;
  severity: string;
  confidence?: string;
  category?: string;
  resourceEndpoint?: string | null;
  evidenceJson?: Record<string, unknown> | null;
  status: string;
  acceptedRiskReason?: string | null;
  cweId?: string | null;
  owaspCategory?: string | null;
  createdAt?: string | Date;
  assignedUserId?: string | null;
  assignedUserEmail?: string | null;
  assignedUserName?: string | null;
  cvssScore?: number | null;
  [key: string]: any;
}

interface FindingsAccordionCardProps {
  finding: FindingItemData;
  isExpanded: boolean;
  onToggleExpand: (findingId: string) => void;
  onOpenRemediation: (finding: any) => void;
  onOpenStatusModal: (finding: any) => void;
  onVerifyFix?: (findingId: string) => Promise<void> | void;
  isVerifying?: boolean;
  verificationResult?: { fixed: boolean; diagnostic: string } | null;
  onOpenCollabModal?: (finding: any) => void;
  showCollab?: boolean;
  showScanLink?: boolean;
}

export function FindingsAccordionCard({
  finding,
  isExpanded,
  onToggleExpand,
  onOpenRemediation,
  onOpenStatusModal,
  onVerifyFix,
  isVerifying = false,
  verificationResult = null,
  onOpenCollabModal,
  showCollab = false,
  showScanLink = false,
}: FindingsAccordionCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLSpanElement>(null);

  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [copiedRepro, setCopiedRepro] = useState(false);

  // Retrieve deterministic remediation guidance and impact from knowledge catalog
  const remediation = getRemediationForRule(finding.ruleId);

  // GSAP animation for smooth expand/collapse and chevron rotation
  useGSAP(
    () => {
      if (typeof window === 'undefined') return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (chevronRef.current) {
        if (prefersReducedMotion) {
          gsap.set(chevronRef.current, { rotation: isExpanded ? 180 : 0 });
        } else {
          gsap.to(chevronRef.current, {
            rotation: isExpanded ? 180 : 0,
            duration: 0.25,
            ease: 'power2.out',
          });
        }
      }

      if (isExpanded && panelRef.current) {
        if (prefersReducedMotion) {
          gsap.set(panelRef.current, { opacity: 1, y: 0 });
        } else {
          gsap.fromTo(
            panelRef.current,
            { opacity: 0, y: -6 },
            { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
          );
        }
      }
    },
    { scope: containerRef, dependencies: [isExpanded] }
  );

  const handleCopyEvidence = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!finding.evidenceJson) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(finding.evidenceJson, null, 2));
      setCopiedEvidence(true);
      setTimeout(() => setCopiedEvidence(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyEndpoint = async (e: React.MouseEvent, endpoint: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(endpoint);
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleCopyRepro = async (e: React.MouseEvent, cmd: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedRepro(true);
      setTimeout(() => setCopiedRepro(false), 2000);
    } catch {
      // Fallback
    }
  };

  // Status mapping
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'status-open';
      case 'CONFIRMED':
        return 'status-confirmed';
      case 'FIXED':
        return 'status-fixed';
      case 'REOPENED':
        return 'status-reopened';
      case 'ACCEPTED_RISK':
        return 'status-accepted-risk';
      case 'FALSE_POSITIVE':
        return 'status-false-positive';
      default:
        return 'status-open';
    }
  };

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case 'ACCEPTED_RISK':
        return 'Accepted Risk';
      case 'FALSE_POSITIVE':
        return 'False Positive';
      default:
        return status;
    }
  };

  const sevLower = (finding.severity || 'info').toLowerCase().replace('informational', 'info');
  const panelId = `finding-panel-${finding.id}`;
  const triggerId = `finding-trigger-${finding.id}`;

  const cweDisplay = finding.cweId || remediation.cwe;
  const owaspDisplay = finding.owaspCategory || remediation.owasp;
  const hasEvidence = finding.evidenceJson && Object.keys(finding.evidenceJson).length > 0;
  const targetEndpoint = finding.resourceEndpoint || finding.targetUrl || null;

  return (
    <article
      ref={containerRef}
      className={`zfc-card sev-${sevLower} ${isExpanded ? 'is-expanded' : ''}`}
      data-testid={`finding-card-${finding.id}`}
      data-severity={sevLower}
    >
      {/* 1. Accordion Trigger Button (Keyboard accessible, WCAG compliant) */}
      <button
        id={triggerId}
        type="button"
        className="zfc-trigger"
        onClick={() => onToggleExpand(finding.id)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        aria-label={`${finding.severity} finding: ${finding.title}. Status: ${finding.status}. Click to ${isExpanded ? 'collapse' : 'expand'}.`}
      >
        <div className="zfc-header-main">
          {/* Metadata Row: Badges, Rule ID, Status, Taxonomy */}
          <div className="zfc-meta-row">
            <SeverityBadge severity={finding.severity} />

            <span className="zfc-tag-rule" title={`Deterministic Rule ID: ${finding.ruleId}`}>
              {finding.ruleId}
            </span>

            <span className={`zfc-tag-status ${getStatusClass(finding.status)}`}>
              {formatStatusLabel(finding.status)}
            </span>

            {finding.confidence && (
              <span className="zfc-tag-taxonomy" title="Detection Confidence">
                {finding.confidence}
              </span>
            )}

            {cweDisplay && (
              <span className="zfc-tag-taxonomy" title="Common Weakness Enumeration">
                {cweDisplay.split(':')[0]}
              </span>
            )}

            {owaspDisplay && (
              <span className="zfc-tag-taxonomy" title="OWASP Top 10 Category">
                {owaspDisplay.split(':')[0]}
              </span>
            )}

            {typeof finding.cvssScore === 'number' && (
              <span className="zfc-tag-taxonomy" title="CVSS Base Score">
                CVSS {finding.cvssScore.toFixed(1)}
              </span>
            )}
          </div>

          {/* Finding Title */}
          <h3 className="zfc-title">{finding.title}</h3>

          {/* Sub-row: Affected Endpoint and Scope */}
          <div className="zfc-sub-row">
            {targetEndpoint && (
              <span className="zfc-endpoint-badge" title="Affected Resource Endpoint">
                <span>📍</span>
                <span className="zfc-endpoint-val">{targetEndpoint}</span>
              </span>
            )}

            {finding.createdAt && (
              <span>
                Discovered:{' '}
                <time dateTime={new Date(finding.createdAt).toISOString()}>
                  {new Date(finding.createdAt).toLocaleDateString()}
                </time>
              </span>
            )}

            {finding.assignedUserEmail && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#60a5fa' }}>
                <span>👤</span>
                <span>{finding.assignedUserName || finding.assignedUserEmail}</span>
              </span>
            )}
          </div>
        </div>

        {/* Expand/Collapse Chevron Indicator */}
        <div className="zfc-chevron-wrapper" aria-hidden="true">
          <span ref={chevronRef} style={{ display: 'inline-flex' }}>
            <svg
              className="zfc-chevron-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      {/* 2. Expanded Technical Evidence & Investigation Panel */}
      {isExpanded && (
        <section
          id={panelId}
          ref={panelRef}
          className="zfc-panel"
          aria-labelledby={triggerId}
          role="region"
        >
          {/* Section A: Description & Business Impact */}
          <div className="zfc-section">
            <div className="zfc-section-title">
              <span>📋</span>
              <span>Finding Description</span>
            </div>
            <p className="zfc-prose">
              {remediation.summary || 'Review server configuration to mitigate potential unauthorized resource access.'}
            </p>

            {remediation.impact && (
              <div className="zfc-impact-box">
                <span className="zfc-impact-label">Security & Operational Impact</span>
                <div>{remediation.impact}</div>
              </div>
            )}
          </div>

          {/* Section B: Affected Endpoint URI */}
          {targetEndpoint && (
            <div className="zfc-section">
              <div className="zfc-section-title">
                <span>🎯</span>
                <span>Affected Endpoint</span>
              </div>
              <div className="zfc-repro-cmd">
                <span style={{ wordBreak: 'break-all' }}>{targetEndpoint}</span>
                <button
                  type="button"
                  className="zfc-evidence-copy-btn"
                  onClick={(e) => handleCopyEndpoint(e, targetEndpoint)}
                  aria-label="Copy affected endpoint URI"
                >
                  {copiedEndpoint ? 'Copied' : 'Copy URI'}
                </button>
              </div>
            </div>
          )}

          {/* Section C: Deterministic Technical Evidence */}
          <div className="zfc-section">
            <div className="zfc-section-title">
              <span>🔬</span>
              <span>Technical Evidence</span>
            </div>

            <div className="zfc-evidence-container">
              <div className="zfc-evidence-header">
                <span className="zfc-evidence-label">
                  <span>Deterministic Payload</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    (Redacted per ADR-0007)
                  </span>
                </span>
                {hasEvidence && (
                  <button
                    type="button"
                    className="zfc-evidence-copy-btn"
                    onClick={handleCopyEvidence}
                    aria-label="Copy technical evidence JSON"
                  >
                    {copiedEvidence ? '✓ Copied' : 'Copy JSON'}
                  </button>
                )}
              </div>

              {hasEvidence ? (
                <pre className="zfc-evidence-pre" tabIndex={0} aria-label="Technical Evidence JSON">
                  <code>{JSON.stringify(finding.evidenceJson, null, 2)}</code>
                </pre>
              ) : (
                <div className="zfc-evidence-empty">
                  Deterministic rule triggered via signature matching. No additional raw payload captured.
                </div>
              )}
            </div>
          </div>

          {/* Section D: Reproduction Procedure */}
          {remediation.cliVerification && (
            <div className="zfc-section">
              <div className="zfc-section-title">
                <span>🔄</span>
                <span>Reproduction Procedure</span>
              </div>

              <div className="zfc-repro-box">
                <div className="zfc-repro-step">
                  <span className="zfc-repro-num">01</span>
                  <div style={{ flex: 1 }}>
                    <div>Execute verification probe request against the affected endpoint:</div>
                    <div className="zfc-repro-cmd">
                      <code>{remediation.cliVerification}</code>
                      <button
                        type="button"
                        className="zfc-evidence-copy-btn"
                        onClick={(e) => handleCopyRepro(e, remediation.cliVerification)}
                        aria-label="Copy CLI reproduction command"
                      >
                        {copiedRepro ? 'Copied' : 'Copy Command'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="zfc-repro-step">
                  <span className="zfc-repro-num">02</span>
                  <div>
                    Inspect HTTP response headers and status codes against deterministic security policy.
                  </div>
                </div>

                <div className="zfc-repro-step">
                  <span className="zfc-repro-num">03</span>
                  <div>
                    Observe vulnerability reproduction or verify that headers reflect the patched security baseline.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section E: Action Strip (Remediation Guide, Verify Fix, Triage) */}
          <div className="zfc-action-strip">
            {/* Primary Action: Remediation Guide */}
            <button
              type="button"
              className="zfc-btn-primary"
              onClick={() => onOpenRemediation(finding)}
              aria-label={`Open remediation guide for ${finding.ruleId}`}
            >
              <span>⚡</span>
              <span>Fix Guide & Code Diff</span>
            </button>

            {/* Operational Action: Verify Fix Now */}
            {onVerifyFix && (
              <button
                type="button"
                className={`zfc-btn-verify ${
                  verificationResult
                    ? verificationResult.fixed
                      ? 'state-verified'
                      : 'state-failed'
                    : ''
                }`}
                onClick={() => onVerifyFix(finding.id)}
                disabled={isVerifying}
                aria-label={`Verify fix for ${finding.title}`}
              >
                {isVerifying ? (
                  <>
                    <span className="zfc-spinner" aria-hidden="true" />
                    <span>Verifying Fix...</span>
                  </>
                ) : verificationResult ? (
                  verificationResult.fixed ? (
                    <>
                      <span>✓</span>
                      <span>Fix Verified (Closed)</span>
                    </>
                  ) : (
                    <>
                      <span>✗</span>
                      <span>Fix Verification Failed</span>
                    </>
                  )
                ) : (
                  <>
                    <span>↻</span>
                    <span>Verify Fix Now</span>
                  </>
                )}
              </button>
            )}

            {/* Triage Action */}
            <button
              type="button"
              className="zfc-btn-secondary"
              onClick={() => onOpenStatusModal(finding)}
              aria-label={`Triage status for ${finding.title}`}
            >
              <span>⚖️</span>
              <span>Triage Status</span>
            </button>

            {/* Collaboration Action (Findings inventory) */}
            {showCollab && onOpenCollabModal && (
              <button
                type="button"
                className="zfc-btn-secondary"
                onClick={() => onOpenCollabModal(finding)}
                aria-label={`Discuss and assign finding ${finding.ruleId}`}
              >
                <span>💬</span>
                <span>Discuss & Assign</span>
              </button>
            )}

            {/* Scan Link */}
            {showScanLink && finding.scanId && (
              <Link
                href={`/dashboard/scans/${finding.scanId}`}
                className="zfc-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                <span>Scan Details →</span>
              </Link>
            )}
          </div>

          {/* Verification Diagnostic Feedback Banner */}
          {verificationResult && (
            <div
              className={`zfc-verify-result ${
                verificationResult.fixed ? 'result-success' : 'result-failure'
              }`}
              role="alert"
              aria-live="polite"
            >
              <span style={{ flexShrink: 0 }}>
                {verificationResult.fixed ? '✅' : '⚠️'}
              </span>
              <div>
                <strong>
                  {verificationResult.fixed
                    ? 'Fix Successfully Verified:'
                    : 'Verification Incomplete:'}
                </strong>{' '}
                <span>{verificationResult.diagnostic}</span>
              </div>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

export { SeverityBadge };
