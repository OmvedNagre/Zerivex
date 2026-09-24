'use client';

import { useState, useEffect, useCallback } from 'react';

interface AuditVaultEntry {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface IntegrityStatus {
  verified: boolean;
  totalRecords: number;
  isMonotonic: boolean;
  message: string;
}

export default function AuditVaultPage() {
  const [entries, setEntries] = useState<AuditVaultEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Integrity Check State
  const [checkingIntegrity, setCheckingIntegrity] = useState(false);
  const [integrityStatus, setIntegrityStatus] = useState<IntegrityStatus | null>(null);

  // Expanded Metadata Modal/Drawer
  const [selectedEntry, setSelectedEntry] = useState<AuditVaultEntry | null>(null);

  const fetchVaultLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (actionFilter) params.set('action', actionFilter);
      if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const res = await fetch(`/api/audit-vault?${params.toString()}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to retrieve audit logs');
        return;
      }

      setEntries(data.data.entries);
      setTotal(data.data.total);
    } catch (err: any) {
      setError(err?.message || 'Error communicating with Audit Vault');
    } finally {
      setLoading(false);
    }
  }, [search, actionFilter, resourceTypeFilter, startDate, endDate, limit, offset]);

  useEffect(() => {
    fetchVaultLogs();
  }, [fetchVaultLogs]);

  async function handleVerifyIntegrity() {
    setCheckingIntegrity(true);
    try {
      const res = await fetch('/api/audit-vault/verify');
      const data = await res.json();
      if (res.ok && data.success) {
        setIntegrityStatus(data.data);
      } else {
        setError(data.error || 'Integrity verification failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Error running cryptographic verification');
    } finally {
      setCheckingIntegrity(false);
    }
  }

  function handleExport(format: 'csv' | 'json') {
    const params = new URLSearchParams();
    params.set('format', format);
    if (search.trim()) params.set('search', search.trim());
    if (actionFilter) params.set('action', actionFilter);
    if (resourceTypeFilter) params.set('resourceType', resourceTypeFilter);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);

    // Direct download trigger
    window.location.href = `/api/audit-vault/export?${params.toString()}`;
  }

  function handleResetFilters() {
    setSearch('');
    setActionFilter('');
    setResourceTypeFilter('');
    setStartDate('');
    setEndDate('');
    setOffset(0);
  }

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Enterprise Compliance Audit Vault
            </h1>
            <span
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
              }}
            >
              SOC 2 / ISO 27001 READY
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '0.95rem' }}>
            Append-only, immutable audit trail with actor attribution, parameter scrubbing, and SIEM export.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            id="verify-vault-btn"
            onClick={handleVerifyIntegrity}
            disabled={checkingIntegrity}
            style={{
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: checkingIntegrity ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span>🛡️</span>
            <span>{checkingIntegrity ? 'Verifying Chain...' : 'Verify Cryptographic Chain'}</span>
          </button>

          <button
            id="export-csv-btn"
            onClick={() => handleExport('csv')}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export CSV (RFC 4180)
          </button>

          <button
            id="export-siem-json-btn"
            onClick={() => handleExport('json')}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Export SIEM JSON
          </button>
        </div>
      </div>

      {/* Integrity Result Banner */}
      {integrityStatus && (
        <div
          style={{
            backgroundColor: integrityStatus.verified ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${integrityStatus.verified ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            color: integrityStatus.verified ? '#34d399' : '#f87171',
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.9rem',
          }}
        >
          <div>
            <strong>{integrityStatus.verified ? '✓ Vault Integrity Verified' : '⚠ Integrity Discrepancy Detected'}:</strong>{' '}
            {integrityStatus.message} ({integrityStatus.totalRecords} records evaluated)
          </div>
          <button
            onClick={() => setIntegrityStatus(null)}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Filters Toolbar */}
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          alignItems: 'end',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            SEARCH KEYWORD
          </label>
          <input
            id="audit-search-input"
            type="text"
            placeholder="Reason, ID, Actor or JSON..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            AUDIT ACTION
          </label>
          <select
            id="audit-action-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          >
            <option value="">All Actions</option>
            <option value="AUTH_LOGIN">AUTH_LOGIN</option>
            <option value="FINDING_STATUS_CHANGED">FINDING_STATUS_CHANGED</option>
            <option value="FINDING_COMMENT_ADDED">FINDING_COMMENT_ADDED</option>
            <option value="FINDING_ASSIGNED">FINDING_ASSIGNED</option>
            <option value="ORGANIZATION_INVITATION_CREATED">ORGANIZATION_INVITATION_CREATED</option>
            <option value="ORGANIZATION_INVITATION_ACCEPTED">ORGANIZATION_INVITATION_ACCEPTED</option>
            <option value="ORGANIZATION_MEMBER_ROLE_CHANGED">ORGANIZATION_MEMBER_ROLE_CHANGED</option>
            <option value="ORGANIZATION_MEMBER_REMOVED">ORGANIZATION_MEMBER_REMOVED</option>
            <option value="ORGANIZATION_OWNERSHIP_TRANSFERRED">ORGANIZATION_OWNERSHIP_TRANSFERRED</option>
            <option value="AUDIT_VAULT_EXPORTED">AUDIT_VAULT_EXPORTED</option>
            <option value="API_KEY_CREATED">API_KEY_CREATED</option>
            <option value="WEBHOOK_CREATED">WEBHOOK_CREATED</option>
            <option value="CI_GATE_EVALUATED">CI_GATE_EVALUATED</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            START DATE
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem', fontWeight: 600 }}>
            END DATE
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={fetchVaultLogs}
            style={{
              flex: 1,
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Filter
          </button>
          <button
            onClick={handleResetFilters}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '0.6rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
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
          <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            Showing {entries.length} of {total} Records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Page Size:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setOffset(0);
              }}
              style={{
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.2rem 0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading audit vault records...
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No audit records match the selected filter criteria.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Timestamp (UTC)</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actor</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resource</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Reason / Notes</th>
                  <th style={{ padding: '0.85rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {new Date(entry.createdAt).toISOString().replace('T', ' ').slice(0, 19)}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor:
                            entry.action.includes('INVITATION') || entry.action.includes('ROLE')
                              ? 'rgba(168, 85, 247, 0.15)'
                              : entry.action.includes('COMMENT') || entry.action.includes('ASSIGN')
                              ? 'rgba(59, 130, 246, 0.15)'
                              : 'rgba(255, 255, 255, 0.08)',
                          color:
                            entry.action.includes('INVITATION') || entry.action.includes('ROLE')
                              ? '#c084fc'
                              : entry.action.includes('COMMENT') || entry.action.includes('ASSIGN')
                              ? '#60a5fa'
                              : 'var(--text-primary)',
                        }}
                      >
                        {entry.action}
                      </span>
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {entry.actorEmail || 'Automated System'}
                      </div>
                      {entry.ipAddress && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          IP: {entry.ipAddress}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem' }}>
                      <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{entry.resourceType}</div>
                      {entry.resourceId && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {entry.resourceId.slice(0, 8)}...
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {entry.reason || '—'}
                      </div>
                    </td>

                    <td style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>
                      <button
                        onClick={() => setSelectedEntry(entry)}
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-secondary)',
                          border: '1px solid var(--border-subtle)',
                          padding: '0.3rem 0.65rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: offset === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              cursor: offset === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Previous
          </button>

          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {Math.min(offset + 1, total)} - {Math.min(offset + limit, total)} of {total}
          </span>

          <button
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: offset + limit >= total ? 'var(--text-muted)' : 'var(--text-primary)',
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              cursor: offset + limit >= total ? 'not-allowed' : 'pointer',
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Metadata Inspector Modal */}
      {selectedEntry && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.75)',
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
              maxWidth: '650px',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Audit Event Details
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {selectedEntry.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Action: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedEntry.action}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Timestamp: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedEntry.createdAt}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Actor: </span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedEntry.actorEmail || 'System'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>IP: </span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{selectedEntry.ipAddress || '—'}</span>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                SCRUBBED METADATA (JSON)
              </label>
              <pre
                style={{
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '1rem',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  color: '#34d399',
                  overflowX: 'auto',
                  maxHeight: '260px',
                }}
              >
                {JSON.stringify(selectedEntry.metadata, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedEntry(null)}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.55rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
