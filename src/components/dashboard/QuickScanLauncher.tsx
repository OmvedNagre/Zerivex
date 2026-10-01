'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import {
  ShieldCheck,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Globe,
} from 'lucide-react';
import { StaggeredText } from '@/components/ui/StaggeredText';

export interface QuickScanLauncherProps {
  onSuccess?: (targetId: string) => void;
  className?: string;
}

export function QuickScanLauncher({ onSuccess, className = '' }: QuickScanLauncherProps) {
  const [url, setUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isTouched, setIsTouched] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputClusterRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // GSAP Entrance animation with prefers-reduced-motion guard
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
            { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
          );
        }
      }
    );

    return () => mm.revert();
  }, []);

  // Micro-shake animation for invalid submission attempts (2-3px, 200ms, non-cartoonish)
  const triggerValidationShake = useCallback(() => {
    if (!inputClusterRef.current) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    gsap.fromTo(
      inputClusterRef.current,
      { x: -3 },
      {
        x: 3,
        duration: 0.05,
        repeat: 3,
        yoyo: true,
        ease: 'power1.inOut',
        onComplete: () => {
          if (inputClusterRef.current) {
            gsap.set(inputClusterRef.current, { x: 0 });
          }
        },
      }
    );
  }, []);

  // Validate format and determine client status
  const validateUrl = (raw: string): { valid: boolean; normalized: string; error?: string } => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {
        valid: false,
        normalized: '',
        error: 'Please enter a target endpoint URL (e.g., https://app.yourdomain.com)',
      };
    }

    // Insecure HTTP check
    if (/^http:\/\//i.test(trimmed)) {
      return {
        valid: false,
        normalized: trimmed,
        error: 'HTTPS endpoint required. Insecure HTTP endpoints cannot be admitted to active scanning.',
      };
    }

    // Auto-normalize if protocol is omitted
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);

      // Check for valid hostname (must contain a dot or valid host, cannot be whitespace)
      if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.hostname.startsWith('.') || parsed.hostname.endsWith('.')) {
        // Disallow bare invalid strings
        return {
          valid: false,
          normalized: withProtocol,
          error: 'Please enter a fully qualified domain name (e.g., https://app.yourdomain.com)',
        };
      }

      // Check protocol
      if (parsed.protocol !== 'https:') {
        return {
          valid: false,
          normalized: withProtocol,
          error: 'Endpoint must use HTTPS. Insecure HTTP endpoints cannot be admitted to active scanning.',
        };
      }

      return { valid: true, normalized: withProtocol };
    } catch {
      return {
        valid: false,
        normalized: withProtocol,
        error: 'Invalid target format. Enter a valid HTTPS URL (e.g., https://app.yourdomain.com)',
      };
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    setUrl(nextVal);

    // Clear previous error messages when user modifies the value
    if (errorMessage) {
      setErrorMessage(null);
    }
    if (successMessage) {
      setSuccessMessage(null);
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
    if (!url.trim()) return;

    const { valid, error } = validateUrl(url);
    if (!valid && error) {
      setErrorMessage(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isRedirecting) return;

    setIsTouched(true);
    const { valid, normalized, error } = validateUrl(url);

    if (!valid) {
      setErrorMessage(error || 'Please enter a valid HTTPS endpoint URL');
      triggerValidationShake();
      if (inputRef.current) {
        inputRef.current.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl: normalized,
          url: normalized,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const rawErr: string = data.error || 'Unknown registration error';
        // Format friendly security error if SSRF defense triggered
        if (rawErr.includes('[ZERIVEX SSRF DEFENSE]')) {
          setErrorMessage(
            'Target blocked by SSRF defense: Private, loopback, and cloud metadata addresses are forbidden.'
          );
        } else if (rawErr.includes('quota')) {
          setErrorMessage(
            'Target quota exceeded for current organization plan. Upgrade required to add targets.'
          );
        } else {
          setErrorMessage(`Failed to register target: ${rawErr}`);
        }
        triggerValidationShake();
        return;
      }

      const targetId = data.data?.target?.id;
      setIsRedirecting(true);
      setSuccessMessage('Target admitted. Redirecting to cryptographic verification center…');

      if (onSuccess && targetId) {
        onSuccess(targetId);
      }

      setTimeout(() => {
        if (targetId) {
          window.location.href = `/dashboard/targets/${targetId}`;
        } else {
          window.location.href = '/dashboard/targets';
        }
      }, 500);
    } catch (err) {
      setErrorMessage(`Network error: ${(err as Error).message}`);
      triggerValidationShake();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine visual state of input cluster
  const hasError = Boolean(errorMessage);
  const trimmedUrl = url.trim();
  const isValidFormat =
    trimmedUrl.length > 3 &&
    !hasError &&
    (trimmedUrl.startsWith('https://') || (isTouched && trimmedUrl.includes('.')));

  return (
    <section
      ref={containerRef}
      className={`zql-launcher ${className}`}
      aria-labelledby="quick-scan-title"
    >
      {/* Header Bar */}
      <div className="zql-header">
        <div className="zql-title-group">
          <div className="zql-icon-badge" aria-hidden="true">
            <ShieldCheck size={16} />
          </div>
          <div className="zql-title-wrap">
            <h2 id="quick-scan-title" className="zql-title">
              <StaggeredText text="Quick Vulnerability Scan" />
            </h2>
            <p className="zql-description">
              Assess a target endpoint from your verified security workspace.
            </p>
          </div>
        </div>

        <div className="zql-telemetry-badge" aria-label="Target intake telemetry: Gate Armed">
          <span className="zql-telemetry-dot" aria-hidden="true" />
          <span className="zql-telemetry-text">GATE ARMED</span>
        </div>
      </div>

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="zql-form" noValidate>
        <div className="zql-label-row">
          <label htmlFor="quick-scan-url" className="zql-label">
            Target endpoint
          </label>
          <span className="zql-label-format-hint">HTTPS / FQDN</span>
        </div>

        <div className="zql-controls-row">
          <div
            ref={inputClusterRef}
            className={`zql-input-cluster ${hasError ? 'zql-input-cluster-error' : ''} ${isValidFormat ? 'zql-input-cluster-valid' : ''}`}
          >
            {isValidFormat ? (
              <Lock size={15} className="zql-cluster-icon" aria-hidden="true" />
            ) : (
              <Globe size={15} className="zql-cluster-icon" aria-hidden="true" />
            )}

            <input
              ref={inputRef}
              id="quick-scan-url"
              name="targetUrl"
              type="url"
              className="zql-input"
              value={url}
              onChange={handleInputChange}
              onBlur={handleBlur}
              placeholder="https://app.yourdomain.com"
              disabled={isSubmitting || isRedirecting}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              aria-describedby="quick-scan-helper quick-scan-feedback"
              aria-invalid={hasError ? 'true' : 'false'}
              aria-required="true"
            />
          </div>

          <button
            type="submit"
            className="zql-submit-btn"
            disabled={isSubmitting || isRedirecting}
            aria-label={
              isSubmitting
                ? 'Registering target endpoint...'
                : isRedirecting
                ? 'Redirecting to verification center...'
                : 'Register and scan target endpoint'
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="zql-spin" aria-hidden="true" />
                <span>Registering…</span>
              </>
            ) : isRedirecting ? (
              <>
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>Redirecting…</span>
              </>
            ) : (
              <>
                <span>Register & Scan Target</span>
                <ArrowRight size={15} className="zql-btn-arrow" aria-hidden="true" />
              </>
            )}
          </button>
        </div>

        {/* Operational Scope & Semantic Live Feedback */}
        <div className="zql-meta-row">
          <div id="quick-scan-helper" className="zql-helper-text">
            <ShieldCheck size={13} className="zql-helper-icon" aria-hidden="true" />
            <span>HTTPS endpoint • Cryptographic ownership verification required prior to active scanning</span>
          </div>

          <div
            id="quick-scan-feedback"
            role="status"
            aria-live="polite"
            className={`zql-feedback ${errorMessage ? 'zql-feedback-error' : ''} ${successMessage ? 'zql-feedback-success' : ''}`}
          >
            {errorMessage && (
              <>
                <AlertCircle size={14} className="zql-feedback-icon" aria-hidden="true" />
                <span>{errorMessage}</span>
              </>
            )}
            {successMessage && (
              <>
                <CheckCircle2 size={14} className="zql-feedback-icon" aria-hidden="true" />
                <span>{successMessage}</span>
              </>
            )}
          </div>
        </div>
      </form>
    </section>
  );
}
