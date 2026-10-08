'use client';

import { useState, useEffect } from 'react';
import {
  UserPlus,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { StaffRole } from '@/core/staff/staff-permissions';

interface StaffMemberItem {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  role: StaffRole;
  createdAt: string;
  revokedAt: string | null;
}

export default function StaffManagementPage() {
  const [members, setMembers] = useState<StaffMemberItem[]>([]);
  const [activeOwnersCount, setActiveOwnersCount] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New staff modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<StaffRole>('STAFF_SUPPORT');
  const [saving, setSaving] = useState(false);

  const loadMembers = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch('/api/staff/members');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMembers(data.data.staffMembers || []);
          setActiveOwnersCount(data.data.activeOwnersCount || 1);
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to load staff list');
      }
    } catch {
      setErrorMsg('Network error loading staff list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    try {
      setSaving(true);
      setErrorMsg(null);
      const res = await fetch('/api/staff/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zerivex-Staff': 'true',
        },
        body: JSON.stringify({ email: newEmail.trim(), role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to grant staff role');
        return;
      }

      setShowAddModal(false);
      setNewEmail('');
      setNewRole('STAFF_SUPPORT');
      await loadMembers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error granting staff role');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (member: StaffMemberItem) => {
    if (!confirm(`Are you sure you want to revoke staff privileges for ${member.email}?`)) {
      return;
    }

    try {
      setErrorMsg(null);
      const res = await fetch(`/api/staff/members?userId=${member.userId}`, {
        method: 'DELETE',
        headers: {
          'X-Zerivex-Staff': 'true',
        },
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to revoke staff role');
        return;
      }

      await loadMembers();
    } catch {
      setErrorMsg('Error revoking staff role');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px' }}>
            Staff & Platform Roles
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--staff-text-secondary)', margin: 0 }}>
            Manage privileged platform operator access. Enforces Google Workspace domain allowlists and Last-Owner protection.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={loadMembers}
            className="staff-btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setErrorMsg(null);
            }}
            className="staff-btn-brand"
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            <UserPlus size={14} />
            <span>Grant Staff Role</span>
          </button>
        </div>
      </div>

      {/* Warning: Single Owner Remaining */}
      {activeOwnersCount === 1 && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'var(--staff-warning-bg)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '6px',
            color: '#F59E0B',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertTriangle size={18} />
          <span>
            <strong>Business Continuity Warning:</strong> Only 1 active Staff Owner exists. We strongly recommend designating at least 2 Staff Owners to prevent lockout risks.
          </span>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--staff-danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--staff-danger)',
            fontSize: '13px',
            borderRadius: '6px',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Staff Table */}
      <div className="staff-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>Operator</th>
              <th>Platform Role</th>
              <th>Granted</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isRevoked = Boolean(m.revokedAt);
              return (
                <tr key={m.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{m.email}</div>
                    <div style={{ fontSize: '11px', color: 'var(--staff-text-muted)' }}>
                      {m.displayName || 'No display name'}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor:
                          m.role === 'STAFF_OWNER'
                            ? 'rgba(171, 108, 254, 0.2)'
                            : m.role === 'STAFF_ADMIN'
                            ? 'rgba(56, 189, 248, 0.2)'
                            : 'rgba(255, 255, 255, 0.08)',
                        color:
                          m.role === 'STAFF_OWNER'
                            ? '#AB6CFE'
                            : m.role === 'STAFF_ADMIN'
                            ? '#38BDF8'
                            : '#E9EAF0',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {m.role}
                    </span>
                  </td>
                  <td>{new Date(m.createdAt).toLocaleDateString()}</td>
                  <td>
                    {isRevoked ? (
                      <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: 600 }}>
                        Revoked
                      </span>
                    ) : (
                      <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 600 }}>
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {!isRevoked && (
                      <button
                        type="button"
                        onClick={() => handleRevoke(m)}
                        className="staff-btn-danger"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        title="Revoke staff role"
                      >
                        <Trash2 size={12} />
                        <span>Revoke</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Grant Staff Role Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <form
            onSubmit={handleAddMember}
            className="staff-card"
            style={{ width: '100%', maxWidth: '440px', padding: '28px' }}
          >
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
              Grant Staff Privilege
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--staff-text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
              The email must belong to an approved staff domain. The user will be required to authenticate via Google Workspace.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E9EAF0', marginBottom: '6px' }}>
                Corporate Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="operator@zerivex.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0E1015',
                  border: '1px solid var(--staff-border)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E9EAF0', marginBottom: '6px' }}>
                Staff Role Tier *
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as StaffRole)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#0E1015',
                  border: '1px solid var(--staff-border)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              >
                <option value="STAFF_SUPPORT">STAFF_SUPPORT (Read-only + Pro preview)</option>
                <option value="STAFF_ADMIN">STAFF_ADMIN (Suspend orgs + Capped credits)</option>
                <option value="STAFF_OWNER">STAFF_OWNER (Full platform root privilege)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="staff-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="staff-btn-brand"
              >
                <span>{saving ? 'Granting...' : 'Grant Role'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
