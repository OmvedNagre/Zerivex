'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, RefreshCw } from 'lucide-react';
import { Target, VerificationMethod, VerificationScope } from '@/core/targets/target-service';
import { TargetsTable } from '@/components/dashboard/TargetsTable';
import { adaptTargetsTable, EnrichedTargetRow } from '@/adapters/dashboard-adapters';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

function TargetParamWatcher({ onPrefill }: { onPrefill: (url: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const newTarget = searchParams?.get('new');
    if (newTarget && newTarget !== 'true') {
      onPrefill(newTarget);
    } else if (newTarget === 'true') {
      onPrefill('');
    }
  }, [searchParams, onPrefill]);
  return null;
}

export default function TargetsPage() {
  const router = useRouter();
  const [enrichedRows, setEnrichedRows] = useState<EnrichedTargetRow[]>([]);
  const [rawTargets, setRawTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanningTargetId, setScanningTargetId] = useState<string | null>(null);

  // Registration Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');
  const [method, setMethod] = useState<VerificationMethod>('DNS_TXT');
  const [scope, setScope] = useState<VerificationScope>('EXACT_HOST');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [targetsRes, scansRes, findingsRes] = await Promise.allSettled([
        fetch('/api/targets').then((r) => r.json()),
        fetch('/api/scans').then((r) => r.json()),
        fetch('/api/findings').then((r) => r.json()),
      ]);

      let targetsList: any[] = [];
      let scansList: any[] = [];
      let findingsList: any[] = [];

      if (targetsRes.status === 'fulfilled' && targetsRes.value?.success) {
        targetsList = targetsRes.value.data?.targets || [];
      } else if (targetsRes.status === 'fulfilled' && targetsRes.value?.error) {
        throw new Error(targetsRes.value.error);
      }

      if (scansRes.status === 'fulfilled' && scansRes.value?.success) {
        scansList = scansRes.value.data?.scans || [];
      }

      if (findingsRes.status === 'fulfilled' && findingsRes.value?.success) {
        findingsList = findingsRes.value.data?.findings || [];
      }

      setRawTargets(targetsList);

      // Join targets with scans and findings
      const joined = adaptTargetsTable(targetsList, scansList, findingsList);
      setEnrichedRows(joined);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch targets');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePrefill = useCallback((newUrl: string) => {
    setTargetUrl(newUrl);
    setIsModalOpen(true);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRegisterTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUrl,
          verificationMethod: method,
          verificationScope: scope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setTargetUrl('');
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to register target');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTarget = async (id: string, _hostname: string) => {
    try {
      const res = await fetch(`/api/targets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete target');
      }
      await fetchData();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  const handleRunScan = async (targetId: string, isVerified: boolean) => {
    try {
      setScanningTargetId(targetId);
      setError(null);
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId,
          scanMode: isVerified ? 'VERIFIED_ACTIVE' : 'PUBLIC_PASSIVE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to launch scan');
      }
      const newScanId = data.data?.scanJob?.id;
      if (newScanId) {
        router.push(`/dashboard/scans/${newScanId}`);
      } else {
        router.push('/dashboard/scans');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to launch scan');
    } finally {
      setScanningTargetId(null);
    }
  };

  const verifiedCount = rawTargets.filter((t) => t.verificationStatus === 'VERIFIED').length;
  const pendingCount = rawTargets.filter((t) => t.verificationStatus !== 'VERIFIED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <Suspense fallback={null}>
        <TargetParamWatcher onPrefill={handlePrefill} />
      </Suspense>

      {/* Page Header (eyebrow -> H1 -> subtitle -> brand CTA) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--ds-text-muted)',
              marginBottom: '6px',
            }}
          >
            Your Sites
          </div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 800,
              color: 'var(--ds-text-primary)',
              letterSpacing: '-0.02em',
              margin: '0 0 6px',
              fontFamily: 'var(--font-display)',
            }}
          >
            Your sites
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--ds-text-secondary)',
              margin: 0,
              maxWidth: '620px',
            }}
          >
            Add your site, prove it&apos;s yours, then scan it.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button variant="secondary" onClick={fetchData} icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
          <Button
            variant="brand"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus size={16} />}
          >
            Register New Target
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Sites Added
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-text-primary)', margin: '6px 0 2px' }}>
            {rawTargets.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Configured endpoints in workspace
          </div>
        </div>

        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--ds-success)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Sites Verified
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-success)', margin: '6px 0 2px' }}>
            {verifiedCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Ownership cryptographically proven
          </div>
        </div>

        <div
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--ds-radius-lg)',
            backgroundColor: 'var(--ds-bg-card)',
            border: '1px solid var(--ds-border-subtle)',
            boxShadow: 'var(--ds-shadow-1)',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--ds-warning)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Pending Verification
          </div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--ds-warning)', margin: '6px 0 2px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--ds-text-secondary)' }}>
            Awaiting DNS or header challenge
          </div>
        </div>
      </div>

      {/* Enriched Targets Table */}
      <TargetsTable
        rows={enrichedRows}
        loading={loading}
        error={error}
        scanningTargetId={scanningTargetId}
        onRunScan={handleRunScan}
        onDeleteTarget={handleDeleteTarget}
        onOpenRegisterModal={() => setIsModalOpen(true)}
        onRetry={fetchData}
      />

      {/* Target Registration Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!submitting) {
            setIsModalOpen(false);
            setFormError(null);
          }
        }}
        title="Register Target Site"
      >
        <form onSubmit={handleRegisterTarget} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {formError && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--ds-radius-sm)',
                backgroundColor: 'var(--ds-danger-bg)',
                color: 'var(--ds-danger)',
                fontSize: '12.5px',
              }}
            >
              {formError}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
              Target URL or Hostname
            </label>
            <input
              type="text"
              required
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid var(--ds-border-default)',
                backgroundColor: 'var(--ds-bg-card)',
                color: 'var(--ds-text-primary)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
              Verification Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as VerificationMethod)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid var(--ds-border-default)',
                backgroundColor: 'var(--ds-bg-card)',
                color: 'var(--ds-text-primary)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            >
              <option value="DNS_TXT">DNS TXT Record (Recommended for apex/subdomains)</option>
              <option value="HTTP_HEADER">HTTP Custom Header (X-Zerivex-Verify)</option>
              <option value="HTML_META">HTML Meta Tag (zerivex-verification)</option>
              <option value="FILE_UPLOAD">Well-Known File (/.well-known/zerivex.txt)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
              Verification Scope
            </label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as VerificationScope)}
              style={{
                padding: '10px 14px',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid var(--ds-border-default)',
                backgroundColor: 'var(--ds-bg-card)',
                color: 'var(--ds-text-primary)',
                fontSize: '13.5px',
                outline: 'none',
              }}
            >
              <option value="EXACT_HOST">Exact Host Only (e.g., api.example.com)</option>
              <option value="DOMAIN">Apex Domain &amp; Subdomains (*.example.com)</option>
              <option value="URL_PATH">URL Path Prefix</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <Button
              variant="secondary"
              type="button"
              disabled={submitting}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="brand" type="submit" disabled={submitting}>
              {submitting ? 'Registering...' : 'Register site'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
