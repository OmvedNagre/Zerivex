'use client';

import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Clock,
  AlertCircle,
  PlayCircle,
} from 'lucide-react';

interface QueueItem {
  id: string;
  orgName: string;
  hostname: string;
  scanMode: string;
  status: string;
  score: number | null;
  workerId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export default function StaffQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/staff/queue');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setQueue(data.data.queue || []);
        }
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px' }}>
            Scan Queue & Failures
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--staff-text-secondary)', margin: 0 }}>
            Fleet-wide execution telemetry for in-flight scan workers, pending pipelines, and failed jobs.
          </p>
        </div>
        <button
          type="button"
          onClick={loadQueue}
          className="staff-btn-secondary"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Queue</span>
        </button>
      </div>

      <div className="staff-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="staff-table">
          <thead>
            <tr>
              <th>Target Host</th>
              <th>Organization</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Worker / Diagnostics</th>
              <th>Queued Time</th>
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--staff-text-muted)' }}>
                  {loading ? 'Polling orchestrator...' : 'Scan queue is currently clear. Zero active failures.'}
                </td>
              </tr>
            ) : (
              queue.map((item) => {
                const isFailed = item.status === 'FAILED';
                const isRunning = item.status === 'RUNNING';
                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#FFFFFF' }}>{item.hostname}</div>
                      <div style={{ fontSize: '11px', color: 'var(--staff-text-muted)' }}>
                        Job ID: {item.id.slice(0, 8)}
                      </div>
                    </td>
                    <td>{item.orgName}</td>
                    <td>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#AB6CFE' }}>
                        {item.scanMode}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isFailed ? (
                          <AlertCircle size={14} color="#EF4444" />
                        ) : isRunning ? (
                          <PlayCircle size={14} color="#38BDF8" className="animate-pulse" />
                        ) : (
                          <Clock size={14} color="#F59E0B" />
                        )}
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: isFailed ? '#EF4444' : isRunning ? '#38BDF8' : '#F59E0B',
                          }}
                        >
                          {item.status}
                        </span>
                      </div>
                    </td>
                    <td>
                      {isFailed ? (
                        <div style={{ color: '#EF4444', fontSize: '12px', maxWidth: '320px', wordBreak: 'break-word' }}>
                          {item.errorMessage || 'Unknown execution fault'}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)' }}>
                          Worker: {item.workerId || 'Pending allocation'}
                        </div>
                      )}
                    </td>
                    <td>{new Date(item.createdAt).toLocaleTimeString()}</td>
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
