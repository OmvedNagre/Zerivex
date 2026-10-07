'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  ShieldCheck,
  ArrowRight,
  Fingerprint,
  FileCode,
  ScanSearch,
} from 'lucide-react';
import gsap from 'gsap';
import { prefersReducedMotion } from '@/lib/gsap';

export function Hero() {
  const router = useRouter();
  const { user } = useAuth();
  const [url, setUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'passive' | 'verify' | 'remediate'>('passive');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const terminalRowsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || !headingRef.current) return;

    const words = headingRef.current.querySelectorAll('.hero-word');
    gsap.fromTo(
      words,
      { y: 18, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.04,
        duration: 0.5,
        ease: 'power2.out',
      }
    );
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMsg('Please enter a target URL (e.g., https://my-app.com)');
      return;
    }

    let parsedUrl: URL;
    try {
      const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`;
      parsedUrl = new URL(withProto);
    } catch {
      setErrorMsg('Please enter a valid website URL with domain name.');
      return;
    }

    setErrorMsg(null);
    const dest = `/dashboard/targets?new=${encodeURIComponent(parsedUrl.origin)}`;
    if (user) {
      router.push(dest);
    } else {
      router.push(`/login?returnTo=${encodeURIComponent(dest)}`);
    }
  };

  const displayTarget = url.trim() || 'https://my-app.com';

  const headingText = "You shipped fast. Let's check what shipped with it.";

  return (
    <section
      id="hero-scan"
      style={{
        padding: '72px 24px 80px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '48px',
          alignItems: 'center',
        }}
      >
        {/* Left Column: Form & Copy */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Eyebrow badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--ds-radius-pill)',
              backgroundColor: 'var(--ds-bg-subtle)',
              border: '1px solid var(--ds-border-default)',
              width: 'fit-content',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--ds-text-primary)',
            }}
          >
            <ShieldCheck size={14} style={{ color: 'var(--ds-action-brand)' }} />
            <span>Security for software built with AI</span>
          </div>

          {/* Heading */}
          <h1
            ref={headingRef}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(38px, 5.5vw, 68px)',
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              color: 'var(--ds-text-primary)',
              margin: 0,
            }}
          >
            {headingText.split(' ').map((word, i) => (
              <span key={i} className="hero-word" style={{ display: 'inline-block', marginRight: '0.25em' }}>
                {word}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '18px',
              lineHeight: 1.55,
              color: 'var(--ds-text-secondary)',
              margin: 0,
              maxWidth: '560px',
            }}
          >
            Zerivex scans your AI-built app for leaked keys, open CORS, missing headers and injection bugs, then gives you the exact fix for Next.js, Express or Nginx.
          </p>

          {/* URL Input Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              maxWidth: '560px',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '6px',
                borderRadius: 'var(--ds-radius-lg)',
                backgroundColor: 'var(--ds-bg-card)',
                border: errorMsg ? '2px solid var(--ds-danger)' : '1px solid var(--ds-border-strong)',
                boxShadow: 'var(--ds-shadow-2)',
              }}
            >
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="https://your-domain.com"
                aria-label="Target domain to scan"
                style={{
                  flex: '1 1 240px',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  padding: '12px 16px',
                  fontSize: '15px',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--ds-text-primary)',
                }}
              />
              <button
                type="submit"
                id="hero-brand-cta"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: 'var(--ds-radius-md)',
                  backgroundColor: 'var(--ds-action-brand)',
                  color: 'var(--ds-on-brand)',
                  fontWeight: 700,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, transform 0.1s ease',
                  flexShrink: 0,
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                <span>Run free scan</span>
                <ArrowRight size={16} />
              </button>
            </div>

            {errorMsg ? (
              <span style={{ fontSize: '12px', color: 'var(--ds-danger)', fontWeight: 500 }}>
                {errorMsg}
              </span>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)' }}>
                Free plan includes 1 public scan per week &bull; No credit card required
              </span>
            )}
          </form>

          {/* Catalog-derived Trust Chips */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              paddingTop: '8px',
              borderTop: '1px solid var(--ds-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ds-text-secondary)' }}>
              <ScanSearch size={15} style={{ color: 'var(--ds-action-brand)' }} />
              <span>14 check engines</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ds-text-secondary)' }}>
              <FileCode size={15} style={{ color: 'var(--ds-action-brand)' }} />
              <span>31+ fix recipes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--ds-text-secondary)' }}>
              <Fingerprint size={15} style={{ color: 'var(--ds-action-brand)' }} />
              <span>Ownership-verified active scans</span>
            </div>
          </div>
        </div>

        {/* Right Column: Terminal Island */}
        <div
          style={{
            backgroundColor: 'var(--ds-bg-ink)',
            borderRadius: 'var(--ds-radius-lg)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: 'var(--ds-shadow-3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Terminal Window Chrome */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'var(--ds-bg-ink-raised)',
            }}
          >
            {/* Window control dots in muted monochrome */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
              <span
                style={{
                  marginLeft: '10px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ds-text-on-ink-dim)',
                }}
              >
                zerivex-cli v0.1
              </span>
            </div>

            {/* "Sample output" chip */}
            <div
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--ds-text-on-ink-dim)',
                padding: '2px 8px',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Sample output
            </div>
          </div>

          {/* Terminal Tabs */}
          <div
            style={{
              display: 'flex',
              gap: '2px',
              padding: '8px 12px 0',
              backgroundColor: 'var(--ds-bg-ink-raised)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {[
              { id: 'passive', label: 'Passive audit' },
              { id: 'verify', label: 'Ownership verify' },
              { id: 'remediate', label: 'Fix & re-verify' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  background: activeTab === tab.id ? 'var(--ds-bg-ink)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--ds-text-on-ink)' : 'var(--ds-text-on-ink-dim)',
                  border: 'none',
                  borderTopLeftRadius: '6px',
                  borderTopRightRadius: '6px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  transition: 'color 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Terminal Screen Body */}
          <div
            ref={terminalRowsRef}
            data-lenis-prevent
            style={{
              padding: '20px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              lineHeight: 1.65,
              color: 'var(--ds-text-on-ink)',
              minHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {/* Live Typing Command Line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--ds-action-brand)', fontWeight: 700 }}>$</span>
              <span style={{ color: '#ffffff' }}>
                zerivex scan --target=
                <span style={{ color: 'var(--ds-mint)', textDecoration: 'underline' }}>{displayTarget}</span>
                {' '}--profile=strict --sarif
              </span>
            </div>

            {/* Tab specific rows */}
            {activeTab === 'passive' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Initializing 14 deterministic passive check engines...
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; [TLS/HTTPS] Inspecting handshake, cipher suites &amp; certificate validity...
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; [HEADERS] Auditing RFC 6797 HSTS, CSP and X-Frame-Options policies...
                </div>
                <div style={{ color: 'var(--ds-butter)' }}>
                  &gt; [SECRETS] Client bundle AST scan flagged 1 potential credential token
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; [CORS] Evaluating origin reflection and cookie SameSite attributes...
                </div>
                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '4px', backgroundColor: 'rgba(255, 100, 45, 0.12)', borderLeft: '3px solid var(--ds-action-brand)' }}>
                  <span style={{ color: 'var(--ds-action-brand)', fontWeight: 600 }}>Summary:</span> 3 policy findings identified across target perimeter.
                </div>
              </div>
            )}

            {activeTab === 'verify' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Target requires ownership challenge before running active probes.
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Method: DNS TXT Record verification
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Record name: <span style={{ color: '#ffffff' }}>_zerivex-challenge</span>
                </div>
                <div style={{ color: 'var(--ds-mint)' }}>
                  &gt; Token: zx_verify_9b8f2c4a7e1d5a8b
                </div>
                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '4px', backgroundColor: 'rgba(89, 221, 170, 0.12)', borderLeft: '3px solid var(--ds-mint)' }}>
                  <span style={{ color: 'var(--ds-mint)', fontWeight: 600 }}>Verified:</span> Domain ownership cryptographically confirmed. Active probes enabled.
                </div>
              </div>
            )}

            {activeTab === 'remediate' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Finding: ZX-SEC-001 (CWE-798) Client Bundle Credential Leakage
                </div>
                <div style={{ color: 'var(--ds-butter)' }}>
                  &gt; Generating framework diff for Next.js (App Router)...
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Isolated NEXT_PUBLIC_ keys to server environment runtime.
                </div>
                <div style={{ color: 'var(--ds-text-on-ink-dim)' }}>
                  &gt; Running targeted re-test against Check Engine #04...
                </div>
                <div style={{ marginTop: '10px', padding: '8px 12px', borderRadius: '4px', backgroundColor: 'rgba(89, 221, 170, 0.12)', borderLeft: '3px solid var(--ds-mint)' }}>
                  <span style={{ color: 'var(--ds-mint)', fontWeight: 600 }}>Resolved:</span> Check passed cleanly. Tamper-evident audit vault updated.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
