'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LaunchReadinessCockpit,
  LaunchReadinessData,
  SelfScanReport,
  LaunchChecklistItem,
} from '@/components/dashboard/LaunchReadinessCockpit';

export default function LaunchReadinessPage() {
  const [data, setData] = useState<LaunchReadinessData | null>(null);
  const [selfScanReport, setSelfScanReport] = useState<SelfScanReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'subsystems' | 'selfscan' | 'checklist'>('subsystems');
  const [copiedHash, setCopiedHash] = useState(false);
  const [checklistItems, setChecklistItems] = useState<LaunchChecklistItem[]>([]);

  const fetchReadiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/launch-readiness');
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Failed to load launch readiness status');
        return;
      }
      setData(json.data);
      setChecklistItems(json.data.checklist || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReadiness();
  }, [fetchReadiness]);

  const handleRunSelfScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch('/api/launch-readiness/scan', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Self-scan execution failed');
        return;
      }
      setSelfScanReport(json.data);
      setActiveTab('selfscan');
      // Refresh general readiness status
      await fetchReadiness();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const handleToggleChecklist = (id: string) => {
    setChecklistItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  const copyCertificationHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2500);
  };

  return (
    <LaunchReadinessCockpit
      data={data}
      selfScanReport={selfScanReport}
      loading={loading}
      scanning={scanning}
      error={error}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      copiedHash={copiedHash}
      checklistItems={checklistItems}
      onRefresh={fetchReadiness}
      onRunSelfScan={handleRunSelfScan}
      onToggleChecklist={handleToggleChecklist}
      onCopyHash={copyCertificationHash}
    />
  );
}
