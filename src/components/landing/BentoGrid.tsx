'use client';

import { useState } from 'react';
import {
  KeyRound,
  Lock,
  Globe,
  Bug,
  Network,
  Bot,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

interface BentoCardData {
  id: string;
  icon: typeof KeyRound;
  category: string;
  headline: string;
  summary: string;
  checkDetail: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  rulePrefix: string;
  colSpan?: number;
  academyHref: string;
}

const BENTO_CARDS: BentoCardData[] = [
  {
    id: 'secrets',
    icon: KeyRound,
    category: 'Secrets & Files',
    headline: 'Publicly readable .env and .git repository metadata',
    summary:
      'Misconfigured reverse proxies and static servers directly expose environment secrets, database credentials, and Git commit history.',
    checkDetail: 'Probes /.env, /.git/HEAD, and /.git/config with content-signature validation.',
    severity: 'CRITICAL',
    rulePrefix: 'ZX-SEC-*',
    colSpan: 2,
    academyHref: '/academy/client-side-secret-leakage',
  },
  {
    id: 'headers',
    icon: Lock,
    category: 'Perimeter Hardening',
    headline: 'Missing HSTS & clickjacking protection',
    summary:
      'Leaves production traffic susceptible to SSL stripping and malicious iframe framing.',
    checkDetail: 'Validates RFC 6797 max-age directive and X-Frame-Options DENY/SAMEORIGIN policies.',
    severity: 'HIGH',
    rulePrefix: 'ZX-HDR-*',
    colSpan: 1,
    academyHref: '/academy/essential-security-headers',
  },
  {
    id: 'cors',
    icon: Globe,
    category: 'API Perimeter',
    headline: 'Wildcard CORS origins with credentials enabled',
    summary:
      'Copy-pasted StackOverflow CORS handlers allow arbitrary websites to make authenticated requests on behalf of your users.',
    checkDetail: 'Sends origin reflection probes and validates Access-Control-Allow-Credentials combinations.',
    severity: 'MEDIUM',
    rulePrefix: 'ZX-CORS-*',
    colSpan: 1,
    academyHref: '/academy/overly-permissive-cors',
  },
  {
    id: 'injection',
    icon: Bug,
    category: 'Data Layer',
    headline: 'Unparameterized queries & SQL injection bugs',
    summary:
      'AI tools writing raw database strings without parameterization expose user tables to data exfiltration.',
    checkDetail: 'Non-destructive active SQLi payloads verify ORM escape guarantees with ownership gating.',
    severity: 'CRITICAL',
    rulePrefix: 'ZX-ACT-*',
    colSpan: 2,
    academyHref: '/academy/sql-injection-modern-orms',
  },
  {
    id: 'api-exposure',
    icon: Network,
    category: 'Attack Surface',
    headline: 'Exposed GraphQL introspection & debug routes',
    summary:
      'Development-only diagnostic endpoints and schema explorers accidentally left publicly accessible in production.',
    checkDetail: 'Crawls standard schema query paths and flags schema exposure on production origins.',
    severity: 'MEDIUM',
    rulePrefix: 'ZX-API-*',
    colSpan: 1,
    academyHref: '/academy',
  },
  {
    id: 'ai-smells',
    icon: Bot,
    category: 'AI Code Smells',
    headline: 'Leftover debug routes, seed endpoints & GraphQL introspection',
    summary:
      'Development-only diagnostic endpoints, database seed scripts, and GraphQL schema introspection left accessible in production.',
    checkDetail: 'Leftover debug routes, seed endpoints and open GraphQL introspection.',
    severity: 'HIGH',
    rulePrefix: 'ZX-AI-*',
    colSpan: 2,
    academyHref: '/academy',
  },
];

export function BentoGrid() {
  const [activePreview, setActivePreview] = useState<string | null>(null);

  const getSeverityStyle = (sev: string) => {
    if (sev === 'CRITICAL') return { color: 'var(--ds-danger)', bg: 'rgba(209, 0, 47, 0.08)' };
    if (sev === 'HIGH') return { color: 'var(--ds-warning)', bg: 'rgba(216, 121, 0, 0.08)' };
    return { color: 'var(--ds-info)', bg: 'rgba(0, 143, 248, 0.08)' };
  };

  return (
    <section
      style={{
        padding: '80px 24px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 12px',
            borderRadius: 'var(--ds-radius-pill)',
            backgroundColor: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border-default)',
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--ds-text-primary)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}
        >
          <span>Automated Problem Discovery</span>
        </div>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(30px, 4vw, 48px)',
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            color: 'var(--ds-text-primary)',
            margin: '0 0 16px',
          }}
        >
          Mistakes AI tools leave behind.
        </h2>
        <p
          style={{
            fontSize: '17px',
            color: 'var(--ds-text-secondary)',
            maxWidth: '640px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Cursor, Bolt, v0, and Claude write functional code fast—but security boundaries are easily skipped. Zerivex catches the blind spots.
        </p>
      </div>

      {/* Bento Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {BENTO_CARDS.map((card) => {
          const Icon = card.icon;
          const sevStyle = getSeverityStyle(card.severity);
          const isHovered = activePreview === card.id;

          return (
            <div
              key={card.id}
              onMouseEnter={() => setActivePreview(card.id)}
              onMouseLeave={() => setActivePreview(null)}
              style={{
                borderRadius: 'var(--ds-radius-lg)',
                backgroundColor: 'var(--ds-bg-card)',
                border: isHovered ? '1px solid var(--ds-border-strong)' : '1px solid var(--ds-border-subtle)',
                boxShadow: isHovered ? 'var(--ds-shadow-sticker)' : 'var(--ds-shadow-1)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                transform: isHovered ? 'translateY(-2px)' : 'none',
                position: 'relative',
              }}
            >
              <div>
                {/* Top Row: Icon + Category + Severity Chip */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--ds-radius-md)',
                        backgroundColor: 'var(--ds-bg-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--ds-text-primary)',
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-muted)' }}>
                      {card.category}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--ds-radius-sm)',
                        color: sevStyle.color,
                        backgroundColor: sevStyle.bg,
                      }}
                    >
                      {card.severity}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--ds-text-muted)',
                      }}
                    >
                      {card.rulePrefix}
                    </span>
                  </div>
                </div>

                {/* Headline */}
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    lineHeight: 1.3,
                    color: 'var(--ds-text-primary)',
                    margin: '0 0 10px',
                  }}
                >
                  {card.headline}
                </h3>

                {/* Summary */}
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: 1.55,
                    color: 'var(--ds-text-secondary)',
                    margin: '0 0 16px',
                  }}
                >
                  {card.summary}
                </p>
              </div>

              {/* Bottom Row: Detail + Guide Link */}
              <div
                style={{
                  paddingTop: '16px',
                  borderTop: '1px solid var(--ds-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--ds-text-muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {card.checkDetail}
                </span>

                <Link
                  href={card.academyHref}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--ds-action-link)',
                    textDecoration: 'none',
                    flexShrink: 0,
                    marginLeft: '12px',
                  }}
                >
                  <span>Playbook</span>
                  <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default BentoGrid;
