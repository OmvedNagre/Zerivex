'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Building2, AlertTriangle, Loader2 } from 'lucide-react';

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  isInternal: boolean;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  targets: Array<{
    id: string;
    hostname: string;
    verifiedAt: string | null;
    verificationMethod: string | null;
  }>;
  recentScans: Array<{
    id: string;
    status: string;
    score: number | null;
    scanMode: string;
    createdAt: string;
  }>;
}

export default function StaffOrgDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function loadOrg() {
      try {
        setLoading(true);
        const res = await fetch(`/api/staff/orgs/${id}`);
        if (!res.ok) {
          setError('Failed to load organization details or permission denied');
          return;
        }
        const data = await res.json();
        if (data.success && data.data?.organization) {
          setOrg(data.data.organization);
        } else {
          setError(data.error || 'Organization not found');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching organization');
      } finally {
        setLoading(false);
      }
    }

    loadOrg();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '12px' }}>
        <Loader2 size={24} className="animate-spin" color="#AB6CFE" />
        <span style={{ color: 'var(--staff-text-secondary)', fontSize: '14px' }}>Loading organization telemetry...</span>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
        <Link href="/staff/orgs" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#AB6CFE', fontSize: '13px', textDecoration: 'none' }}>
          <ArrowLeft size={14} /> Back to Organizations
        </Link>
        <div className="staff-card" style={{ padding: '24px', borderColor: 'var(--staff-danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="var(--staff-danger)" />
            <h2 style={{ fontSize: '16px', color: '#FFFFFF', margin: 0 }}>Error Loading Organization</h2>
          </div>
          <p style={{ color: 'var(--staff-text-secondary)', fontSize: '13.5px', marginTop: '12px' }}>
            {error || 'Organization could not be loaded.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link
          href="/staff/orgs"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#AB6CFE', fontSize: '13px', textDecoration: 'none' }}
        >
          <ArrowLeft size={14} /> Back to Organizations
        </Link>
        {org.isInternal && (
          <span className="staff-pill staff-pill-internal">
            Internal Platform Workspace
          </span>
        )}
      </div>

      <div className="staff-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Building2 size={20} color="#AB6CFE" />
              <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>{org.name}</h1>
            </div>
            <p style={{ color: 'var(--staff-text-muted)', fontSize: '13px', margin: '6px 0 0' }}>
              Slug: <code>{org.slug}</code> • ID: <code>{org.id}</code>
            </p>
          </div>

          <div>
            {org.suspendedAt ? (
              <span className="staff-pill staff-pill-suspended">SUSPENDED</span>
            ) : (
              <span className="staff-pill staff-pill-active">ACTIVE</span>
            )}
          </div>
        </div>

        {org.suspendedAt && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--staff-danger)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--staff-danger)' }}>Suspension Notice</div>
            <div style={{ fontSize: '12px', color: '#E9EAF0', marginTop: '4px' }}>
              Reason: {org.suspendedReason || 'No reason specified'}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '24px' }}>
          <div style={{ padding: '16px', background: '#0E1015', borderRadius: '6px', border: '1px solid var(--staff-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--staff-text-muted)' }}>Created Date</span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginTop: '4px' }}>
              {new Date(org.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div style={{ padding: '16px', background: '#0E1015', borderRadius: '6px', border: '1px solid var(--staff-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--staff-text-muted)' }}>Verified Targets</span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginTop: '4px' }}>
              {org.targets?.length || 0}
            </div>
          </div>
          <div style={{ padding: '16px', background: '#0E1015', borderRadius: '6px', border: '1px solid var(--staff-border)' }}>
            <span style={{ fontSize: '12px', color: 'var(--staff-text-muted)' }}>Recent Scans Recorded</span>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF', marginTop: '4px' }}>
              {org.recentScans?.length || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Verified Targets (Data Minimized: Hostnames Only) */}
      <div className="staff-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 16px' }}>
          Registered Perimeter Targets (Data Minimized)
        </h2>
        {(!org.targets || org.targets.length === 0) ? (
          <p style={{ fontSize: '13px', color: 'var(--staff-text-muted)', margin: 0 }}>No targets registered for this organization.</p>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Hostname</th>
                <th>Status</th>
                <th>Verified At</th>
              </tr>
            </thead>
            <tbody>
              {org.targets.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{t.hostname}</td>
                  <td>
                    {t.verifiedAt ? (
                      <span className="staff-pill staff-pill-active">VERIFIED</span>
                    ) : (
                      <span className="staff-pill staff-pill-muted">UNVERIFIED</span>
                    )}
                  </td>
                  <td>{t.verifiedAt ? new Date(t.verifiedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
