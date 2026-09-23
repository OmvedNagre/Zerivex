'use client';

import { useAuth } from '@/components/auth/AuthProvider';

export default function DashboardPage() {
  const { user, isOwner } = useAuth();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Security Posture Overview
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {user ? `Welcome, ${user.displayName || user.email}. ` : ''}Continuous verification and attack surface monitoring for software built with AI.
          </p>
        </div>

        {isOwner && (
          <div
            style={{
              backgroundColor: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.3)',
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-sm)',
              color: '#93c5fd',
              fontSize: '0.85rem',
            }}
          >
            🛡️ Platform Owner Access Active
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Overall Security Score
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>--</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>/ 100</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Run your first verified scan to establish an empirical security baseline.
          </p>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Open Findings
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sev-critical)' }}>0</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Critical</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sev-high)' }}>0</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sev-medium)' }}>0</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Medium</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--sev-low)' }}>0</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Low</div>
            </div>
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '1.5rem',
          }}
        >
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            Monitored Targets
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>0</div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Configure DNS TXT or HTML tokens to authorize deep assessment.
          </p>
        </div>
      </div>

      {/* Quick Launch Action Banner */}
      <div
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Ready to verify your AI-deployed application?
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '600px' }}>
            Zerivex performs safe, deterministic inspection of TLS configurations, CSP headers, cookies, CORS,
            and exposed source maps without generating simulated findings.
          </p>
        </div>

        <a
          href="/dashboard/targets"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            padding: '0.75rem 1.5rem',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            fontSize: '0.95rem',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Add Scan Target
        </a>
      </div>
    </div>
  );
}
