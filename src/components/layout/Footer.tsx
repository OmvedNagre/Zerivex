'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CircleDot, ExternalLink, Terminal } from 'lucide-react';

interface HealthState {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  timestamp?: string;
}

const FOOTER_COLUMNS = [
  {
    title: 'Platform',
    links: [
      { label: 'Security Console', href: '/login' },
      { label: 'Target Surface Discovery', href: '/dashboard/targets' },
      { label: 'Deterministic Scans', href: '/dashboard/scans' },
      { label: 'Vulnerability Findings', href: '/dashboard/findings' },
      { label: 'Audit Vault', href: '/dashboard/audit-vault' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Remediation Fix Catalog', href: '/academy' },
      { label: 'RFC 9116 security.txt', href: '/.well-known/security.txt' },
      { label: 'OASIS SARIF v2.1.0', href: '/dashboard/scans' },
      { label: 'API Keys & Secrets', href: '/dashboard/settings/api-keys' },
      { label: 'Webhooks & HMAC', href: '/dashboard/settings/webhooks' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'Security Academy', href: '/academy' },
      { label: 'OWASP Top 10 Guides', href: '/academy' },
      { label: 'SSRF Egress Architecture', href: '/academy' },
      { label: 'Ownership Verification', href: '/dashboard/targets' },
      { label: 'Fix Verification Protocol', href: '/academy' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Pricing & Plans', href: '/pricing' },
      { label: 'Team & RBAC', href: '/dashboard/team' },
      { label: 'Agency Portfolio', href: '/dashboard/agency' },
      { label: 'Active Sessions', href: '/dashboard/settings/security' },
      { label: 'System Health', href: '/api/health' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Acceptable Use Policy', href: '/acceptable-use' },
      { label: 'Responsible Disclosure', href: '/.well-known/security.txt' },
    ],
  },
];

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [health, setHealth] = useState<HealthState | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('Status not OK');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setHealth({
            status: data.status === 'DEGRADED' ? 'DEGRADED' : data.status === 'DOWN' ? 'DOWN' : 'HEALTHY',
            timestamp: data.timestamp,
          });
          setHealthLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHealth({ status: 'HEALTHY' });
          setHealthLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusColor = () => {
    if (!health) return 'var(--ds-success)';
    if (health.status === 'HEALTHY') return 'var(--ds-success)';
    if (health.status === 'DEGRADED') return 'var(--ds-warning)';
    return 'var(--ds-danger)';
  };

  const getStatusLabel = () => {
    if (healthLoading) return 'Checking system...';
    if (!health) return 'Systems operational';
    if (health.status === 'HEALTHY') return 'All systems operational';
    if (health.status === 'DEGRADED') return 'Degraded performance';
    return 'Service interruption';
  };

  return (
    <footer
      style={{
        backgroundColor: 'var(--ds-bg-subtle)',
        borderTop: '1px solid var(--ds-border-default)',
        color: 'var(--ds-text-primary)',
        position: 'relative',
        overflow: 'hidden',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '64px 24px 32px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Top bar with Status + CLI snippet */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            paddingBottom: '36px',
            marginBottom: '44px',
            borderBottom: '1px solid var(--ds-border-subtle)',
          }}
        >
          {/* Brand info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--ds-radius-md)',
                backgroundColor: 'var(--ds-action-brand)',
                color: 'var(--ds-on-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '15px',
                letterSpacing: '-0.02em',
              }}
            >
              Z
            </div>
            <div>
              <span style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.03em', fontFamily: 'var(--font-display)' }}>
                ZERIVEX
              </span>
              <span
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: 'var(--ds-text-muted)',
                }}
              >
                Security for software built with AI
              </span>
            </div>
          </div>

          {/* Right utility items: Status pill + decorative cURL command */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Live Status Pill */}
            <Link
              href="/api/health"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--ds-radius-pill)',
                backgroundColor: 'var(--ds-bg-card)',
                border: '1px solid var(--ds-border-subtle)',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--ds-text-secondary)',
                textDecoration: 'none',
                transition: 'border-color 0.15s ease',
              }}
            >
              <CircleDot
                size={14}
                style={{
                  color: getStatusColor(),
                  animation: health?.status === 'DEGRADED' ? 'pulse 2s infinite' : 'none',
                }}
              />
              <span>{getStatusLabel()}</span>
            </Link>

            {/* Decorative CLI touch */}
            <div
              aria-hidden="true"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: 'var(--ds-radius-pill)',
                backgroundColor: 'var(--ds-bg-ink)',
                color: 'var(--ds-text-on-ink)',
                fontSize: '11px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <Terminal size={12} style={{ color: 'var(--ds-action-brand)' }} />
              <span style={{ color: 'var(--ds-text-on-ink-dim)' }}>$</span>
              <span>curl -I https://zerivex.com/.well-known/security.txt</span>
            </div>
          </div>
        </div>

        {/* Navigation Link Columns */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '36px',
            marginBottom: '56px',
          }}
        >
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h3
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--ds-text-primary)',
                  marginBottom: '16px',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {col.title}
              </h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: '13px',
                        color: 'var(--ds-text-secondary)',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-primary)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = 'var(--ds-text-secondary)';
                      }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar: Copyright, Security.txt, Brand principle */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            paddingTop: '24px',
            borderTop: '1px solid var(--ds-border-subtle)',
            fontSize: '12px',
            color: 'var(--ds-text-muted)',
          }}
        >
          <div>
            &copy; {currentYear} ZERIVEX. All rights reserved. &bull;{' '}
            <span style={{ fontWeight: 600, color: 'var(--ds-text-secondary)' }}>
              Verify. Detect. Defend.
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link
              href="/.well-known/security.txt"
              style={{
                color: 'var(--ds-text-secondary)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>security.txt</span>
              <ExternalLink size={12} />
            </Link>
            <Link
              href="/pricing"
              style={{
                color: 'var(--ds-text-secondary)',
                textDecoration: 'none',
              }}
            >
              Pricing
            </Link>
            <Link
              href="/academy"
              style={{
                color: 'var(--ds-text-secondary)',
                textDecoration: 'none',
              }}
            >
              Security Academy
            </Link>
          </div>
        </div>
      </div>

      {/* Giant cropped "ZERIVEX" wordmark */}
      <div
        aria-hidden="true"
        style={{
          userSelect: 'none',
          pointerEvents: 'none',
          position: 'relative',
          bottom: '-18px',
          width: '100%',
          overflow: 'hidden',
          lineHeight: 0.75,
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 'clamp(90px, 16vw, 240px)',
          letterSpacing: '-0.05em',
          color: 'rgba(25, 27, 35, 0.05)',
        }}
      >
        ZERIVEX
      </div>
    </footer>
  );
}

export default Footer;
