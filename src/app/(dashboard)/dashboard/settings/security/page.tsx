'use client';

import { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function SecuritySettingsPage() {
  const { user, logout, logoutAll } = useAuth();
  const [revoking, setRevoking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogoutAll = async () => {
    if (!confirm('Are you sure you want to sign out of all devices and active sessions?')) {
      return;
    }
    setRevoking(true);
    try {
      await logoutAll();
    } catch {
      setMessage('Failed to revoke sessions. Please try again.');
      setRevoking(false);
    }
  };

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
          Account Security & Sessions
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Manage your active cryptographic sessions, device access, and platform role authorizations.
        </p>
      </div>

      {message && (
        <div
          style={{
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            color: '#93c5fd',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
          }}
        >
          {message}
        </div>
      )}

      {/* Account Info Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.75rem',
        }}
      >
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          Identity & Authorization
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', fontSize: '0.9rem' }}>
          <div style={{ color: 'var(--text-muted)' }}>Verified Email</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{user?.email}</div>

          <div style={{ color: 'var(--text-muted)' }}>Platform Role</div>
          <div>
            <span
              style={{
                display: 'inline-block',
                backgroundColor: user?.role === 'OWNER' ? 'rgba(37, 99, 235, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                color: user?.role === 'OWNER' ? '#60a5fa' : 'var(--text-primary)',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {user?.role}
            </span>
          </div>

          <div style={{ color: 'var(--text-muted)' }}>Session Type</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            Server-Side Persistent Cookie (<code>__Host-zerivex_session</code>, SHA-256 Hashed)
          </div>
        </div>
      </div>

      {/* Session Management Card */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '1.75rem',
        }}
      >
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
          Active Sessions & Revocation
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          If you notice unfamiliar activity or suspect your device was compromised, you can revoke this session
          or immediately invalidate all active sessions across all devices.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => logout()}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Sign Out Current Session
          </button>

          <button
            onClick={handleLogoutAll}
            disabled={revoking}
            style={{
              backgroundColor: 'var(--sev-critical-bg)',
              border: '1px solid var(--sev-critical)',
              color: '#fca5a5',
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: revoking ? 'not-allowed' : 'pointer',
            }}
          >
            {revoking ? 'Revoking...' : 'Sign Out All Devices'}
          </button>
        </div>
      </div>
    </div>
  );
}
