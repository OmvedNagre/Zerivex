'use client';

import { useState } from 'react';
import { CopyButton } from '@/components/ui/CopyButton';
import { ArrowRight, AlertTriangle, CheckCircle2, Terminal } from 'lucide-react';

interface RuleDiff {
  id: string;
  name: string;
  cwe: string;
  owasp: string;
  checkId: string;
  frameworks: {
    nextjs: { before: string; after: string; filename: string };
    express: { before: string; after: string; filename: string };
    nginx: { before: string; after: string; filename: string };
  };
}

const SAMPLE_DIFFS: RuleDiff[] = [
  {
    id: 'ZX-HDR-001',
    name: 'Missing Strict-Transport-Security (HSTS)',
    cwe: 'CWE-319',
    owasp: 'A05:2021 Security Misconfiguration',
    checkId: 'check_hsts_policy',
    frameworks: {
      nextjs: {
        filename: 'next.config.mjs',
        before: `// Insecure: No transport security headers configured
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;`,
        after: `// Verified: Enforce HSTS with preload and subdomains
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;`,
      },
      express: {
        filename: 'src/server.js',
        before: `// Insecure: Raw Express without security headers
import express from 'express';
const app = express();
app.listen(3000);`,
        after: `// Verified: Enforce HSTS via Helmet middleware
import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(
  helmet.hsts({
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  })
);
app.listen(3000);`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/security.conf',
        before: `# Insecure: HTTP / HTTPS without HSTS header
server {
    listen 443 ssl;
    server_name example.com;
}`,
        after: `# Verified: RFC 6797 Strict Transport Security header
server {
    listen 443 ssl http2;
    server_name example.com;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
}`,
      },
    },
  },
  {
    id: 'ZX-CORS-001',
    name: 'Wildcard CORS with Credentials Reflection',
    cwe: 'CWE-942',
    owasp: 'A01:2021 Broken Access Control',
    checkId: 'check_cors_permissive',
    frameworks: {
      nextjs: {
        filename: 'src/app/api/data/route.ts',
        before: `// Insecure: Reflecting wildcards with credentials
export async function GET(req: Request) {
  return new Response(JSON.stringify({ secret: true }), {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}`,
        after: `// Verified: Whitelist explicit allowed origin only
const ALLOWED_ORIGIN = process.env.TRUSTED_ORIGIN || 'https://app.zerivex.com';

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  const isAllowed = origin === ALLOWED_ORIGIN;

  return new Response(JSON.stringify({ secret: true }), {
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? origin! : ALLOWED_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Vary': 'Origin',
    },
  });
}`,
      },
      express: {
        filename: 'src/routes/api.js',
        before: `// Insecure: Blind CORS reflection
import cors from 'cors';
app.use(cors({ origin: true, credentials: true }));`,
        after: `// Verified: Restrict CORS to authorized frontend domain
import cors from 'cors';

const allowedOrigins = ['https://app.zerivex.com'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS'));
      }
    },
    credentials: true,
  })
);`,
      },
      nginx: {
        filename: '/etc/nginx/conf.d/cors.conf',
        before: `# Insecure: Static wildcard with credentials
add_header 'Access-Control-Allow-Origin' '*';
add_header 'Access-Control-Allow-Credentials' 'true';`,
        after: `# Verified: Exact trusted origin match
if ($http_origin ~* "^https://(app\\.zerivex\\.com)$") {
    add_header 'Access-Control-Allow-Origin' "$http_origin" always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
}`,
      },
    },
  },
];

export function BeforeAfterSplit() {
  const [activeRuleIdx, setActiveRuleIdx] = useState(0);
  const [activeFramework, setActiveFramework] = useState<'nextjs' | 'express' | 'nginx'>('nextjs');

  const rule = SAMPLE_DIFFS[activeRuleIdx] ?? SAMPLE_DIFFS[0]!;
  const fwData = rule.frameworks[activeFramework];

  return (
    <section
      style={{
        padding: '96px 24px',
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
          <span>Deterministic Code Remediation</span>
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
          Exact before &amp; after code patches.
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
          No vague security theory. Zerivex provides ready-to-paste snippets for Next.js, Express, and Nginx, with the CLI verify command to test the fix.
        </p>
      </div>

      {/* Selector bar: Select rule & Framework */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '28px',
          padding: '16px 20px',
          backgroundColor: 'var(--ds-bg-card)',
          borderRadius: 'var(--ds-radius-lg)',
          border: '1px solid var(--ds-border-subtle)',
          boxShadow: 'var(--ds-shadow-1)',
        }}
      >
        {/* Rule Selector Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SAMPLE_DIFFS.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setActiveRuleIdx(i)}
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid',
                borderColor: activeRuleIdx === i ? 'var(--ds-border-strong)' : 'var(--ds-border-subtle)',
                backgroundColor: activeRuleIdx === i ? 'var(--ds-bg-subtle)' : 'transparent',
                color: 'var(--ds-text-primary)',
                fontSize: '13px',
                fontWeight: activeRuleIdx === i ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', marginRight: '6px', color: 'var(--ds-action-brand)' }}>
                {r.id}
              </span>
              <span>{r.name}</span>
            </button>
          ))}
        </div>

        {/* Framework Selector Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--ds-bg-subtle)',
            padding: '4px',
            borderRadius: 'var(--ds-radius-md)',
            gap: '4px',
          }}
        >
          {[
            { id: 'nextjs', label: 'Next.js' },
            { id: 'express', label: 'Express' },
            { id: 'nginx', label: 'Nginx' },
          ].map((fw) => (
            <button
              key={fw.id}
              type="button"
              onClick={() => setActiveFramework(fw.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--ds-radius-sm)',
                border: 'none',
                backgroundColor: activeFramework === fw.id ? 'var(--ds-bg-card)' : 'transparent',
                color: activeFramework === fw.id ? 'var(--ds-text-primary)' : 'var(--ds-text-muted)',
                fontWeight: activeFramework === fw.id ? 700 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: activeFramework === fw.id ? 'var(--ds-shadow-1)' : 'none',
              }}
            >
              {fw.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meta tags for current rule */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border-subtle)',
            color: 'var(--ds-text-secondary)',
          }}
        >
          {rule.cwe}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: 'var(--ds-bg-subtle)',
            border: '1px solid var(--ds-border-subtle)',
            color: 'var(--ds-text-secondary)',
          }}
        >
          {rule.owasp}
        </span>
        <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)', fontFamily: 'var(--font-mono)' }}>
          Target file: {fwData.filename}
        </span>
      </div>

      {/* Before vs After Split Columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
          marginBottom: '28px',
        }}
      >
        {/* Before Column (Red Tinted) */}
        <div
          style={{
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: '#FFF7F7',
            border: '1px solid rgba(209, 0, 47, 0.2)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderBottom: '1px solid rgba(209, 0, 47, 0.15)',
              backgroundColor: 'rgba(209, 0, 47, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} style={{ color: 'var(--ds-danger)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-danger)' }}>
                BEFORE: VULNERABLE
              </span>
            </div>
            <CopyButton value={fwData.before} label="Copy" />
          </div>

          <div style={{ padding: '18px', flex: 1, overflowX: 'auto' }} data-lenis-prevent>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#6E1B24',
              }}
            >
              <code>{fwData.before}</code>
            </pre>
          </div>
        </div>

        {/* After Column (Mint Tinted) */}
        <div
          style={{
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: '#F5FCF8',
            border: '1px solid rgba(0, 159, 129, 0.25)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderBottom: '1px solid rgba(0, 159, 129, 0.15)',
              backgroundColor: 'rgba(0, 159, 129, 0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--ds-success)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-success)' }}>
                AFTER: HARDENED PATCH
              </span>
            </div>
            <CopyButton value={fwData.after} label="Copy patch" />
          </div>

          <div style={{ padding: '18px', flex: 1, overflowX: 'auto' }} data-lenis-prevent>
            <pre
              style={{
                margin: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#064E3B',
              }}
            >
              <code>{fwData.after}</code>
            </pre>
          </div>
        </div>
      </div>

      {/* CLI Verify Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          borderRadius: 'var(--ds-radius-lg)',
          backgroundColor: 'var(--ds-bg-ink)',
          color: 'var(--ds-text-on-ink)',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Terminal size={16} style={{ color: 'var(--ds-action-brand)' }} />
          <span style={{ color: 'var(--ds-text-on-ink-dim)' }}>Targeted CLI Verification:</span>
          <span style={{ color: '#ffffff' }}>
            $ zerivex scan --target=https://your-domain.com --check={rule.checkId}
          </span>
        </div>

        <a
          href="#hero-scan"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--ds-action-brand)',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '13px',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span>Verify this on your site</span>
          <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}

export default BeforeAfterSplit;
