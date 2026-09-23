'use client';

import React from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute requiredRole="OWNER">
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
          <header
            style={{
              borderBottom: '1px solid #1e3a8a',
              backgroundColor: '#0f172a',
              padding: '0.85rem 1.5rem',
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
                      backgroundColor: '#2563eb',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                    }}
                  >
                    Z
                  </span>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#93c5fd', letterSpacing: '-0.02em' }}>
                    ZERIVEX CONTROL CENTER
                  </span>
                </a>

                <nav style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                  <a href="/admin" style={{ color: '#ffffff', fontWeight: 500 }}>
                    Overview
                  </a>
                  <a href="/admin/users" style={{ color: '#94a3b8' }}>
                    Users & Roles
                  </a>
                  <a href="/admin/audit-logs" style={{ color: '#94a3b8' }}>
                    Audit Trail
                  </a>
                </nav>
              </div>

              <a
                href="/dashboard"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#e2e8f0',
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                }}
              >
                ← Switch to Product View
              </a>
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
