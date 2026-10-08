'use client';

import { useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import '@/styles/staff.css';

export default function StaffLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleStaffLogin = () => {
    setLoading(true);
    setError(null);
    // Direct Google OAuth flow strictly configured for staff callback
    window.location.href = '/api/auth/login/google?returnTo=/staff';
  };

  return (
    <div
      className="staff-root"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <div
        className="staff-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          textAlign: 'center',
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'rgba(171, 108, 254, 0.15)',
            border: '1px solid rgba(171, 108, 254, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <ShieldCheck size={26} color="#AB6CFE" />
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: '0 0 8px',
          }}
        >
          Zerivex Staff Console
        </h1>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--staff-text-secondary)',
            margin: '0 0 28px',
            lineHeight: 1.5,
          }}
        >
          Privileged platform operator interface. Requires authorized Google Workspace credentials with 2-Step Verification.
        </p>

        {error && (
          <div
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: 'var(--staff-danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--staff-danger)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              textAlign: 'left',
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleStaffLogin}
          className="staff-btn-brand"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '12px',
            fontSize: '14px',
          }}
        >
          <span>{loading ? 'Authenticating with Google...' : 'Sign in with Google Workspace'}</span>
        </button>

        <div
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--staff-border)',
            fontSize: '11px',
            color: 'var(--staff-text-muted)',
            lineHeight: 1.5,
          }}
        >
          Restricted access. All connection attempts, IP addresses, and operator actions are cryptographically logged to the platform audit vault.
        </div>
      </div>
    </div>
  );
}
