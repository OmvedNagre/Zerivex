'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ApiKeyRecord } from '@/core/auth/api-key-service';

export default function ApiKeysSettingsPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Creation modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['scans:create', 'scans:read', 'targets:read', 'ci:execute']);
  const [expiresInDays, setExpiresInDays] = useState<number>(90);
  const [submitting, setSubmitting] = useState(false);

  // Single-reveal modal state
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/api-keys');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch API keys');
      setApiKeys(data.data.apiKeys || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes,
          expiresInDays: expiresInDays > 0 ? expiresInDays : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create API key');

      // Store raw key for single-reveal modal
      setCreatedRawKey(data.data.rawKey);
      setShowCreateModal(false);
      setName('');
      fetchApiKeys();
    } catch (err) {
      alert(`Error creating API key: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string, keyName: string) => {
    if (!confirm(`Are you sure you want to revoke API key "${keyName}"? Any automated pipeline using it will immediately fail.`)) {
      return;
    }

    try {
      setRevokingId(id);
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke API key');
      fetchApiKeys();
    } catch (err) {
      alert(`Error revoking API key: ${(err as Error).message}`);
    } finally {
      setRevokingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
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
            API Keys & Automation Tokens
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem', maxWidth: '680px' }}>
            Generate scoped machine-to-machine authentication tokens for GitHub Actions, GitLab CI/CD, and CLI scripts. Keys are hashed with SHA-256 and never stored in plaintext.
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
          <span>+</span> Generate New API Key
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
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
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
            color: 'var(--text-secondary)',
            textDecoration: 'none',
          }}
        >
          ⚡ Outbound Webhooks
        </Link>
      </div>

      {error && (
        <div style={{ padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {/* API Keys Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--card-bg)', overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Active API Keys</h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Authentication tokens granted to your organization for pipeline execution.
            </p>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600 }}>
            {apiKeys.length} {apiKeys.length === 1 ? 'Token' : 'Tokens'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading API keys...
          </div>
        ) : apiKeys.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0 0 1rem 0' }}>No API keys created yet.</p>
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
              Generate your first API key
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Key Prefix</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Granted Scopes</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Last Used</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Expires</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '0.75rem 1.25rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => {
                  const isRevoked = key.status === 'REVOKED';
                  return (
                    <tr
                      key={key.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        opacity: isRevoked ? 0.6 : 1,
                        backgroundColor: isRevoked ? 'rgba(0,0,0,0.02)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.9rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {key.name}
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {key.keyPrefix}••••••••
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {key.scopes.map((s) => (
                            <span
                              key={s}
                              style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem', color: 'var(--text-secondary)' }}>
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem', color: 'var(--text-secondary)' }}>
                        {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: isRevoked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                            color: isRevoked ? 'var(--danger)' : '#10b981',
                          }}
                        >
                          {key.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.9rem 1.25rem', textAlign: 'right' }}>
                        {!isRevoked && (
                          <button
                            onClick={() => handleRevoke(key.id, key.name)}
                            disabled={revokingId === key.id}
                            style={{
                              padding: '0.35rem 0.75rem',
                              backgroundColor: 'transparent',
                              border: '1px solid var(--danger)',
                              color: 'var(--danger)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {revokingId === key.id ? 'Revoking...' : 'Revoke'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Generate Key */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '520px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', fontWeight: 600 }}>Generate API Key</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.25rem 0' }}>
              Create a machine-to-machine token for CI/CD pipelines. You will only be shown this key once.
            </p>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Key Name / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. GitHub Actions Production Scan"
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
                  Granted Capabilities (Scopes)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', backgroundColor: 'var(--bg-secondary)' }}>
                  {[
                    { id: 'scans:create', label: 'scans:create (Trigger security scans)' },
                    { id: 'scans:read', label: 'scans:read (Inspect scan status & scores)' },
                    { id: 'targets:read', label: 'targets:read (List targets & metadata)' },
                    { id: 'reports:read', label: 'reports:read (Export SARIF & PDF reports)' },
                    { id: 'ci:execute', label: 'ci:execute (Execute Quality Gate pipeline checks)' },
                  ].map((s) => (
                    <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={scopes.includes(s.id)}
                        onChange={() => toggleScope(s.id)}
                      />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Expiration
                </label>
                <select
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days (Recommended)</option>
                  <option value={180}>180 Days</option>
                  <option value={365}>1 Year</option>
                  <option value={0}>Never (No Expiration)</option>
                </select>
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
                  disabled={submitting || !name.trim()}
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
                  {submitting ? 'Generating...' : 'Create Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Single Reveal Display */}
      {createdRawKey && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110, padding: '1rem' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid #10b981', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '580px', padding: '1.75rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🔐</span>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                API Key Successfully Created
              </h3>
            </div>

            <div style={{ padding: '0.85rem', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', color: '#f59e0b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <strong>Important Security Notice:</strong> Make sure to copy your API key now. For your security, this key is hashed in our database and will <strong>never be shown to you again</strong>.
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <input
                type="text"
                readOnly
                value={createdRawKey}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  fontFamily: 'monospace',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }}
              />
              <button
                onClick={() => copyToClipboard(createdRawKey)}
                style={{
                  padding: '0.75rem 1.25rem',
                  backgroundColor: copied ? '#10b981' : 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  minWidth: '100px',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy Key'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setCreatedRawKey(null)}
                style={{
                  padding: '0.6rem 1.5rem',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                I have securely saved my key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
