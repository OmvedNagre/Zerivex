'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Target, VerificationMethod } from '@/core/targets/target-service';
import { StaggeredText } from '@/components/ui/StaggeredText';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import {
  LucideIcon,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Globe,
  Code2,
  FileCode2,
  FileText,
  KeyRound,
  Zap,
  Loader2,
  ArrowLeft,
  BarChart3,
  ExternalLink,
  Lightbulb,
} from 'lucide-react';

export interface Instructions {
  method: VerificationMethod;
  token: string;
  dnsHost: string;
  dnsHostShort?: string;
  dnsApexHost?: string;
  apexDomain?: string;
  dnsRecordValue: string;
  dnsRecordValuePlain?: string;
  htmlMetaTag: string;
  httpHeaderName: string;
  httpHeaderValue: string;
  fileUrl?: string;
  fileContent?: string;
}

export type ActiveVerificationMethod = VerificationMethod | 'HTTP_FILE' | 'MANUAL_BYPASS';

interface VerificationCenterProps {
  target: Target;
  instructions: Instructions;
  latestScan: { id: string; score: number | null; createdAt: string } | null;
  selectedMethod: ActiveVerificationMethod;
  setSelectedMethod: (method: ActiveVerificationMethod) => void;
  verifying: boolean;
  verificationResult: { success: boolean; diagnostic: string } | null;
  onVerify: (bypass?: boolean) => Promise<void>;
  scanning: boolean;
  onRunScan: () => void;
}

interface MethodConfig {
  id: ActiveVerificationMethod;
  label: string;
  icon: LucideIcon;
  badge?: string;
  badgeType?: 'recommended' | 'admin';
}

const METHODS: MethodConfig[] = [
  { id: 'DNS_TXT', label: 'DNS TXT Record', icon: Globe, badge: 'Recommended', badgeType: 'recommended' },
  { id: 'HTML_META', label: 'HTML Meta Tag', icon: Code2 },
  { id: 'HTTP_HEADER', label: 'HTTP Header', icon: FileCode2 },
  { id: 'HTTP_FILE', label: 'File (.well-known)', icon: FileText },
  { id: 'MANUAL_BYPASS', label: 'Admin Bypass', icon: KeyRound, badge: 'Privileged', badgeType: 'admin' },
];

/**
 * High-precision Token Clipboard Box with copy state and fallback
 */
interface TokenClipboardBoxProps {
  label: string;
  badge?: string;
  value: string;
  copyId: string;
  copiedKey: string | null;
  onCopy: (value: string, key: string) => void;
}

function TokenClipboardBox({
  label,
  badge,
  value,
  copyId,
  copiedKey,
  onCopy,
}: TokenClipboardBoxProps) {
  const isCopied = copiedKey === copyId;

  return (
    <div className="zvc-token-box">
      <div className="zvc-token-box-header">
        <div className="zvc-token-label">
          <span>{label}</span>
          {badge && <span className="zvc-token-badge">{badge}</span>}
        </div>
        <button
          type="button"
          className={`zvc-copy-btn ${isCopied ? 'copied' : ''}`}
          onClick={() => onCopy(value, copyId)}
          aria-label={`Copy ${label}`}
        >
          {isCopied ? (
            <>
              <Check size={13} aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="zvc-token-value-container" tabIndex={0} role="region" aria-label={`${label} text`}>
        {value}
      </div>
    </div>
  );
}

export function VerificationCenter({
  target,
  instructions,
  latestScan,
  selectedMethod,
  setSelectedMethod,
  verifying,
  verificationResult,
  onVerify,
  scanning,
  onRunScan,
}: VerificationCenterProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tablistRef = useRef<HTMLDivElement>(null);

  // Safe clipboard utility with fallback
  const handleCopy = useCallback(async (text: string, key: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      // Fallback
      setCopiedKey(null);
    }
  }, []);

  // Keyboard navigation for WAI-ARIA tablist
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const totalTabs = METHODS.length;
    let newIndex = currentIndex;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      newIndex = (currentIndex + 1) % totalTabs;
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      newIndex = (currentIndex - 1 + totalTabs) % totalTabs;
    } else if (e.key === 'Home') {
      e.preventDefault();
      newIndex = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      newIndex = totalTabs - 1;
    } else {
      return;
    }

    const nextItem = METHODS[newIndex];
    if (!nextItem) return;
    const nextMethod = nextItem.id;
    setSelectedMethod(nextMethod);

    // Focus the activated tab
    const nextTabButton = tablistRef.current?.querySelector<HTMLButtonElement>(`#tab-${nextMethod}`);
    nextTabButton?.focus();
  };

  // Scoped GSAP transition for method panel switch
  useGSAP(
    () => {
      if (!panelRef.current) return;
      const isReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (isReduced) return;

      gsap.fromTo(
        panelRef.current,
        { opacity: 0, y: 5 },
        { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out' }
      );
    },
    { dependencies: [selectedMethod], scope: panelRef }
  );

  const isVerified = target.verificationStatus === 'VERIFIED';

  // Primary verification button dynamic label
  const getPrimaryVerifyLabel = () => {
    if (verifying) return 'Checking Verification...';
    const prefix = isVerified ? 'Re-Verify ' : 'Verify ';

    switch (selectedMethod) {
      case 'DNS_TXT':
        return `${prefix}DNS Records Now`;
      case 'HTML_META':
        return `${prefix}HTML Meta Tag`;
      case 'HTTP_HEADER':
        return `${prefix}HTTP Response Header`;
      case 'HTTP_FILE':
        return `${prefix}Well-Known File`;
      case 'MANUAL_BYPASS':
        return 'Authorize Target (Admin Bypass)';
      default:
        return `${prefix}Ownership Now`;
    }
  };

  return (
    <div className="zvc-container">
      {/* Header & Breadcrumb */}
      <header className="zvc-header">
        <Link href="/dashboard/targets" className="zvc-breadcrumb">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Targets</span>
        </Link>

        {/* Target Identity Row */}
        <div className="zvc-target-identity-row">
          <div className="zvc-target-info">
            <div className="zvc-target-url-container">
              <h1 className="zvc-target-url" title={target.targetUrl}>
                {target.targetUrl}
              </h1>
            </div>
            <div className="zvc-target-meta">
              <span className="zvc-meta-item">
                Hostname: <code className="zvc-meta-code">{target.hostname}</code>
              </span>
              <span className="zvc-meta-item">
                Scope: <span className="zvc-scope-tag">{target.verificationScope}</span>
              </span>
            </div>
          </div>

          <div className="zvc-header-actions">
            {latestScan && (
              <Link href={`/dashboard/scans/${latestScan.id}`} className="zvc-report-link">
                <BarChart3 size={15} aria-hidden="true" />
                <span>Latest Report ({latestScan.score !== null ? `${latestScan.score}/100` : 'Pending'})</span>
              </Link>
            )}

            <button
              type="button"
              onClick={onRunScan}
              disabled={scanning}
              className="zvc-scan-btn"
              title="Launch deterministic security scan against target"
            >
              {scanning ? (
                <>
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  <span>Scanning...</span>
                </>
              ) : (
                <>
                  <Zap size={15} aria-hidden="true" />
                  <span>Run Security Scan</span>
                </>
              )}
            </button>

            {isVerified ? (
              <span className="zvc-status-badge verified" role="status">
                <CheckCircle2 size={14} aria-hidden="true" />
                <span>Verified Target</span>
              </span>
            ) : (
              <span className="zvc-status-badge unverified" role="status">
                <AlertTriangle size={14} aria-hidden="true" />
                <span>Verification Required</span>
              </span>
            )}
          </div>
        </div>

        {/* Navigation Sub-Tabs (Target Pages) */}
        <nav className="zvc-nav-strip" aria-label="Target Views">
          <span className="zvc-nav-link active" aria-current="page">
            Verification Center
          </span>
          <Link href={`/dashboard/targets/${target.id}/surface`} className="zvc-nav-link">
            <span>Attack Surface Map</span>
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
          <Link href={`/dashboard/targets/${target.id}/monitoring`} className="zvc-nav-link">
            <span>Continuous Monitoring</span>
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
          <Link href={`/dashboard/targets/${target.id}/ci-cd`} className="zvc-nav-link">
            <span>CI/CD & Integrations</span>
            <ExternalLink size={12} aria-hidden="true" />
          </Link>
        </nav>
      </header>

      {/* Verification State Banner */}
      <section
        className={`zvc-status-banner ${isVerified ? 'verified' : 'unverified'}`}
        aria-label="Verification Posture"
      >
        <div className="zvc-banner-icon-container" aria-hidden="true">
          {isVerified ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
        </div>
        <div className="zvc-banner-content">
          <div className="zvc-banner-title">
            {isVerified ? 'Domain Ownership Confirmed' : 'Scanning Authorization Locked'}
          </div>
          <div className="zvc-banner-description">
            {isVerified ? (
              <>
                Verified via <strong>{target.verificationMethod || 'DNS_TXT'}</strong> on{' '}
                {target.verifiedAt ? new Date(target.verifiedAt).toLocaleString() : 'recently'}. This target is fully
                authorized for active vulnerability assessments.
              </>
            ) : (
              <>
                Per Zerivex ADR-0008, active security scanning requires explicit domain ownership verification to
                prevent unauthorized intrusion testing against third-party assets.
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Verification Card */}
      <section className="zvc-card" aria-labelledby="verification-instructions-heading">
        <div className="zvc-card-header">
          <h2 id="verification-instructions-heading" className="zvc-card-title">
            <StaggeredText
              text="Domain Ownership Verification Instructions"
              staggerDuration={0.01}
              initialDelay={0.05}
            />
          </h2>
        </div>

        {/* WAI-ARIA Tablist */}
        <div className="zvc-tablist-container">
          <div
            ref={tablistRef}
            role="tablist"
            aria-label="Domain Verification Methods"
            className="zvc-tablist"
          >
            {METHODS.map((m, index) => {
              const Icon = m.icon;
              const isSelected = selectedMethod === m.id;

              return (
                <button
                  key={m.id}
                  id={`tab-${m.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isSelected}
                  aria-controls={`panel-${m.id}`}
                  tabIndex={isSelected ? 0 : -1}
                  className="zvc-tab"
                  onClick={() => setSelectedMethod(m.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                >
                  <Icon size={16} aria-hidden="true" />
                  <span>{m.label}</span>
                  {m.badge && (
                    <span className={`zvc-tab-badge ${m.badgeType || ''}`}>
                      {m.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Method Panels */}
        <div
          ref={panelRef}
          id={`panel-${selectedMethod}`}
          role="tabpanel"
          aria-labelledby={`tab-${selectedMethod}`}
          tabIndex={0}
          className="zvc-tabpanel"
        >
          {/* Method 1: DNS TXT */}
          {selectedMethod === 'DNS_TXT' && (
            <>
              <p className="zvc-method-desc">
                Add a DNS <strong>TXT</strong> record in your domain manager (Cloudflare, Vercel, GoDaddy, Hostinger,
                Route 53, Namecheap, etc.):
              </p>

              {/* Provider Tip Callout */}
              <div className="zvc-callout" role="note">
                <Lightbulb size={18} className="zvc-callout-icon" aria-hidden="true" />
                <div>
                  <strong>DNS Provider Tip:</strong> If your DNS is managed on Cloudflare, Vercel, GoDaddy, or
                  Hostinger, paste <code>{instructions.dnsHostShort || '_zerivex-challenge'}</code> into the{' '}
                  <strong>Name / Host</strong> field. Entering the full domain can cause your provider to create a
                  duplicate name or reject it as an invalid host.
                </div>
              </div>

              {/* Technical Value Fields */}
              <div className="zvc-token-grid">
                <TokenClipboardBox
                  label="Host / Name (Recommended for Cloudflare, Vercel, GoDaddy)"
                  badge="RELATIVE HOST"
                  value={instructions.dnsHostShort || '_zerivex-challenge'}
                  copyId="dnsHostShort"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />

                <TokenClipboardBox
                  label="Full FQDN (For Route 53, Namecheap, manual zone files)"
                  badge="CANONICAL FQDN"
                  value={instructions.dnsHost}
                  copyId="dnsHost"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />

                <TokenClipboardBox
                  label="TXT Record Value / Content"
                  badge="STANDARD FORMAT"
                  value={instructions.dnsRecordValue}
                  copyId="dnsVal"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />

                <TokenClipboardBox
                  label="Alternative Plain Token (Optional Format)"
                  badge="RAW TOKEN"
                  value={instructions.dnsRecordValuePlain || instructions.token}
                  copyId="dnsValPlain"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              </div>
            </>
          )}

          {/* Method 2: HTML Meta Tag */}
          {selectedMethod === 'HTML_META' && (
            <>
              <p className="zvc-method-desc">
                Insert the following meta tag inside the <code>&lt;head&gt;</code> element of your target homepage:
              </p>

              <div className="zvc-token-grid">
                <TokenClipboardBox
                  label="HTML Meta Tag"
                  badge="&lt;HEAD&gt; ELEMENT"
                  value={instructions.htmlMetaTag}
                  copyId="htmlMeta"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              </div>
            </>
          )}

          {/* Method 3: HTTP Header */}
          {selectedMethod === 'HTTP_HEADER' && (
            <>
              <p className="zvc-method-desc">
                Configure your web server (Nginx, Caddy, Cloudflare Workers, Express, Fastly) to include this HTTP
                response header on the target URL:
              </p>

              <div className="zvc-token-grid">
                <TokenClipboardBox
                  label="Response Header Specification"
                  badge="HTTP HEADER"
                  value={`${instructions.httpHeaderName}: ${instructions.httpHeaderValue}`}
                  copyId="httpHeader"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
                <TokenClipboardBox
                  label="Header Value Only"
                  badge="VALUE"
                  value={instructions.httpHeaderValue}
                  copyId="httpHeaderValue"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              </div>
            </>
          )}

          {/* Method 4: HTTP File (.well-known) */}
          {selectedMethod === 'HTTP_FILE' && (
            <>
              <p className="zvc-method-desc">
                Upload a plain text file containing your verification token to your website at the designated path:
              </p>

              <div className="zvc-token-grid">
                <TokenClipboardBox
                  label="Expected File URL"
                  badge="PATH"
                  value={
                    instructions.fileUrl ||
                    `${target.targetUrl.replace(/\/+$/, '')}/.well-known/zerivex-verification.txt`
                  }
                  copyId="fileUrl"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
                <TokenClipboardBox
                  label="File Content (Plain Text)"
                  badge="CONTENT"
                  value={instructions.fileContent || `zerivex-verification=${instructions.token}`}
                  copyId="fileContent"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              </div>
            </>
          )}

          {/* Method 5: Manual Verification Bypass (Admin) */}
          {selectedMethod === 'MANUAL_BYPASS' && (
            <>
              <p className="zvc-method-desc">
                <strong>Platform Owner & Development Sandbox Authorization:</strong> Authorizes this target instantly
                without external DNS or HTTP resolution. Intended for local development environments, synthetic test
                targets, and platform administrative operations per ADR-0008.
              </p>

              <div className="zvc-callout" role="note">
                <KeyRound size={18} className="zvc-callout-icon" aria-hidden="true" />
                <div>
                  <strong>Audit Governance:</strong> This authorization is recorded immutably in the organizational
                  audit log with actor identity, timestamp, and sandbox rationale.
                </div>
              </div>

              <div className="zvc-token-grid">
                <TokenClipboardBox
                  label="Cryptographic Target Challenge Token"
                  badge="SHA-256 IDENTIFIER"
                  value={instructions.token}
                  copyId="adminToken"
                  copiedKey={copiedKey}
                  onCopy={handleCopy}
                />
              </div>
            </>
          )}

          {/* Action Trigger Area */}
          <div className="zvc-action-area">
            <div className="zvc-action-buttons">
              <button
                id="verify-domain-button"
                type="button"
                onClick={() => onVerify(selectedMethod === 'MANUAL_BYPASS')}
                disabled={verifying}
                className={`zvc-primary-verify-btn ${isVerified ? 'secondary' : 'primary'}`}
              >
                {verifying ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    <span>Checking Verification...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} aria-hidden="true" />
                    <span>{getPrimaryVerifyLabel()}</span>
                  </>
                )}
              </button>

              {selectedMethod !== 'MANUAL_BYPASS' && (
                <button
                  id="instant-verify-button"
                  type="button"
                  onClick={() => onVerify(true)}
                  disabled={verifying}
                  className="zvc-bypass-btn"
                  title="Instantly authorize target for development and platform administration"
                >
                  <Zap size={14} aria-hidden="true" />
                  <span>Instant Verify (Admin Bypass)</span>
                </button>
              )}
            </div>

            {/* Diagnostic Result Area */}
            {verificationResult && (
              <div
                className={`zvc-diagnostic-panel ${verificationResult.success ? 'success' : 'failure'}`}
                role="status"
                aria-live="polite"
              >
                <div className="zvc-diagnostic-icon">
                  {verificationResult.success ? (
                    <CheckCircle2 size={18} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={18} aria-hidden="true" />
                  )}
                </div>
                <div className="zvc-diagnostic-content">
                  <div className="zvc-diagnostic-headline">
                    {verificationResult.success ? 'Verification Successful' : 'Verification Check Unsuccessful'}
                  </div>
                  <div className="zvc-diagnostic-text">{verificationResult.diagnostic}</div>
                  {!verificationResult.success && (
                    <div className="zvc-diagnostic-remediation">
                      Next step: Confirm the record has propagated across public DNS resolvers (TTL propagation typically
                      takes 1–5 minutes) and ensure your DNS provider does not duplicate the root domain name.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
