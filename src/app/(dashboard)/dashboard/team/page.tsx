'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface Member {
  userId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'ORG_OWNER' | 'ORG_ADMIN' | 'ORG_MEMBER' | 'ORG_VIEWER' | 'ORG_AUDITOR';
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviterEmail?: string;
}

interface RoleStyle {
  bg: string;
  text: string;
  border: string;
}

const DEFAULT_ROLE_STYLE: RoleStyle = {
  bg: 'rgba(16, 185, 129, 0.15)',
  text: '#34d399',
  border: 'rgba(16, 185, 129, 0.3)',
};

const ROLE_COLORS: Record<string, RoleStyle> = {
  ORG_OWNER: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fbbf24', border: 'rgba(234, 179, 8, 0.3)' },
  ORG_ADMIN: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' },
  ORG_MEMBER: DEFAULT_ROLE_STYLE,
  ORG_VIEWER: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)' },
  ORG_AUDITOR: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.3)' },
};

export default function TeamManagementPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite Modal State
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ORG_ADMIN' | 'ORG_MEMBER' | 'ORG_VIEWER' | 'ORG_AUDITOR'>('ORG_MEMBER');
  const [inviting, setInviting] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Transfer Ownership Modal State
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferTargetUserId, setTransferTargetUserId] = useState('');
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    fetchTeamData();
  }, []);

  async function fetchTeamData() {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/teams/members'),
        fetch('/api/teams/invitations'),
      ]);

      const membersData = await membersRes.json();
      const invitesData = await invitesRes.json();

      if (membersData.success) {
        setMembers(membersData.data.members);
      } else {
        setError(membersData.error || 'Failed to load team members');
      }

      if (invitesData.success) {
        setInvitations(invitesData.data.invitations);
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with server');
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(targetUserId: string, newRole: string) {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/teams/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to change role');
        return;
      }
      setSuccessMsg('Member role updated successfully');
      fetchTeamData();
    } catch (err: any) {
      setError(err?.message || 'Error updating member role');
    }
  }

  async function handleRemoveMember(targetUserId: string, targetEmail: string) {
    if (!window.confirm(`Are you sure you want to remove ${targetEmail} from this organization?`)) {
      return;
    }
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/teams/members?userId=${targetUserId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to remove member');
        return;
      }
      setSuccessMsg('Member removed successfully');
      fetchTeamData();
    } catch (err: any) {
      setError(err?.message || 'Error removing member');
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    if (!window.confirm('Revoke this invitation?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/teams/invitations/${invitationId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to revoke invitation');
        return;
      }
      setSuccessMsg('Invitation revoked');
      fetchTeamData();
    } catch (err: any) {
      setError(err?.message || 'Error revoking invitation');
    }
  }

  async function handleCreateInvitation(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    try {
      const res = await fetch('/api/teams/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to create invitation');
        setInviting(false);
        return;
      }

      const rawUrl = data.data.inviteUrl;
      const fullUrl = rawUrl.startsWith('http')
        ? rawUrl
        : `${window.location.origin}${rawUrl}`;

      setCreatedInviteUrl(fullUrl);
      setSuccessMsg('Invitation created successfully!');
      fetchTeamData();
    } catch (err: any) {
      setError(err?.message || 'Error generating invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleTransferOwnership(e: React.FormEvent) {
    e.preventDefault();
    if (!transferTargetUserId) return;
    if (
      !window.confirm(
        'Are you sure you want to transfer primary ownership? You will be demoted to ORG_ADMIN.'
      )
    ) {
      return;
    }

    setTransferring(true);
    setError(null);
    try {
      const res = await fetch('/api/teams/transfer-ownership', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOwnerUserId: transferTargetUserId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to transfer ownership');
        setTransferring(false);
        return;
      }
      setSuccessMsg('Ownership transferred successfully!');
      setIsTransferOpen(false);
      fetchTeamData();
    } catch (err: any) {
      setError(err?.message || 'Error transferring ownership');
    } finally {
      setTransferring(false);
    }
  }

  const currentUserMembership = members.find((m) => m.userId === user?.id);
  const isOrgOwner = currentUserMembership?.role === 'ORG_OWNER' || user?.role === 'OWNER';
  const canManageMembers = isOrgOwner || currentUserMembership?.role === 'ORG_ADMIN';

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Enterprise Team Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.95rem' }}>
            Manage organization members, assign role-based permissions, and invite collaborators.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {isOrgOwner && members.length > 1 && (
            <button
              onClick={() => setIsTransferOpen(true)}
              style={{
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                color: '#fbbf24',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                padding: '0.6rem 1.1rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Transfer Ownership
            </button>
          )}

          {canManageMembers && (
            <button
              id="invite-member-btn"
              onClick={() => {
                setInviteEmail('');
                setCreatedInviteUrl(null);
                setIsInviteOpen(true);
              }}
              style={{
                backgroundColor: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>+</span>
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          {error}
        </div>
      )}

      {successMsg && (
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          {successMsg}
        </div>
      )}

      {/* Members Section */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          marginBottom: '2.5rem',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            Active Members ({members.length})
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Sole Owner Protection: Active
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading organization roster...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Organization Role</th>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Joined</th>
                  {canManageMembers && (
                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const roleStyle = ROLE_COLORS[m.role] || DEFAULT_ROLE_STYLE;
                  const isSelf = m.userId === user?.id;

                  return (
                    <tr
                      key={m.userId}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              backgroundColor: 'rgba(59, 130, 246, 0.2)',
                              color: '#60a5fa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                            }}
                          >
                            {((m.displayName || m.email || 'U')[0] ?? 'U').toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {m.displayName || m.email.split('@')[0]}
                              {isSelf && (
                                <span
                                  style={{
                                    marginLeft: '0.5rem',
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: '4px',
                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  YOU
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '1rem 1.5rem' }}>
                        {canManageMembers && (!isSelf || isOrgOwner) ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                            style={{
                              backgroundColor: roleStyle.bg,
                              color: roleStyle.text,
                              border: `1px solid ${roleStyle.border}`,
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              outline: 'none',
                            }}
                          >
                            <option value="ORG_OWNER">ORG_OWNER</option>
                            <option value="ORG_ADMIN">ORG_ADMIN</option>
                            <option value="ORG_MEMBER">ORG_MEMBER</option>
                            <option value="ORG_VIEWER">ORG_VIEWER</option>
                            <option value="ORG_AUDITOR">ORG_AUDITOR</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              backgroundColor: roleStyle.bg,
                              color: roleStyle.text,
                              border: `1px solid ${roleStyle.border}`,
                              borderRadius: 'var(--radius-sm)',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                            }}
                          >
                            {m.role}
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(m.joinedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      {canManageMembers && (
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRemoveMember(m.userId, m.email)}
                            disabled={m.role === 'ORG_OWNER' && members.filter(x => x.role === 'ORG_OWNER').length <= 1}
                            style={{
                              backgroundColor: 'transparent',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              cursor:
                                m.role === 'ORG_OWNER' && members.filter(x => x.role === 'ORG_OWNER').length <= 1
                                  ? 'not-allowed'
                                  : 'pointer',
                              opacity:
                                m.role === 'ORG_OWNER' && members.filter(x => x.role === 'ORG_OWNER').length <= 1
                                  ? 0.4
                                  : 1,
                            }}
                            title={
                              m.role === 'ORG_OWNER' && members.filter(x => x.role === 'ORG_OWNER').length <= 1
                                ? 'Cannot remove the sole organization owner'
                                : 'Remove member'
                            }
                          >
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invitations Section */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
            Pending Invitations ({invitations.length})
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            SHA-256 Hashed Tokens (7-day TTL)
          </div>
        </div>

        {invitations.length === 0 ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No pending invitations. Click &quot;Invite Member&quot; to invite engineers.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invited Email</th>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Invited By</th>
                  <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expires In</th>
                  {canManageMembers && (
                    <th style={{ padding: '0.85rem 1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => {
                  const daysLeft = Math.max(
                    0,
                    Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  );

                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '1rem 1.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {inv.email}
                      </td>
                      <td style={{ padding: '1rem 1.5rem' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            color: '#60a5fa',
                          }}
                        >
                          {inv.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {inv.inviterEmail || 'Unknown'}
                      </td>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.85rem', color: daysLeft <= 1 ? '#f87171' : 'var(--text-secondary)' }}>
                        {daysLeft} days left
                      </td>
                      {canManageMembers && (
                        <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleRevokeInvitation(inv.id)}
                            style={{
                              backgroundColor: 'transparent',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              padding: '0.35rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.8rem',
                              fontWeight: 500,
                              cursor: 'pointer',
                            }}
                          >
                            Revoke
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      {isInviteOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '520px',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Invite Team Member
              </h2>
              <button
                onClick={() => setIsInviteOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {!createdInviteUrl ? (
              <form onSubmit={handleCreateInvitation}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                    Email Address
                  </label>
                  <input
                    id="invite-email-input"
                    type="email"
                    required
                    placeholder="engineer@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                    Organization Role
                  </label>
                  <select
                    id="invite-role-select"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'var(--bg-main)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  >
                    <option value="ORG_ADMIN">ORG_ADMIN - Full target, scan, policy and invitation controls</option>
                    <option value="ORG_MEMBER">ORG_MEMBER - Launch scans, evaluate findings, write comments</option>
                    <option value="ORG_VIEWER">ORG_VIEWER - Read-only dashboard and findings access</option>
                    <option value="ORG_AUDITOR">ORG_AUDITOR - Compliance auditor with SIEM / Audit Vault export</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsInviteOpen(false)}
                    style={{
                      backgroundColor: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      padding: '0.6rem 1.1rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-invite-btn"
                    type="submit"
                    disabled={inviting}
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      border: 'none',
                      color: '#fff',
                      padding: '0.6rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: inviting ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    {inviting ? 'Generating...' : 'Generate Invitation'}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.25rem',
                    fontSize: '0.9rem',
                  }}
                >
                  ✓ Secure single-use invitation generated! The raw 256-bit token is not stored in our database.
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                    Invitation Link
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      id="invite-link-output"
                      readOnly
                      value={createdInviteUrl}
                      style={{
                        flex: 1,
                        padding: '0.65rem 0.85rem',
                        backgroundColor: 'var(--bg-main)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontFamily: 'monospace',
                      }}
                    />
                    <button
                      id="copy-invite-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(createdInviteUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2500);
                      }}
                      style={{
                        backgroundColor: copied ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        border: 'none',
                        padding: '0.65rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                      }}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => {
                      setIsInviteOpen(false);
                      setCreatedInviteUrl(null);
                    }}
                    style={{
                      backgroundColor: 'var(--accent-primary)',
                      border: 'none',
                      color: '#fff',
                      padding: '0.6rem 1.25rem',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {isTransferOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '520px',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, marginBottom: '0.85rem' }}>
              Transfer Primary Organization Ownership
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Assign another team member to become the primary <strong style={{ color: '#fbbf24' }}>ORG_OWNER</strong>.
              Your account will automatically transition to <strong style={{ color: '#60a5fa' }}>ORG_ADMIN</strong>.
            </p>

            <form onSubmit={handleTransferOwnership}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem', fontWeight: 500 }}>
                  Select Successor Owner
                </label>
                <select
                  value={transferTargetUserId}
                  onChange={(e) => setTransferTargetUserId(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                >
                  <option value="">-- Choose member --</option>
                  {members
                    .filter((m) => m.userId !== user?.id)
                    .map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName || m.email} ({m.role})
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsTransferOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '0.6rem 1.1rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferring || !transferTargetUserId}
                  style={{
                    backgroundColor: '#eab308',
                    border: 'none',
                    color: '#000',
                    padding: '0.6rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    cursor: transferring || !transferTargetUserId ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                  }}
                >
                  {transferring ? 'Transferring...' : 'Confirm Ownership Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
