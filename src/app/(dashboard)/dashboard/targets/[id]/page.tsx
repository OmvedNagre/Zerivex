'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Target } from '@/core/targets/target-service';
import {
  VerificationCenter,
  ActiveVerificationMethod,
  Instructions,
} from '@/components/dashboard/VerificationCenter';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function TargetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [target, setTarget] = useState<Target | null>(null);
  const [instructions, setInstructions] = useState<Instructions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [latestScan, setLatestScan] = useState<{ id: string; score: number | null; createdAt: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  // Verification execution state
  const [selectedMethod, setSelectedMethod] = useState<ActiveVerificationMethod>('DNS_TXT');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    diagnostic: string;
  } | null>(null);

  const fetchTargetData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/targets/${id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch target details');
      }
      setTarget(data.data.target);
      setInstructions(data.data.instructions);
      if (data.data.target.verificationMethod) {
        setSelectedMethod(data.data.target.verificationMethod);
      }
      setError(null);

      // Fetch latest scan for this target
      try {
        const scansRes = await fetch(`/api/scans?targetId=${id}`);
        if (scansRes.ok) {
          const scansData = await scansRes.json();
          const scanList = scansData.data?.scans || [];
          if (scanList.length > 0) {
            setLatestScan(scanList[0]);
          }
        }
      } catch {
        // Silently ignore scan fetch error
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTargetData();
  }, [fetchTargetData]);

  const handleVerify = async (bypass: boolean = false) => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      const isBypass = bypass || selectedMethod === 'MANUAL_BYPASS';
      const payload = isBypass
        ? { bypass: true, preferredMethod: 'MANUAL_BYPASS' }
        : { preferredMethod: selectedMethod === 'HTTP_FILE' ? 'HTML_META' : selectedMethod };

      const res = await fetch(`/api/targets/${id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setVerificationResult({
        success: data.success,
        diagnostic: data.data?.diagnostic || data.error || 'Verification check finished',
      });

      if (data.success) {
        await fetchTargetData();
      }
    } catch (err) {
      setVerificationResult({
        success: false,
        diagnostic: (err as Error).message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleRunScan = async () => {
    if (!target) return;
    try {
      setScanning(true);
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: target.id,
          scanMode: target.verificationStatus === 'VERIFIED' ? 'VERIFIED_ACTIVE' : 'PUBLIC_PASSIVE',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to trigger scan');
      }
      const newScanId = data.data?.scanJob?.id;
      if (newScanId) {
        router.push(`/dashboard/scans/${newScanId}`);
      } else {
        router.push('/dashboard/scans');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div
        className="zvc-container"
        style={{
          padding: '4rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={20} className="animate-spin" aria-hidden="true" />
          <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>
            Loading cryptographic verification center...
          </span>
        </div>
      </div>
    );
  }

  if (error || !target || !instructions) {
    return (
      <div className="zvc-container" style={{ maxWidth: '640px', padding: '2rem 0' }}>
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
          <div>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Unable to load target verification</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {error || 'Target or cryptographic verification challenge not found.'}
            </div>
          </div>
        </div>
        <Link href="/dashboard/targets" className="zvc-breadcrumb" style={{ marginTop: '1.25rem' }}>
          <ArrowLeft size={14} aria-hidden="true" />
          <span>← Back to Targets</span>
        </Link>
      </div>
    );
  }

  return (
    <VerificationCenter
      target={target}
      instructions={instructions}
      latestScan={latestScan}
      selectedMethod={selectedMethod}
      setSelectedMethod={setSelectedMethod}
      verifying={verifying}
      verificationResult={verificationResult}
      onVerify={handleVerify}
      scanning={scanning}
      onRunScan={handleRunScan}
    />
  );
}
