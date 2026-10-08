'use client';

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Ban,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';

interface OrgItem {
  id: string;
  name: string;
  slug: string;
  isInternal: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  memberCount: number;
  targetCount: number;
  scanCount: number;
}

export default function StaffOrgsPage() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string>('STAFF_SUPPORT');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Suspension modal state
  const [selectedOrgForSuspend, setSelectedOrgForSuspend] = useState<OrgItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrgs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/orgs');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOrgs(data.data.organizations || []);
          setCurrentUserRole(data.data.currentUserRole || 'STAFF_SUPPORT');
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  const canSuspend = currentUserRole === 'STAFF_OWNER' || currentUserRole === 'STAFF_ADMIN';

  const handleConfirmSuspend = async () => {
    if (!selectedOrgForSuspend || !suspendReason.trim()) return;

    try {
      setActionLoading(true);
      setErrorMsg(null);
      const res = await fetch(`/api/staff/orgs/${selectedOrgForSuspend.id}/suspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zerivex-Staff': 'true',
        },
        body: JSON.stringify({ reason: suspendReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.reauthRequired) {
          setErrorMsg('Re-authentication required. Please refresh your staff session.');
        } else {
          setErrorMsg(data.error || 'Failed to suspend organization.');
        }
        return;
      }

      setSelectedOrgForSuspend(null);
      setSuspendReason('');
      await loadOrgs();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error executing suspension');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async (org: OrgItem) => {
    const reason = prompt(`Enter reason to unsuspend "${org.name}":`, 'Operational remediation verified');
    if (!reason) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/staff/orgs/${org.id}/unsuspend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zerivex-Staff': 'true',
        },
        body: JSON.stringify({ reason }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to unsuspend organization');
        return;
      }

      await loadOrgs();
    } catch {
      alert('Error unsuspending organization');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrgs = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px' }}>
            Customer Organizations
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--staff-text-secondary)', margin: 0 }}>
            Inspect client organization tenants, verify target coverage, and execute operational suspensions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrgs}
          className="staff-btn-secondary"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={14} color="#646A82" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            placeholder="Search by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              backgroundColor: 'var(--staff-bg-card)',
              border: '1px solid var(--staff-border)',
              borderRadius: '6px',
              color: '#FFFFFF',
              fontSize: '13px',
            }}
          />
        </div>
      </div>

      {/* Organizations Table Card */}
      <div className="staff-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>Organization</th>
              <th>Status</th>
              <th>Members</th>
              <th>Targets</th>
              <th>Scans</th>
              <th>Created</th>
              {canSuspend && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredOrgs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--staff-text-muted)' }}>
                  {loading ? 'Loading organizations...' : 'No organizations found matching search.'}
                </td>
              </tr>
            ) : (
              filteredOrgs.map((org) => {
                const isSuspended = Boolean(org.suspendedAt);
                return (
                  <tr key={org.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{org.name}</span>
                        {org.isInternal && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(171, 108, 254, 0.2)',
                              color: '#AB6CFE',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            INTERNAL
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--staff-text-muted)', marginTop: '2px' }}>
                        {org.slug}
                      </div>
                    </td>
                    <td>
                      {isSuspended ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444' }}>
                          <Ban size={13} />
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>Suspended</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981' }}>
                          <CheckCircle2 size={13} />
                          <span style={{ fontSize: '12px', fontWeight: 600 }}>Active</span>
                        </div>
                      )}
                    </td>
                    <td>{org.memberCount}</td>
                    <td>{org.targetCount}</td>
                    <td>{org.scanCount}</td>
                    <td>{new Date(org.createdAt).toLocaleDateString()}</td>
                    {canSuspend && (
                      <td style={{ textAlign: 'right' }}>
                        {!org.isInternal && (
                          isSuspended ? (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleUnsuspend(org)}
                              className="staff-btn-secondary"
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              <Check size={12} />
                              <span>Unsuspend</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => {
                                setSelectedOrgForSuspend(org);
                                setSuspendReason('');
                                setErrorMsg(null);
                              }}
                              className="staff-btn-danger"
                              style={{ fontSize: '11.5px', padding: '4px 10px' }}
                            >
                              <Ban size={12} />
                              <span>Suspend</span>
                            </button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Suspend Confirmation Modal */}
      {selectedOrgForSuspend && (
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
          <div
            className="staff-card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              border: '1px solid #EF4444',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#EF4444', marginBottom: '12px' }}>
              <AlertTriangle size={20} />
              <h2 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>
                Suspend Organization
              </h2>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--staff-text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Suspending <strong>{selectedOrgForSuspend.name}</strong> will prevent its members from launching scans or modifying target configs. Client data is preserved.
            </p>

            {errorMsg && (
              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--staff-danger-bg)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--staff-danger)',
                  fontSize: '12px',
                  borderRadius: '6px',
                  marginBottom: '16px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#E9EAF0', marginBottom: '6px' }}>
                Operational Justification / Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Terms of Service investigation, payment fraud, requested by owner"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: '#0E1015',
                  border: '1px solid var(--staff-border)',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  fontSize: '13px',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setSelectedOrgForSuspend(null)}
                className="staff-btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !suspendReason.trim()}
                onClick={handleConfirmSuspend}
                className="staff-btn-danger"
              >
                <span>{actionLoading ? 'Suspending...' : 'Confirm Suspension'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
