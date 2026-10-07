'use client';

import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { RuleRemediation } from '@/core/remediation/remediation-catalog';
import {
  FileCode,
  Check,
  AlertTriangle,
  Copy,
  Terminal,
  CheckCircle2,
  Shield,
  Folder,
  Zap,
} from 'lucide-react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export type SupportedFramework = 'nextjs' | 'express' | 'nginx';

/* ==========================================================================
   1. FRAMEWORK REMEDIATION TABS
   ========================================================================== */
interface FrameworkRemediationTabsProps {
  frameworks: SupportedFramework[];
  activeFramework: SupportedFramework;
  onSelectFramework: (fw: SupportedFramework) => void;
  className?: string;
}

export function FrameworkRemediationTabs({
  frameworks,
  activeFramework,
  onSelectFramework,
  className = '',
}: FrameworkRemediationTabsProps) {
  const tablistRef = useRef<HTMLDivElement>(null);

  const getFrameworkLabel = (fw: SupportedFramework) => {
    switch (fw) {
      case 'nextjs':
        return 'Next.js (App / Pages)';
      case 'express':
        return 'Express.js';
      case 'nginx':
        return 'Nginx Conf';
      default:
        return fw;
    }
  };

  const getFrameworkIcon = (fw: SupportedFramework) => {
    switch (fw) {
      case 'nextjs':
        return 'Next.js';
      case 'express':
        return 'Express';
      case 'nginx':
        return 'Nginx';
      default:
        return fw;
    }
  };

  // Keyboard navigation for accessible tablist (Left/Right arrow keys)
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (frameworks.length <= 1) return;
    let nextIndex = -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      nextIndex = (index + 1) % frameworks.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      nextIndex = (index - 1 + frameworks.length) % frameworks.length;
    } else if (e.key === 'Home') {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      nextIndex = frameworks.length - 1;
    }

    if (nextIndex !== -1) {
      const nextFw = frameworks[nextIndex];
      if (nextFw) {
        onSelectFramework(nextFw);
        const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        buttons?.[nextIndex]?.focus();
      }
    }
  };

  return (
    <div
      ref={tablistRef}
      className={`zrm-tablist ${className}`}
      role="tablist"
      aria-label="Target Application Framework"
    >
      {frameworks.map((fw, idx) => {
        const isActive = activeFramework === fw;
        return (
          <button
            key={fw}
            id={`remediation-tab-${fw}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`remediation-panel-${fw}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectFramework(fw)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`zrm-tab ${isActive ? 'is-active' : ''}`}
          >
            <span aria-hidden="true" style={{ fontSize: '0.75rem', opacity: 0.9 }}>
              {getFrameworkIcon(fw)}
            </span>
            <span>{getFrameworkLabel(fw)}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   2. CODE VIEWER & DIFF SURFACE
   ========================================================================== */
interface CodeViewerProps {
  filename: string;
  diffCode: string;
  explanation?: string;
  onCopySuccess?: () => void;
  className?: string;
}

export function CodeViewer({
  filename,
  diffCode,
  explanation,
  onCopySuccess,
  className = '',
}: CodeViewerProps) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const codeContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diffCode);
      setCopied(true);
      setCopyError(false);
      onCopySuccess?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
      setTimeout(() => setCopyError(false), 3000);
    }
  };

  // Render unified diff with syntax-colored additions and deletions
  const renderFormattedDiff = () => {
    const lines = diffCode.split('\n');
    return lines.map((line, idx) => {
      let lineClass = '';
      if (line.startsWith('+') && !line.startsWith('+++')) {
        lineClass = 'zrm-line-add';
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        lineClass = 'zrm-line-del';
      } else if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        lineClass = 'zrm-line-comment';
      }

      return (
        <span key={idx} className={lineClass}>
          {line}
          {idx < lines.length - 1 ? '\n' : ''}
        </span>
      );
    });
  };

  return (
    <div ref={codeContainerRef} className={`zrm-code-container ${className}`}>
      {/* Code Toolbar */}
      <div className="zrm-code-toolbar">
        <div className="zrm-code-toolbar-left">
          <FileCode size={14} aria-hidden="true" />
          <span style={{ fontWeight: 600 }}>{filename}</span>
          <span className="zrm-diff-pill">UNIFIED DIFF</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`zrm-copy-btn ${copied ? 'is-copied' : ''}`}
          aria-label={copied ? 'Code snippet copied to clipboard' : `Copy remediation code for ${filename}`}
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : copyError ? (
            <>
              <AlertTriangle size={13} aria-hidden="true" />
              <span>Copy Failed</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
              <span>Copy Code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Surface */}
      <pre
        className="zrm-code-pre"
        tabIndex={0}
        aria-label={`Remediation patch for ${filename}`}
        aria-description={explanation}
      >
        <code>{renderFormattedDiff()}</code>
      </pre>
    </div>
  );
}

/* ==========================================================================
   3. CLI VERIFICATION COMMAND PRESENTATION
   ========================================================================== */
interface TerminalVerificationProps {
  command: string;
  className?: string;
}

export function TerminalVerificationCommand({ command, className = '' }: TerminalVerificationProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={`zrm-cli-box ${className}`}>
      <div className="zrm-cli-header">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <Terminal size={14} aria-hidden="true" />
          <span>Local CLI Verification Probe</span>
        </span>

        <button
          type="button"
          onClick={handleCopyCommand}
          className={`zrm-copy-btn ${copied ? 'is-copied' : ''}`}
          aria-label={copied ? 'Verification command copied' : 'Copy curl verification command'}
        >
          {copied ? (
            <>
              <Check size={13} aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
              <span>Copy Command</span>
            </>
          )}
        </button>
      </div>

      <pre className="zrm-cli-pre" tabIndex={0} aria-label="Terminal CLI verification command">
        <span className="zrm-cli-prompt" aria-hidden="true">$</span>
        <code className="zrm-cli-cmd">{command}</code>
      </pre>
    </div>
  );
}

/* ==========================================================================
   4. FULL FRAMEWORK REMEDIATION WORKSTATION MODAL
   ========================================================================== */
export interface FrameworkRemediationModalProps {
  finding: {
    id: string;
    ruleId: string;
    title: string;
    severity?: string;
    cweId?: string | null;
    targetUrl?: string;
    resourceEndpoint?: string | null;
  } | null;
  remediationData: RuleRemediation | null;
  targetUrl?: string;
  onClose: () => void;
  onVerifyFix: (findingId: string) => Promise<void> | void;
  isVerifying?: boolean;
  verificationResult?: { fixed: boolean; diagnostic: string } | null;
}

export function FrameworkRemediationModal({
  finding,
  remediationData,
  targetUrl,
  onClose,
  onVerifyFix,
  isVerifying = false,
  verificationResult = null,
}: FrameworkRemediationModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Available frameworks in this rule
  const availableFrameworks = (['nextjs', 'express', 'nginx'] as const).filter(
    (fw) => !!remediationData?.frameworks[fw]
  );

  const [activeFramework, setActiveFramework] = useState<SupportedFramework>(
    availableFrameworks[0] || 'nextjs'
  );

  // Synchronize initial framework when remediationData changes
  useEffect(() => {
    const defaultFw = availableFrameworks[0];
    if (defaultFw && !availableFrameworks.includes(activeFramework)) {
      setActiveFramework(defaultFw);
    }
  }, [remediationData, availableFrameworks, activeFramework]);

  const [verifiedFramework, setVerifiedFramework] = useState<SupportedFramework | null>(
    verificationResult ? (availableFrameworks[0] || 'nextjs') : null
  );

  // When verificationResult updates, associate it with the currently active framework
  useEffect(() => {
    if (verificationResult) {
      setVerifiedFramework(activeFramework);
    } else {
      setVerifiedFramework(null);
    }
  }, [verificationResult]);

  // Active result is only shown if it matches the current framework tab
  const activeVerificationResult = activeFramework === verifiedFramework ? verificationResult : null;

  // Keyboard accessibility: Escape closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Subtle GSAP entrance animation for modal dialog
  useGSAP(
    () => {
      if (typeof window === 'undefined' || !dialogRef.current) return;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        gsap.fromTo(
          dialogRef.current,
          { opacity: 0, scale: 0.97, y: 8 },
          { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'power2.out' }
        );
      }
    },
    { scope: dialogRef }
  );

  // Subtle transition when switching frameworks
  useGSAP(
    () => {
      if (typeof window === 'undefined' || !panelRef.current) return;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (!prefersReducedMotion) {
        gsap.fromTo(
          panelRef.current,
          { opacity: 0.4, y: 3 },
          { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }
        );
      }
    },
    { scope: panelRef, dependencies: [activeFramework] }
  );

  if (!finding || !remediationData) return null;

  const currentFrameworkData = remediationData.frameworks[activeFramework];
  const effectiveTarget = targetUrl || finding.targetUrl || 'YOUR_TARGET_URL';
  const cliCommand = remediationData.cliVerification
    ? remediationData.cliVerification.replace(/YOUR_TARGET_URL|YOUR_HOST/g, effectiveTarget)
    : '';

  return (
    <div
      className="zrm-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="zrm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remediation-modal-title"
      >
        {/* 1. Header & Identification (Sticky Top) */}
        <div className="zrm-dialog-header">
          <div className="zrm-header">
            <div className="zrm-header-main">
              <div className="zrm-header-meta">
                <span className="zrm-rule-badge" title="Deterministic Scanner Rule ID">
                  {remediationData.ruleId}
                </span>
                {remediationData.cwe && (
                  <span className="zrm-cwe-tag" title="Common Weakness Enumeration">
                    {remediationData.cwe}
                  </span>
                )}
                {remediationData.owasp && (
                  <span className="zrm-cwe-tag" title="OWASP Category">
                    {remediationData.owasp.split(':')[0]}
                  </span>
                )}
              </div>

              <h2 id="remediation-modal-title" className="zrm-title">
                {remediationData.title}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="zrm-close-btn"
              aria-label="Close remediation guide"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="6" />
              </svg>
            </button>
          </div>
        </div>

        {/* 2. Scrollable Workstation Body */}
        <div className="zrm-dialog-body">
          {/* Live Fix Verification Result Banner */}
          {activeVerificationResult && (
            <div
              className={`zrm-result-banner ${
                activeVerificationResult.fixed ? 'result-success' : 'result-failure'
              }`}
              role="alert"
              aria-live="polite"
            >
              <span style={{ flexShrink: 0 }}>
                {activeVerificationResult.fixed ? (
                  <CheckCircle2 size={16} color="var(--ds-success)" />
                ) : (
                  <AlertTriangle size={16} color="var(--ds-warning)" />
                )}
              </span>
              <div>
                <div className="zrm-result-title">
                  {activeVerificationResult.fixed
                    ? 'Target Fix Successfully Verified'
                    : 'Fix Verification Incomplete (Rule Condition Still Triggered)'}
                </div>
                <div>{activeVerificationResult.diagnostic}</div>
              </div>
            </div>
          )}

          {/* Cross-framework verification notice when tab switched */}
          {verificationResult && !activeVerificationResult && verifiedFramework && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '0.5rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              Target endpoint was verified while viewing{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {verifiedFramework === 'nextjs' ? 'Next.js' : verifiedFramework === 'express' ? 'Express' : 'Nginx'}
              </strong>
              . Switch back to view that result, or re-verify for{' '}
              <strong style={{ color: 'var(--text-secondary)' }}>
                {activeFramework === 'nextjs' ? 'Next.js' : activeFramework === 'express' ? 'Express' : 'Nginx'}
              </strong>
              .
            </div>
          )}

          {/* Vulnerability Impact Callout */}
          {remediationData.impact && (
            <div className="zrm-impact-card">
              <div className="zrm-impact-label">
                <Shield size={14} aria-hidden="true" />
                <span>Vulnerability Impact & Exploitation Vector</span>
              </div>
              <p className="zrm-impact-text">{remediationData.impact}</p>
            </div>
          )}

          {/* Framework Remediation Tabs & Selector */}
          <div className="zrm-tabs-section">
            <div className="zrm-tablist-header">
              <span className="zrm-tablist-title">Target Application Framework</span>
              {availableFrameworks.length > 0 && (
                <FrameworkRemediationTabs
                  frameworks={availableFrameworks}
                  activeFramework={activeFramework}
                  onSelectFramework={setActiveFramework}
                />
              )}
            </div>

            {/* Framework Explanation & Target File Location */}
            {currentFrameworkData && (
              <div className="zrm-framework-meta">
                <span className="zrm-explanation">
                  {currentFrameworkData.explanation}
                </span>

                <span className="zrm-file-badge" title="Target Configuration or Source File">
                  <Folder size={13} aria-hidden="true" />
                  <span>{currentFrameworkData.filename}</span>
                </span>
              </div>
            )}
          </div>

          {/* Code Viewer & Unified Diff */}
          <div
            ref={panelRef}
            id={`remediation-panel-${activeFramework}`}
            role="tabpanel"
            aria-labelledby={`remediation-tab-${activeFramework}`}
          >
            {currentFrameworkData ? (
              <CodeViewer
                filename={currentFrameworkData.filename}
                diffCode={currentFrameworkData.diff}
                explanation={currentFrameworkData.explanation}
              />
            ) : (
              <div
                style={{
                  padding: '2rem',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  fontSize: '0.9rem',
                }}
              >
                {remediationData.summary || 'No framework-specific code diff is available for this rule.'}
              </div>
            )}
          </div>

          {/* Local Terminal CLI Verification Probe */}
          {cliCommand && (
            <TerminalVerificationCommand command={cliCommand} />
          )}
        </div>

        {/* 3. Action Footer (Sticky Bottom) */}
        <div className="zrm-footer">
          <button
            type="button"
            onClick={onClose}
            className="zrm-btn-close"
          >
            Close Guide
          </button>

          <button
            type="button"
            onClick={() => onVerifyFix(finding.id)}
            disabled={isVerifying}
            className="zrm-btn-verify"
            aria-label={`Verify fix for ${finding.ruleId} on live target`}
          >
            {isVerifying ? (
              <>
                <span className="zrm-spinner" aria-hidden="true" />
                <span>Re-testing Endpoint...</span>
              </>
            ) : activeVerificationResult?.fixed ? (
              <>
                <Check size={14} aria-hidden="true" />
                <span>Fix Verified (Re-test)</span>
              </>
            ) : (
              <>
                <Zap size={14} aria-hidden="true" />
                <span>Verify Fix on Live Target</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FrameworkRemediationModal;
