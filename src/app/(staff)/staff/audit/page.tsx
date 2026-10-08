'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface StaffAuditItem {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export default function StaffAuditPage() {
  const [logs, setLogs] = useState<StaffAuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/audit');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLogs(data.data.auditLogs || []);
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px' }}>
            Staff Activity Log
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--staff-text-secondary)', margin: 0 }}>
            Tamper-evident activity log of all privileged staff operations and session transitions.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAudit}
          className="staff-btn-secondary"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      <div className="staff-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>Operator</th>
              <th>Action</th>
              <th>Target Resource</th>
              <th>Reason / Justification</th>
              <th>IP Address</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--staff-text-muted)' }}>
                  {loading ? 'Querying audit ledger...' : 'No staff audit events recorded yet.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#FFFFFF' }}>
                      {log.actorEmail || 'System / Service'}
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'rgba(171, 108, 254, 0.15)',
                        color: '#AB6CFE',
                        padding: '2px 8px',
                        borderRadius: '4px',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--staff-text-secondary)' }}>
                      {log.resourceType}: {log.resourceId?.slice(0, 8) || '—'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)', maxWidth: '280px' }}>
                      {log.reason || (log.metadata ? JSON.stringify(log.metadata) : '—')}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--staff-text-muted)' }}>
                      {log.ipAddress || 'Internal'}
                    </span>
                  </td>
                  <td>{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
