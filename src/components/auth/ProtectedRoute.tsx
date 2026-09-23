'use client';

import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PlatformRole } from '@/core/rbac/permissions';

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: PlatformRole;
}) {
  const { status, user, isOwner } = useAuth();

  if (status === 'AUTH_LOADING') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          color: 'var(--text-secondary)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--accent-primary)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            marginBottom: '1rem',
          }}
        />
        <p style={{ fontSize: '0.95rem' }}>Verifying secure session...</p>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (status === 'UNAUTHENTICATED') {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      window.location.href = `/login?returnTo=${encodeURIComponent(currentPath)}`;
    }
    return null;
  }

  if (status === 'AUTH_ERROR') {
    return (
      <div style={{ padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--sev-critical)', marginBottom: '1rem' }}>Authentication Error</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          Unable to verify your session. Please check your connection or sign in again.
        </p>
        <a
          href="/login"
          style={{
            backgroundColor: 'var(--accent-primary)',
            color: '#ffffff',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          Return to Sign In
        </a>
      </div>
    );
  }

  if (requiredRole && !isOwner && user?.role !== requiredRole) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--sev-high)', marginBottom: '1rem' }}>403 — Forbidden</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your account role ({user?.role}) does not have permission to access this administrative section.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
