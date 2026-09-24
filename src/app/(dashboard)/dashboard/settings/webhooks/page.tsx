'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { WebhookRecord, WebhookDeliveryRecord } from '@/core/webhooks/webhook-repository';

export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([
    'scan.completed',
    'scan.failed',
    'gate.failed',
    'finding.critical',
  ]);
  const [submitting, setSubmitting] = useState(false);

  // Inspector / Delivery state
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookRecord | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryRecord[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch webhooks');
      setWebhooks(data.data.webhooks || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const fetchDeliveries = async (webhook: WebhookRecord) => {
    setSelectedWebhook(webhook);
    try {
      setLoadingDeliveries(true);
      const res = await fetch(`/api/webhooks/${webhook.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch deliveries');
      setDeliveries(data.data.deliveries || []);
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), events }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create webhook');
      setShowCreateModal(false);
      setName('');
      setUrl('');
      fetchWebhooks();
    } catch (err) {
      alert(`Error creating webhook: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestPing = async (id: string) => {
    try {
      setTestingId(id);
      setTestResult(null);
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Test ping failed');
      const r = data.data;
      if (r.success) {
        setTestResult(`✅ Ping succeeded (HTTP ${r.statusCode}, ${r.responseTimeMs}ms)`);
      } else {
        setTestResult(`❌ Ping failed (HTTP ${r.statusCode || 'N/A'}: ${r.errorMessage})`);
      }
      fetchWebhooks();
      if (selectedWebhook?.id === id) {
        fetchDeliveries(selectedWebhook);
      }
    } catch (err) {
      setTestResult(`❌ Ping failed: ${(err as Error).message}`);
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: string, webhookName: string) => {
    if (!confirm(`Are you sure you want to delete webhook "${webhookName}"?`)) return;
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete webhook');
      if (selectedWebhook?.id === id) setSelectedWebhook(null);
      fetchWebhooks();
    } catch (err) {
      alert(`Error: ${(err as Error).message}`);
    }
  };

  const toggleEvent = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link
              href="/dashboard/targets"
              style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}
            >
              ← Dashboard
            </Link>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Developer Settings</span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            Outbound Webhooks
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem', maxWidth: '680px' }}>
            Subscribe external systems, Slack bots, and internal SOAR endpoints to real-time security events. All payloads are signed with HMAC-SHA256 and protected against SSRF.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: 'var(--primary)',
            color: '#fff',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            fontWeight: 600,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <span>+</span> Register Webhook
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        <Link
          href="/dashboard/settings/api-keys"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          🔑 API Keys
        </Link>
        <Link
          href="/dashboard/settings/webhooks"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            fontWeight: 600,
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          ⚡ Outbound Webhooks
        </Link>
      </div>

      {testResult && (
        <div style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)', fontSize: '0.85rem', fontWeight: 600 }}>
          {testResult}
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* Webhooks Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--card-bg)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Registered Webhook Endpoints</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Endpoints listening for security scan completions, regressions, and quality gate failures.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {webhooks.length} {webhooks.length === 1 ? 'Endpoint' : 'Endpoints'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading webhooks...
          </div>
        ) : webhooks.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0 0 1rem 0' }}>No webhook endpoints configured.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Register your first webhook
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Endpoint URL</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Subscribed Events</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Last Status</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((wh) => (
                  <tr key={wh.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {wh.name}
                    </td>
                    <td style={{ padding: '0.9rem 1.25rem', fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wh.url}
                    </td>
                    <td style={{ padding: '0.9rem 1.25rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {wh.events.map((e) => (
                          <span
                            key={e}
                            style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border)',
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                            }}
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.9rem 1.25rem' }}>
                      {wh.lastStatusCode ? (
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: wh.lastStatusCode >= 200 && wh.lastStatusCode < 300 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: wh.lastStatusCode >= 200 && wh.lastStatusCode < 300 ? '#10b981' : 'var(--danger)',
                          }}
                        >
                          HTTP {wh.lastStatusCode}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                        <button
                          onClick={() => fetchDeliveries(wh)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Logs
                        </button>
                        <button
                          onClick={() => handleTestPing(wh.id)}
                          disabled={testingId === wh.id}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {testingId === wh.id ? 'Testing...' : 'Test Ping'}
                        </button>
                        <button
                          onClick={() => handleDelete(wh.id, wh.name)}
                          style={{
                            padding: '0.35rem 0.65rem',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deliveries Drawer / Inspector */}
      {selectedWebhook && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--card-bg)', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Delivery Log: {selectedWebhook.name}
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Target URL: <code style={{ color: 'var(--primary)' }}>{selectedWebhook.url}</code>
              </p>
            </div>
            <button
              onClick={() => setSelectedWebhook(null)}
              style={{
                padding: '0.35rem 0.75rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Close
            </button>
          </div>

          {loadingDeliveries ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading delivery logs...
            </div>
          ) : deliveries.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No deliveries logged for this webhook yet. Click &quot;Test Ping&quot; to test your endpoint.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deliveries.map((del) => (
                <div
                  key={del.id}
                  style={{
                    padding: '0.85rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          padding: '0.15rem 0.4rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: del.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: del.success ? '#10b981' : 'var(--danger)',
                        }}
                      >
                        {del.statusCode ? `HTTP ${del.statusCode}` : 'FAILED'}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{del.eventType}</span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>{del.responseTimeMs}ms</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(del.deliveredAt).toLocaleString()}
                    </span>
                  </div>

                  {del.errorMessage && (
                    <div style={{ color: 'var(--danger)', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      {del.errorMessage}
                    </div>
                  )}

                  <details style={{ marginTop: '0.25rem' }}>
                    <summary style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      Inspect Payload
                    </summary>
                    <pre
                      style={{
                        margin: '0.5rem 0 0 0',
                        padding: '0.5rem',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.75rem',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(del.payload, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Webhook */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '540px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Register Outbound Webhook</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
              Send real-time JSON payloads to your application when events occur. Payloads include an HMAC-SHA256 signature in the <code style={{ fontSize: '0.8rem' }}>X-Zerivex-Signature-256</code> header.
            </p>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Webhook Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production Slack Alert Bot"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Target HTTPS Endpoint URL
                </label>
                <input
                  type="url"
                  placeholder="https://api.yourdomain.com/webhooks/zerivex"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.2rem', display: 'block' }}>
                  SSRF Protection: Requests to private IP spaces, cloud metadata (169.254.169.254), or loopback will be automatically rejected.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Subscribed Event Triggers
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)' }}>
                  {[
                    { id: 'scan.completed', label: 'scan.completed (When a security assessment finishes)' },
                    { id: 'scan.failed', label: 'scan.failed (When a scanner run fails or aborts)' },
                    { id: 'gate.failed', label: 'gate.failed (When a CI/CD Quality Gate fails)' },
                    { id: 'finding.critical', label: 'finding.critical (When new Critical/High issues are detected)' },
                    { id: 'monitoring.regression', label: 'monitoring.regression (Score drop or vulnerability regressions)' },
                  ].map((ev) => (
                    <label key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={events.includes(ev.id)}
                        onChange={() => toggleEvent(ev.id)}
                      />
                      <span>{ev.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.6rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim() || !url.trim()}
                  style={{
                    padding: '0.6rem 1.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  {submitting ? 'Registering...' : 'Register Webhook'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
