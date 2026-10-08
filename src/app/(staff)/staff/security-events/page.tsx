'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle, Shield } from 'lucide-react';

interface SecurityEventItem {
  id: string;
  action: string;
  actorType: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export default function StaffSecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/security-events');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEvents(data.data.events || []);
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px' }}>
            Platform Security Events
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--staff-text-secondary)', margin: 0 }}>
            Audit log of failed authentications, SSRF ingress blocks, verification anomalies, and privilege elevations.
          </p>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          className="staff-btn-secondary"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="staff-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>Event Action</th>
              <th>Actor Type</th>
              <th>Resource</th>
              <th>IP Origin</th>
              <th>Details / Reason</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--staff-text-muted)' }}>
                  {loading ? 'Reading audit vault...' : 'No security anomalies detected.'}
                </td>
              </tr>
            ) : (
              events.map((evt) => {
                const isFailedAuth = evt.action.includes('FAILED_LOGIN');
                return (
                  <tr key={evt.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isFailedAuth ? (
                          <AlertTriangle size={14} color="#EF4444" />
                        ) : (
                          <Shield size={14} color="#AB6CFE" />
                        )}
                        <span style={{ fontWeight: 600, color: isFailedAuth ? '#EF4444' : '#FFFFFF' }}>
                          {evt.action}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            evt.actorType === 'STAFF'
                              ? 'rgba(171, 108, 254, 0.15)'
                              : evt.actorType === 'SYSTEM'
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(255, 255, 255, 0.05)',
                          color:
                            evt.actorType === 'STAFF'
                              ? '#AB6CFE'
                              : evt.actorType === 'SYSTEM'
                              ? '#38BDF8'
                              : 'var(--staff-text-secondary)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        {evt.actorType}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--staff-text-secondary)' }}>
                        {evt.resourceType}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '11.5px', color: 'var(--staff-text-muted)' }}>
                        {evt.ipAddress || 'Internal'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)' }}>
                        {evt.reason || (evt.metadata ? JSON.stringify(evt.metadata) : '—')}
                      </div>
                    </td>
                    <td>{new Date(evt.createdAt).toLocaleString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
