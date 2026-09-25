'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

interface AgencyClient {
  id: string;
  agencyOrganizationId: string;
  clientOrganizationId: string;
  clientName: string;
  accountManagerUserId: string | null;
  accountManagerName?: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  targetCount: number;
  scanCount: number;
  latestSecurityScore: number | null;
  criticalFindingsCount: number;
  highFindingsCount: number;
}

interface PortfolioSummary {
  agencyOrganizationId: string;
  agencyName: string;
  isAgency: boolean;
  totalClients: number;
  totalTargets: number;
  totalScans: number;
  meanSecurityScore: number;
  totalCriticalFindings: number;
  totalHighFindings: number;
  clients: AgencyClient[];
  branding: AgencyBranding | null;
}

interface AgencyBranding {
  id?: string;
  organizationId?: string;
  companyName: string;
  logoUrl: string | null;
  primaryColor: string;
  reportFooterText: string | null;
  supportEmail: string | null;
}

export default function AgencyHubPage() {
  useAuth();
  const [activeTab, setActiveTab] = useState<'portfolio' | 'branding'>('portfolio');

  // Portfolio state
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Client Modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientSlug, setNewClientSlug] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creatingClient, setCreatingClient] = useState(false);

  // Grant Access Modal
  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<AgencyClient | null>(null);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRole, setGrantRole] = useState<'CLIENT_VIEWER' | 'CLIENT_MANAGER'>('CLIENT_VIEWER');
  const [grantingAccess, setGrantingAccess] = useState(false);

  // Branding state
  const [branding, setBranding] = useState<AgencyBranding>({
    companyName: '',
    logoUrl: '',
    primaryColor: '#3b82f6',
    reportFooterText: '',
    supportEmail: '',
  });
  const [savingBranding, setSavingBranding] = useState(false);

  useEffect(() => {
    fetchPortfolio();
    fetchBranding();
  }, []);

  async function fetchPortfolio() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/agency/portfolio');
      const data = await res.json();
      if (res.ok && data.success) {
        setPortfolio(data.data.portfolio);
      } else {
        setError(data.error || 'Failed to fetch agency portfolio');
      }
    } catch (err: any) {
      setError(err?.message || 'Error communicating with agency API');
    } finally {
      setLoading(false);
    }
  }

  async function fetchBranding() {
    try {
      const res = await fetch('/api/agency/branding');
      const data = await res.json();
      if (res.ok && data.success && data.data.branding) {
        setBranding({
          companyName: data.data.branding.companyName || '',
          logoUrl: data.data.branding.logoUrl || '',
          primaryColor: data.data.branding.primaryColor || '#3b82f6',
          reportFooterText: data.data.branding.reportFooterText || '',
          supportEmail: data.data.branding.supportEmail || '',
        });
      }
    } catch {
      // Non-fatal, use empty defaults
    }
  }

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;

    setCreatingClient(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/agency/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: newClientName.trim(),
          clientSlug: newClientSlug.trim() || undefined,
          contactEmail: newContactEmail.trim() || undefined,
          notes: newNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Successfully provisioned managed client workspace "${newClientName}"`);
        setIsClientModalOpen(false);
        setNewClientName('');
        setNewClientSlug('');
        setNewContactEmail('');
        setNewNotes('');
        await fetchPortfolio();
      } else {
        setError(data.error || 'Failed to provision client');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to agency server');
    } finally {
      setCreatingClient(false);
    }
  }

  async function handleGrantAccess(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient || !grantEmail.trim()) return;

    setGrantingAccess(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/agency/clients/${selectedClient.id}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: grantEmail.trim(),
          role: grantRole,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(
          `Granted ${grantRole} access for ${grantEmail} on client workspace "${selectedClient.clientName}"`
        );
        setIsGrantModalOpen(false);
        setGrantEmail('');
      } else {
        setError(data.error || 'Failed to grant stakeholder access');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to communicate with access grant API');
    } finally {
      setGrantingAccess(false);
    }
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!branding.companyName.trim()) {
      setError('Company/Agency Name is required for white-label reports');
      return;
    }

    setSavingBranding(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/agency/branding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branding),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('White-label branding tokens saved! Executive reports will reflect this branding.');
      } else {
        setError(data.error || 'Failed to update branding tokens');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating branding');
    } finally {
      setSavingBranding(false);
    }
  }

  return (
    <div className="container" style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Agency Hub
            </h1>
            <span
              style={{
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Enterprise Multi-Tenant
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Unified portfolio defense cockpit, multi-client workspace provisioning, and custom white-label reports.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setIsClientModalOpen(true)}
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'opacity 0.2s',
            }}
          >
            <span>+</span> Provision Client Workspace
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.75rem',
        }}
      >
        <button
          onClick={() => setActiveTab('portfolio')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            color: activeTab === 'portfolio' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderBottom: activeTab === 'portfolio' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        >
          Client Portfolio & Attack Surface
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.75rem 0.5rem',
            color: activeTab === 'branding' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: 600,
            fontSize: '0.95rem',
            borderBottom: activeTab === 'branding' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        >
          White-Label Custom Branding
        </button>
      </div>

      {/* Notification Banners */}
      {error && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#ef4444',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {successMsg && (
        <div
          style={{
            padding: '0.85rem 1rem',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#10b981',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{successMsg}</span>
          <button
            onClick={() => setSuccessMsg(null)}
            style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* TAB 1: PORTFOLIO */}
      {activeTab === 'portfolio' && (
        <>
          {/* Portfolio Metric KPI Cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Managed Clients
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                {portfolio?.totalClients ?? 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#10b981', marginTop: '0.2rem' }}>
                {portfolio?.clients.filter((c) => c.status === 'ACTIVE').length ?? 0} active organizations
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Portfolio Mean Score
              </div>
              <div
                style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  marginTop: '0.4rem',
                  color:
                    portfolio?.meanSecurityScore === null || portfolio?.meanSecurityScore === undefined
                      ? 'var(--text-secondary)'
                      : portfolio.meanSecurityScore >= 85
                      ? '#10b981'
                      : portfolio.meanSecurityScore >= 70
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              >
                {portfolio?.meanSecurityScore !== null && portfolio?.meanSecurityScore !== undefined
                  ? `${portfolio.meanSecurityScore}/100`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Mean across audited targets
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Monitored Perimeter Targets
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.4rem' }}>
                {portfolio?.totalTargets ?? 0}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Active web & API perimeters
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
              }}
            >
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                Aggregated Critical / High
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444', marginTop: '0.4rem' }}>
                {portfolio?.totalCriticalFindings ?? 0}
                <span style={{ fontSize: '1.2rem', color: '#f97316', marginLeft: '0.5rem' }}>
                  / {portfolio?.totalHighFindings ?? 0} High
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Open vulnerabilities requiring action
              </div>
            </div>
          </div>

          {/* Managed Clients Table */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Managed Client Accounts ({portfolio?.clients?.length ?? 0})
              </h3>
              <button
                onClick={fetchPortfolio}
                style={{
                  background: 'none',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  color: 'var(--text-secondary)',
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Loading agency portfolio data...
              </div>
            ) : !portfolio?.clients || portfolio.clients.length === 0 ? (
              <div style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏢</div>
                <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
                  No Managed Clients Yet
                </h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto 1.5rem' }}>
                  Provision your first client workspace to start managing attack surfaces, running scheduled scans, and issuing white-labeled security reports.
                </p>
                <button
                  onClick={() => setIsClientModalOpen(true)}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Provision First Client
                </button>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.85rem 1.25rem' }}>Client Name</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Perimeter Targets</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Health Score</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Critical / High</th>
                      <th style={{ padding: '0.85rem 1.25rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolio.clients.map((client) => {
                      const score = client.latestSecurityScore;
                      const scoreColor =
                        score === null
                          ? 'var(--text-secondary)'
                          : score >= 85
                          ? '#10b981'
                          : score >= 70
                          ? '#f59e0b'
                          : '#ef4444';

                      return (
                        <tr
                          key={client.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background-color 0.15s',
                          }}
                        >
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{client.clientName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              Org ID: {client.clientOrganizationId.substring(0, 8)}...
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor:
                                  client.status === 'ACTIVE'
                                    ? 'rgba(16, 185, 129, 0.15)'
                                    : 'rgba(239, 68, 68, 0.15)',
                                color: client.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                              }}
                            >
                              {client.status}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {client.targetCount} targets
                          </td>
                          <td style={{ padding: '1rem 1rem' }}>
                            <span style={{ fontWeight: 700, color: scoreColor }}>
                              {score !== null ? `${score}/100` : 'Pending'}
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1rem' }}>
                            <span style={{ color: client.criticalFindingsCount > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: 600 }}>
                              {client.criticalFindingsCount} Critical
                            </span>
                            <span style={{ color: 'var(--text-secondary)', margin: '0 0.3rem' }}>/</span>
                            <span style={{ color: client.highFindingsCount > 0 ? '#f97316' : 'var(--text-secondary)', fontWeight: 600 }}>
                              {client.highFindingsCount} High
                            </span>
                          </td>
                          <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setSelectedClient(client);
                                setIsGrantModalOpen(true);
                              }}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                color: '#60a5fa',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                              }}
                            >
                              + Grant Stakeholder Access
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TAB 2: WHITE-LABEL BRANDING */}
      {activeTab === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '2rem' }}>
          {/* Settings Form */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.75rem',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              White-Label Custom Brand Settings
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              These brand assets and disclaimer texts will appear across all executive HTML and PDF reports generated for your managed client organizations.
            </p>

            <form onSubmit={handleSaveBranding}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Agency / Company Name *
                </label>
                <input
                  type="text"
                  value={branding.companyName}
                  onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
                  placeholder="e.g. Apex Cyber Defense"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Brand Logo URL
                </label>
                <input
                  type="url"
                  value={branding.logoUrl || ''}
                  onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                  placeholder="https://cdn.example.com/logo.png"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Primary Brand Accent Color
                </label>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={branding.primaryColor || '#3b82f6'}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    style={{
                      width: '42px',
                      height: '38px',
                      padding: '2px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      background: 'none',
                    }}
                  />
                  <input
                    type="text"
                    value={branding.primaryColor}
                    onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                    placeholder="#3b82f6"
                    style={{
                      flex: 1,
                      padding: '0.65rem 0.85rem',
                      backgroundColor: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                      fontSize: '0.9rem',
                      fontFamily: 'monospace',
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Support / Advisory Email
                </label>
                <input
                  type="email"
                  value={branding.supportEmail || ''}
                  onChange={(e) => setBranding({ ...branding, supportEmail: e.target.value })}
                  placeholder="security-advisory@agency.com"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  Executive Report Footer Disclaimer
                </label>
                <textarea
                  value={branding.reportFooterText || ''}
                  onChange={(e) => setBranding({ ...branding, reportFooterText: e.target.value })}
                  placeholder="CONFIDENTIAL ASSESSMENT: Prepared by Apex Cyber Defense exclusively for client internal risk mitigation."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={savingBranding}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: savingBranding ? 'not-allowed' : 'pointer',
                  opacity: savingBranding ? 0.7 : 1,
                  width: '100%',
                }}
              >
                {savingBranding ? 'Saving White-Label Tokens...' : 'Save Branding Configuration'}
              </button>
            </form>
          </div>

          {/* Live Preview Card */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Executive Report Header Preview
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>LIVE PREVIEW</span>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                color: '#0f172a',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              }}
            >
              <div
                style={{
                  borderBottom: `2px solid ${branding.primaryColor || '#0f172a'}`,
                  paddingBottom: '1rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                }}
              >
                <div>
                  {branding.logoUrl ? (
                    <img
                      src={branding.logoUrl}
                      alt={branding.companyName || 'Logo'}
                      style={{ maxHeight: '36px', maxWidth: '160px', objectFit: 'contain', marginBottom: '0.5rem', display: 'block' }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : null}
                  <div style={{ fontWeight: 800, fontSize: '1.25rem', color: branding.primaryColor || '#0f172a' }}>
                    {branding.companyName || 'YOUR BRAND NAME'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Security Assessment &bull; Powered by Zerivex Engine
                    {branding.supportEmail && ` &bull; Contact: ${branding.supportEmail}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                  <div><strong>Assessment Report</strong></div>
                  <div>Date: {new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                Security Audit: https://api.client-workspace.com
              </div>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#475569',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>Deterministic Defense Guarantee</div>
                All endpoints scanned deterministically with OWASP and CWE vulnerability mappings. Zero simulated findings.
              </div>

              {branding.reportFooterText && (
                <div
                  style={{
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.75rem',
                    color: '#334155',
                    fontWeight: 500,
                  }}
                >
                  {branding.reportFooterText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Provision Client */}
      {isClientModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '520px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Provision Client Organization Workspace
              </h3>
              <button
                onClick={() => setIsClientModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateClient}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Client Organization Name *
                </label>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Acme FinTech Corp"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Custom Slug (Optional)
                </label>
                <input
                  type="text"
                  value={newClientSlug}
                  onChange={(e) => setNewClientSlug(e.target.value)}
                  placeholder="e.g. acme-fintech"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Primary Contact Email (Optional)
                </label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="ciso@acme.com"
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Internal Notes (Optional)
                </label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Enterprise Tier client - quarterly penetration testing SLA."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    resize: 'vertical',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClient}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: creatingClient ? 'not-allowed' : 'pointer',
                    opacity: creatingClient ? 0.7 : 1,
                  }}
                >
                  {creatingClient ? 'Provisioning...' : 'Provision Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Grant Stakeholder Access */}
      {isGrantModalOpen && selectedClient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '480px',
              width: '100%',
              padding: '1.75rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Grant Stakeholder Access
              </h3>
              <button
                onClick={() => setIsGrantModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Client: <strong>{selectedClient.clientName}</strong>. The stakeholder will be restricted exclusively to this client workspace and will never see agency or peer data.
            </p>

            <form onSubmit={handleGrantAccess}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Stakeholder User Email *
                </label>
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  placeholder="stakeholder@clientcorp.com"
                  required
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Access Role
                </label>
                <select
                  value={grantRole}
                  onChange={(e) => setGrantRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  <option value="CLIENT_VIEWER">CLIENT_VIEWER (Read-only reports and findings)</option>
                  <option value="CLIENT_MANAGER">CLIENT_MANAGER (Launch scans and manage targets)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsGrantModalOpen(false)}
                  style={{
                    backgroundColor: 'transparent',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={grantingAccess}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.65rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 600,
                    cursor: grantingAccess ? 'not-allowed' : 'pointer',
                    opacity: grantingAccess ? 0.7 : 1,
                  }}
                >
                  {grantingAccess ? 'Granting...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
