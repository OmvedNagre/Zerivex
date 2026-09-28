'use client';

import { useState } from 'react';
import { AuthProvider, useAuth } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

function DashboardHeader() {
  const { user, isOwner, logout } = useAuth();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Derive user initial for avatar
  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-header)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
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
                    color: 'var(--text-primary)',
                    lineHeight: 1.1,
                  }}
                >
                  ZERIVEX
                </span>
                <span
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--emerald)',
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
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-card-hover)',
                  border: '1px solid var(--border-subtle)',
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
                  color: 'var(--text-secondary)',
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
                  color: 'var(--text-secondary)',
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
                  color: 'var(--text-secondary)',
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
                  color: 'var(--emerald)',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--emerald-subtle)',
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
                    color: 'var(--emerald)',
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
                    color: showMoreMenu ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    backgroundColor: showMoreMenu ? 'var(--accent-subtle)' : 'transparent',
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
                      backgroundColor: 'var(--bg-dropdown)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-lg)',
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
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
                        color: 'var(--text-primary)',
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
                    color: 'var(--accent-primary)',
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

          {/* Right: Theme Toggle, User Profile & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Theme Toggle Button */}
            <ThemeToggle />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: 'var(--bg-card)',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
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
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
                <span style={{ fontSize: '0.68rem', color: isOwner ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                  {user?.role || 'MEMBER'}
                </span>
              </div>
            </div>

            <button
              onClick={() => logout()}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
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
