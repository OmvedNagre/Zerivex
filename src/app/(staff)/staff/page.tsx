'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  ScanSearch,
  AlertTriangle,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

interface StaffOverviewStats {
  totalCustomerOrgs: number;
  scansLast24h: number;
  failedScans: number;
  queueDepth: number;
}

export default function StaffOverviewPage() {
  const [stats, setStats] = useState<StaffOverviewStats>({
    totalCustomerOrgs: 0,
    scansLast24h: 0,
    failedScans: 0,
    queueDepth: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [orgsRes, queueRes] = await Promise.allSettled([
        fetch('/api/staff/orgs').then((r) => r.json()),
        fetch('/api/staff/queue').then((r) => r.json()),
      ]);

      let orgCount = 0;
      let queueCount = 0;
      let failedCount = 0;

      if (orgsRes.status === 'fulfilled' && orgsRes.value?.success) {
        const orgs = orgsRes.value.data?.organizations || [];
        // Metrics hygiene: internal org excluded from customer metrics
        orgCount = orgs.filter((o: any) => !o.isInternal).length;
      }

      if (queueRes.status === 'fulfilled' && queueRes.value?.success) {
        const queue = queueRes.value.data?.queue || [];
        queueCount = queue.filter((q: any) => q.status === 'QUEUED' || q.status === 'RUNNING').length;
        failedCount = queue.filter((q: any) => q.status === 'FAILED').length;
      }

      setStats({
        totalCustomerOrgs: orgCount,
        scansLast24h: queueCount + failedCount,
        failedScans: failedCount,
        queueDepth: queueCount,
      });
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 6px' }}>
            Platform Operations Overview
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--staff-text-secondary)', margin: 0 }}>
            Fleet-wide diagnostic telemetry, organization posture, and scan orchestration health.
          </p>
        </div>
        <button
          type="button"
          onClick={loadOverview}
          className="staff-btn-secondary"
          style={{ fontSize: '12px', padding: '6px 12px' }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          <span>Sync Telemetry</span>
        </button>
      </div>

      {/* 4 Core Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="staff-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--staff-text-muted)', textTransform: 'uppercase' }}>
              Customer Orgs
            </span>
            <Building2 size={18} color="#AB6CFE" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF' }}>
            {loading ? '...' : stats.totalCustomerOrgs}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)', marginTop: '4px' }}>
            Active multi-tenant workspaces
          </div>
        </div>

        <div className="staff-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--staff-text-muted)', textTransform: 'uppercase' }}>
              Queue Depth
            </span>
            <Layers size={18} color="#38BDF8" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF' }}>
            {loading ? '...' : stats.queueDepth}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)', marginTop: '4px' }}>
            Pending and in-flight scans
          </div>
        </div>

        <div className="staff-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--staff-text-muted)', textTransform: 'uppercase' }}>
              Scan Failures
            </span>
            <AlertTriangle size={18} color={stats.failedScans > 0 ? '#EF4444' : '#10B981'} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stats.failedScans > 0 ? '#EF4444' : '#FFFFFF' }}>
            {loading ? '...' : stats.failedScans}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)', marginTop: '4px' }}>
            {stats.failedScans === 0 ? 'Zero active scan failures' : 'Requires engineering triage'}
          </div>
        </div>

        <div className="staff-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--staff-text-muted)', textTransform: 'uppercase' }}>
              Execution Activity
            </span>
            <ScanSearch size={18} color="#F59E0B" />
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF' }}>
            {loading ? '...' : stats.scansLast24h}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--staff-text-secondary)', marginTop: '4px' }}>
            Total jobs monitored in 24h
          </div>
        </div>
      </div>

      {/* Operator Navigation & Modules */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        <div className="staff-card">
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 12px' }}>
            Customer Workspaces
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--staff-text-secondary)', marginBottom: '16px' }}>
            Inspect client organization tenants, verify target coverage, and execute operational suspensions when warranted.
          </p>
          <Link href="/staff/orgs" className="staff-btn-brand">
            <span>Manage Organizations</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="staff-card">
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 12px' }}>
            Scan Orchestration
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--staff-text-secondary)', marginBottom: '16px' }}>
            Monitor worker pool execution, inspect stuck queued tasks, and debug deterministic AST probe diagnostics.
          </p>
          <Link href="/staff/queue" className="staff-btn-secondary">
            <span>Inspect Queue & Failures</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
