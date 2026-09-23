'use client';

import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function DashboardHeader() {
  const { user, isOwner, logout } = useAuth();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
        padding: '0.85rem 1.5rem',
      }}
    >
      <div
        className="container"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <a href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              Z
            </span>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              ZERIVEX
            </span>
          </a>

          <nav style={{ display: 'flex', gap: '1.25rem' }}>
            <a href="/dashboard" style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
              Overview
            </a>
            <a href="/dashboard/targets" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Targets
            </a>
            <a href="/dashboard/scans" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Scans
            </a>
            <a href="/dashboard/findings" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Findings
            </a>
            <a href="/dashboard/settings/security" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Sessions
            </a>
            {isOwner && (
              <a
                href="/admin"
                style={{
                  color: '#60a5fa',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <span>Control Center</span>
                <span
                  style={{
                    backgroundColor: 'rgba(37, 99, 235, 0.2)',
                    fontSize: '0.7rem',
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                  }}
                >
                  OWNER
                </span>
              </a>
            )}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.displayName || user?.email}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Role: <span style={{ color: isOwner ? '#60a5fa' : 'var(--text-secondary)', fontWeight: 600 }}>{user?.role}</span>
            </div>
          </div>

          <button
            onClick={() => logout()}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '0.4rem 0.8rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
          <DashboardHeader />
          <main style={{ flex: 1, padding: '2rem 0' }}>
            <div className="container">{children}</div>
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
