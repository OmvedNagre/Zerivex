'use client';

import { useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import {
  Globe,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  Play,
  Loader2,
  Lock,
  ChevronDown,
} from 'lucide-react';
import { Target } from '@/core/targets/target-service';
import { ScanMode } from '@/core/scanner/checks/types';
import { StaggeredText } from '@/components/ui/StaggeredText';

export interface LaunchScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  targets: Target[];
  selectedTargetId: string;
  onSelectTargetId: (targetId: string) => void;
  scanMode: ScanMode;
  onSelectScanMode: (mode: ScanMode) => void;
  onLaunchScan: (e: React.FormEvent) => void;
  launching: boolean;
  launchError: string | null;
}

export function LaunchScanModal({
  isOpen,
  onClose,
  targets,
  selectedTargetId,
  onSelectTargetId,
  scanMode,
  onSelectScanMode,
  onLaunchScan,
  launching,
  launchError,
}: LaunchScanModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);
  const isSelectedTargetVerified = selectedTarget?.verificationStatus === 'VERIFIED';

  // Safety rule: If target is unverified, active scan mode cannot be selected or submitted
  useEffect(() => {
    if (selectedTarget && !isSelectedTargetVerified && scanMode === 'VERIFIED_ACTIVE') {
      onSelectScanMode('PUBLIC_PASSIVE');
    }
  }, [selectedTarget, isSelectedTargetVerified, scanMode, onSelectScanMode]);

  // Handle target change with automatic safe fallback
  const handleTargetChange = (newTargetId: string) => {
    onSelectTargetId(newTargetId);
    const target = targets.find((t) => t.id === newTargetId);
    if (target && target.verificationStatus !== 'VERIFIED' && scanMode === 'VERIFIED_ACTIVE') {
      onSelectScanMode('PUBLIC_PASSIVE');
    }
  };

  // Focus trapping & Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element for restoration on close
    if (typeof document !== 'undefined') {
      previouslyFocusedElementRef.current = document.activeElement as HTMLElement;
    }

    // Scroll lock background page
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus initial element inside modal
    const focusTimer = setTimeout(() => {
      if (selectRef.current) {
        selectRef.current.focus();
      } else if (dialogRef.current) {
        dialogRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape key dismissal
      if (e.key === 'Escape') {
        if (!launching) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      // 2. Focus trap
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      // Restore focus to original trigger element
      if (previouslyFocusedElementRef.current) {
        previouslyFocusedElementRef.current.focus();
      }
    };
  }, [isOpen, launching, onClose]);

  // GSAP Entrance & Exit animations with reduced-motion support
  useEffect(() => {
    if (!isOpen || !backdropRef.current || !dialogRef.current) return;

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduceMotion: '(prefers-reduced-motion: reduce)',
        allowMotion: '(prefers-reduced-motion: no-preference)',
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion?: boolean };
        if (!reduceMotion && backdropRef.current && dialogRef.current) {
          gsap.fromTo(
            backdropRef.current,
            { opacity: 0 },
            { opacity: 1, duration: 0.2, ease: 'power2.out' }
          );
          gsap.fromTo(
            dialogRef.current,
            { opacity: 0, y: 12, scale: 0.98 },
            { opacity: 1, y: 0, scale: 1, duration: 0.25, ease: 'power2.out' }
          );
        }
      }
    );

    return () => mm.revert();
  }, [isOpen]);

  // Keyboard navigation for Radio Group (Arrow keys)
  const handleRadioKeyDown = useCallback(
    (e: React.KeyboardEvent, mode: ScanMode) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (mode === 'PUBLIC_PASSIVE' && isSelectedTargetVerified) {
          onSelectScanMode('VERIFIED_ACTIVE');
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (mode === 'VERIFIED_ACTIVE') {
          onSelectScanMode('PUBLIC_PASSIVE');
        }
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (mode === 'VERIFIED_ACTIVE' && !isSelectedTargetVerified) return;
        onSelectScanMode(mode);
      }
    },
    [isSelectedTargetVerified, onSelectScanMode]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      className="zlsm-backdrop"
      role="presentation"
      onClick={(e) => {
        // Prevent accidental dismissal when clicking on modal dialog itself
        if (e.target === backdropRef.current && !launching) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="zlsm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="launch-scan-title"
        aria-describedby="launch-scan-desc"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <header className="zlsm-header">
          <div className="zlsm-header-text">
            <div className="zlsm-kicker">
              <span className="zlsm-kicker-dot" aria-hidden="true" />
              <span>Assessment Checkpoint</span>
            </div>
            <h2 id="launch-scan-title" className="zlsm-title">
              <StaggeredText text="Launch Security Assessment" />
            </h2>
            <p id="launch-scan-desc" className="zlsm-desc">
              Select an authorized target endpoint and assessment scope. Verified Active Scanning is restricted to authenticated domain owners per ADR-0008.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={launching}
            className="zlsm-close-btn"
            aria-label="Close assessment launch dialog"
            title="Close dialog (Escape)"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {/* Modal Form */}
        <form onSubmit={onLaunchScan} className="zlsm-form" noValidate>
          {/* Error Alert Box */}
          {launchError && (
            <div className="zlsm-error-box" role="alert">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <AlertTriangle size={15} aria-hidden="true" />
                <span>Launch Failed</span>
              </div>
              <div>{launchError}</div>
              {(launchError.toLowerCase().includes('allocation') ||
                launchError.toLowerCase().includes('plan') ||
                launchError.toLowerCase().includes('upgrade')) && (
                <div>
                  <Link
                    href="/dashboard/billing"
                    className="zlsm-error-link"
                    onClick={onClose}
                  >
                    View Billing & Upgrade Plan (INR ₹) &rarr;
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Target Selector */}
          <div className="zlsm-group">
            <div className="zlsm-label-row">
              <label htmlFor="target-endpoint-select" className="zlsm-label">
                <span>Target Endpoint</span>
                <span className="zlsm-required-star" aria-hidden="true">*</span>
              </label>
              <span className="zlsm-target-count">
                {targets.length} {targets.length === 1 ? 'target' : 'targets'} registered
              </span>
            </div>

            <div className="zlsm-select-wrapper">
              <select
                id="target-endpoint-select"
                ref={selectRef}
                value={selectedTargetId}
                onChange={(e) => handleTargetChange(e.target.value)}
                required
                disabled={launching || targets.length === 0}
                className="zlsm-select"
                aria-describedby="target-verification-context"
              >
                {targets.length === 0 ? (
                  <option value="" disabled>No registered targets found</option>
                ) : (
                  targets.map((t) => {
                    const isVer = t.verificationStatus === 'VERIFIED';
                    return (
                      <option key={t.id} value={t.id}>
                        {t.targetUrl} ({isVer ? '✓ Verified' : '⚠ Unverified'})
                      </option>
                    );
                  })
                )}
              </select>
              <ChevronDown size={16} className="zlsm-select-chevron" aria-hidden="true" />
            </div>

            {/* Target Verification Context Banner */}
            <div
              id="target-verification-context"
              className={`zlsm-target-context ${isSelectedTargetVerified ? 'verified' : 'unverified'}`}
              role="status"
              aria-live="polite"
            >
              {isSelectedTargetVerified ? (
                <>
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span className="zlsm-target-context-text">
                    Target verified via cryptographic challenge. Both Passive and Active modes permitted.
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={14} aria-hidden="true" />
                  <span className="zlsm-target-context-text">
                    Target unverified. Active scanning locked per ADR-0008. Verify in Targets Hub.
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Section 2: Assessment Mode Selector */}
          <div className="zlsm-group">
            <span id="scan-mode-label" className="zlsm-label">
              <span>Assessment Scope & Mode</span>
              <span className="zlsm-required-star" aria-hidden="true">*</span>
            </span>

            <div
              className="zlsm-mode-group"
              role="radiogroup"
              aria-labelledby="scan-mode-label"
            >
              {/* Option 1: PUBLIC_PASSIVE */}
              <div
                role="radio"
                tabIndex={scanMode === 'PUBLIC_PASSIVE' ? 0 : -1}
                aria-checked={scanMode === 'PUBLIC_PASSIVE'}
                onClick={() => onSelectScanMode('PUBLIC_PASSIVE')}
                onKeyDown={(e) => handleRadioKeyDown(e, 'PUBLIC_PASSIVE')}
                className={`zlsm-mode-tile ${scanMode === 'PUBLIC_PASSIVE' ? 'selected' : ''}`}
                aria-label="Public Passive Assessment: Non-intrusive configuration and header evaluation, permitted on all targets"
              >
                <div className="zlsm-radio-circle" aria-hidden="true">
                  {scanMode === 'PUBLIC_PASSIVE' && <span className="zlsm-radio-inner-dot" />}
                </div>

                <div className="zlsm-mode-body">
                  <div className="zlsm-mode-header-row">
                    <div className="zlsm-mode-title-wrap">
                      <Globe size={15} className="zlsm-mode-icon" aria-hidden="true" />
                      <span className="zlsm-mode-name">Public Passive Assessment</span>
                    </div>
                    <span className="zlsm-mode-badge zlsm-mode-badge-permitted">
                      All Targets
                    </span>
                  </div>

                  <p className="zlsm-mode-desc">
                    Audits SSL/TLS ciphers, HTTP security headers, CORS origins, cookies, and public configuration leaks without intrusive probing.
                  </p>

                  <div className="zlsm-mode-tags">
                    <span className="zlsm-scope-tag">TLS/SSL</span>
                    <span className="zlsm-scope-tag">Headers</span>
                    <span className="zlsm-scope-tag">CORS</span>
                    <span className="zlsm-scope-tag">Cookies</span>
                    <span className="zlsm-scope-tag">Non-Intrusive</span>
                  </div>
                </div>
              </div>

              {/* Option 2: VERIFIED_ACTIVE */}
              <div
                role="radio"
                tabIndex={scanMode === 'VERIFIED_ACTIVE' ? 0 : -1}
                aria-checked={scanMode === 'VERIFIED_ACTIVE'}
                aria-disabled={!isSelectedTargetVerified}
                onClick={() => {
                  if (isSelectedTargetVerified) {
                    onSelectScanMode('VERIFIED_ACTIVE');
                  }
                }}
                onKeyDown={(e) => handleRadioKeyDown(e, 'VERIFIED_ACTIVE')}
                className={`zlsm-mode-tile ${scanMode === 'VERIFIED_ACTIVE' ? 'selected' : ''} ${!isSelectedTargetVerified ? 'disabled' : ''}`}
                aria-label={`Verified Active Scanning: Deep active security verification. ${
                  isSelectedTargetVerified
                    ? 'Authorized for this verified target'
                    : 'Disabled. Requires target domain verification'
                }`}
              >
                <div className="zlsm-radio-circle" aria-hidden="true">
                  {scanMode === 'VERIFIED_ACTIVE' && <span className="zlsm-radio-inner-dot" />}
                </div>

                <div className="zlsm-mode-body">
                  <div className="zlsm-mode-header-row">
                    <div className="zlsm-mode-title-wrap">
                      <ShieldCheck size={15} className="zlsm-mode-icon" aria-hidden="true" />
                      <span className="zlsm-mode-name">Verified Active Scanning</span>
                    </div>
                    {isSelectedTargetVerified ? (
                      <span className="zlsm-mode-badge zlsm-mode-badge-authorized">
                        Authorized
                      </span>
                    ) : (
                      <span className="zlsm-mode-badge zlsm-mode-badge-restricted">
                        Gated (ADR-0008)
                      </span>
                    )}
                  </div>

                  <p className="zlsm-mode-desc">
                    Deep active probing for exposed secrets, sensitive files, debug routes, API introspection, SQLi, and DOM XSS injection vectors.
                  </p>

                  {!isSelectedTargetVerified && (
                    <div className="zlsm-mode-restriction-notice">
                      <Lock size={12} aria-hidden="true" />
                      <span>Requires target domain ownership verification in Targets Hub.</span>
                    </div>
                  )}

                  <div className="zlsm-mode-tags">
                    <span className="zlsm-scope-tag">Exposed Secrets</span>
                    <span className="zlsm-scope-tag">API Endpoints</span>
                    <span className="zlsm-scope-tag">Deep Checks</span>
                    <span className="zlsm-scope-tag">Gated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer / Actions */}
          <footer className="zlsm-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={launching}
              className="zlsm-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={launching || targets.length === 0}
              className="zlsm-btn-submit"
            >
              {launching ? (
                <>
                  <Loader2 size={15} className="zlsm-spin" aria-hidden="true" />
                  <span>Executing Assessment...</span>
                </>
              ) : (
                <>
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  <span>Start Assessment</span>
                </>
              )}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
