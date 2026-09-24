'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';

interface InvitationDetails {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  isExpired: boolean;
  inviterEmail: string;
  inviterName: string | null;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const { user, status } = useAuth();
  const authLoading = status === 'AUTH_LOADING';
  const isAuthenticated = status === 'AUTHENTICATED' && !!user;

  const [invite, setInvite] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function loadInvite() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/teams/invitations/${token}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || 'Invitation is invalid or has expired');
          return;
        }

        setInvite(data.data.invitation);
      } catch (err: any) {
        setError(err?.message || 'Error communicating with server');
      } finally {
        setLoading(false);
      }
    }

    loadInvite();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/invitations/${token}/accept`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to accept invitation');
        setAccepting(false);
        return;
      }

      setAccepted(true);
      setTimeout(() => {
        router.push('/dashboard/team');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Error accepting invitation');
      setAccepting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            backgroundColor: 'var(--accent-primary)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            marginBottom: '1.5rem',
          }}
        >
          Z
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '0.5rem' }}>
          Team Invitation
        </h1>

        {loading || authLoading ? (
          <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
            Verifying invitation token...
          </div>
        ) : error ? (
          <div>
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginTop: '1rem',
                marginBottom: '1.5rem',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              Go to Dashboard
            </button>
          </div>
        ) : accepted ? (
          <div>
            <div
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#34d399',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                marginTop: '1rem',
                marginBottom: '1rem',
                fontSize: '0.95rem',
                fontWeight: 600,
              }}
            >
              ✓ Invitation accepted! Redirecting to team dashboard...
            </div>
          </div>
        ) : invite ? (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              <strong>{invite.inviterName || invite.inviterEmail}</strong> has invited you to join{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{invite.organizationName}</strong> as an{' '}
              <span
                style={{
                  display: 'inline-block',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                {invite.role}
              </span>
              .
            </p>

            <div
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                marginBottom: '1.5rem',
                textAlign: 'left',
                fontSize: '0.85rem',
              }}
            >
              <div style={{ marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                Target Email: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{invite.email}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Expires:{' '}
                <span style={{ color: 'var(--text-primary)' }}>
                  {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {isAuthenticated ? (
              <div>
                <button
                  id="accept-invite-btn"
                  onClick={handleAccept}
                  disabled={accepting}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: accepting ? 'not-allowed' : 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  {accepting ? 'Joining Team...' : `Accept Invitation as ${user?.email}`}
                </button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  You will join {invite.organizationName} immediately.
                </div>
              </div>
            ) : (
              <div>
                <button
                  id="login-to-accept-btn"
                  onClick={() => router.push(`/login?redirect=/invite/${token}`)}
                  style={{
                    width: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  Log In to Accept Invitation
                </button>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Don&apos;t have an account? Log in or contact your administrator.
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
