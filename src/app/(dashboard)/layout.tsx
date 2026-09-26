'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

function DashboardHeader() {
  const { user, isOwner, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Derive user initial for avatar
  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'rgba(10, 14, 23, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div className="container" style={{ padding: '0.75rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: Brand & Live Shield */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <a
              href="/dashboard"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  boxShadow: '0 0 16px rgba(37, 99, 235, 0.4)',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: '1rem',
                  letterSpacing: '0.05em',
                }}
              >
                Z
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: '1.15rem',
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    lineHeight: 1.1,
                  }}
                >
                  ZERIVEX
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: '#10b981',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    letterSpacing: '0.06em',
                  }}
                >
                  <span className="pulse-indicator" style={{ width: '6px', height: '6px' }} />
                  SHIELD ACTIVE
                </span>
              </div>
            </a>

            {/* Primary Nav Items */}
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <a
                href="/dashboard"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>📊</span> Overview
              </a>

              <a
                href="/dashboard/targets"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🎯</span> Targets
              </a>

              <a
                href="/dashboard/scans"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>⚡</span> Scans
              </a>

              <a
                href="/dashboard/findings"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🛡️</span> Findings
              </a>

              {/* Launch Readiness Hero Link */}
              <a
                href="/dashboard/launch-readiness"
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  color: '#34d399',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🚀</span> Launch Readiness
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    color: '#34d399',
                  }}
                >
                  100%
                </span>
              </a>

              {/* Modules Dropdown / Popover Toggle */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: '6px',
                    color: showMoreMenu ? '#60a5fa' : '#94a3b8',
                    backgroundColor: showMoreMenu ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    border: 'none',
                    fontSize: '0.88rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>Modules</span>
                  <span style={{ fontSize: '0.65rem' }}>▼</span>
                </button>

                {showMoreMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '120%',
                      left: 0,
                      width: '220px',
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '10px',
                      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
                      padding: '0.5rem',
                      zIndex: 200,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.2rem',
                    }}
                  >
                    <a
                      href="/academy"
                      onClick={() => setShowMoreMenu(false)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>🎓</span> Security Academy
                    </a>
                    <a
                      href="/dashboard/agency"
                      onClick={() => setShowMoreMenu(false)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>🏢</span> Agency Hub
                    </a>
                    <a
                      href="/dashboard/team"
                      onClick={() => setShowMoreMenu(false)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>👥</span> Team & Roles
                    </a>
                    <a
                      href="/dashboard/audit-vault"
                      onClick={() => setShowMoreMenu(false)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>🔒</span> Audit Vault
                    </a>
                    <a
                      href="/dashboard/billing"
                      onClick={() => setShowMoreMenu(false)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>💳</span> Billing & Quotas
                    </a>
                    <a
                      href="/dashboard/settings/security"
                      onClick={() => setShowMoreMenu(false)}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      <span>🔑</span> Active Sessions
                    </a>
                  </div>
                )}
              </div>

              {isOwner && (
                <a
                  href="/admin"
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(37, 99, 235, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    color: '#60a5fa',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>🛡️</span> Control Center
                </a>
              )}
            </nav>
          </div>

          {/* Right: User Profile & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {userInitial}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
                <span style={{ fontSize: '0.68rem', color: isOwner ? '#60a5fa' : '#94a3b8', fontWeight: 600 }}>
                  {user?.role || 'MEMBER'}
                </span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Sign Out
            </button>
          </div>
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
          <main style={{ flex: 1, padding: '2rem 0 4rem' }}>
            <div className="container">{children}</div>
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
