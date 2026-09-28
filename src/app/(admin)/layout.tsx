'use client';

import React from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute requiredRole="OWNER">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
          <header
            style={{
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-header)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              padding: '0.85rem 1.5rem',
              transition: 'background-color 0.25s ease, border-color 0.25s ease',
            }}
          >
            <div
              className="container"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <a href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none' }}>
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
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}
                  >
                    Z
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--accent-primary)', letterSpacing: '-0.02em' }}>
                    ZERIVEX CONTROL CENTER
                  </span>
                </a>

                <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                  <a href="/admin" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                    Overview
                  </a>
                  <a href="/admin/users" style={{ color: 'var(--text-secondary)' }}>
                    Users & Roles
                  </a>
                  <a href="/admin/audit-logs" style={{ color: 'var(--text-secondary)' }}>
                    Audit Trail
                  </a>
                </nav>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ThemeToggle size="sm" />
                <a
                  href="/dashboard"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    padding: '0.4rem 0.8rem',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  ← Switch to Product View
                </a>
              </div>
            </div>
          </header>

          <main style={{ flex: 1, padding: '2rem 0' }}>
            <div className="container">{children}</div>
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
