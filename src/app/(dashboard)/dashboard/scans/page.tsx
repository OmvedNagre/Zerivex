'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScanJobRecord } from '@/core/scanner/scan-runner';
import { Target } from '@/core/targets/target-service';
import { ScanMode } from '@/core/scanner/checks/types';
import { ScansExecutionTable } from '@/components/dashboard/ScansExecutionTable';
import { LaunchScanModal } from '@/components/dashboard/LaunchScanModal';

export default function ScansPage() {
  const [scans, setScans] = useState<ScanJobRecord[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New scan modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('PUBLIC_PASSIVE');
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const [scansRes, targetsRes] = await Promise.all([
        fetch('/api/scans'),
        fetch('/api/targets'),
      ]);

      const scansData = await scansRes.json();
      const targetsData = await targetsRes.json();

      if (!scansRes.ok) throw new Error(scansData.error || 'Failed to fetch scans');
      if (!targetsRes.ok) throw new Error(targetsData.error || 'Failed to fetch targets');

      setScans(scansData.data.scans || []);
      setTargets(targetsData.data.targets || []);
      if (targetsData.data.targets?.length > 0) {
        setSelectedTargetId((prev) => prev || targetsData.data.targets[0].id);
      }
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Automated background polling when active scans exist (RUNNING or QUEUED)
  useEffect(() => {
    const hasActiveScans = scans.some((s) => s.status === 'RUNNING' || s.status === 'QUEUED');
    if (!hasActiveScans) return;

    const interval = setInterval(() => {
      fetchData(false);
    }, 3500);

    return () => clearInterval(interval);
  }, [scans, fetchData]);

  const handleLaunchScan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLaunchError(null);
    setLaunching(true);

    try {
      const res = await fetch('/api/scans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selectedTargetId,
          scanMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to launch scan');
      }

      setIsModalOpen(false);
      await fetchData(false);
    } catch (err) {
      setLaunchError((err as Error).message);
    } finally {
      setLaunching(false);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="pulse-indicator" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
              Deterministic Engine
            </span>
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.35rem' }}>
            Security Assessment Scans
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', maxWidth: '650px' }}>
            Evidence-based vulnerability scanning engine for modern web endpoints, analyzing headers, TLS ciphers, leaked tokens, and cloud misconfigurations.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-cyber-primary"
          style={{ height: '42px' }}
        >
          <span>+</span> Launch New Scan
        </button>
      </div>

      {/* Component 7: ScansExecutionTable & ScoreBadges */}
      <ScansExecutionTable
        scans={scans}
        loading={loading}
        error={error}
        onRefresh={() => fetchData(false)}
        isRefreshing={isRefreshing}
        onLaunchNewScan={() => setIsModalOpen(true)}
      />

      {/* Component 8: LaunchScanModal & ModeSelector */}
      <LaunchScanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        targets={targets}
        selectedTargetId={selectedTargetId}
        onSelectTargetId={setSelectedTargetId}
        scanMode={scanMode}
        onSelectScanMode={setScanMode}
        onLaunchScan={handleLaunchScan}
        launching={launching}
        launchError={launchError}
      />
    </div>
  );
}
