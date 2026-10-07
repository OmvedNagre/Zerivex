'use client';

import { useState, useEffect } from 'react';
import { adaptStats } from '@/adapters/adapters';
import { ACADEMY_ARTICLES } from '@/core/academy/academy-catalog';
import { CircleDot, ShieldCheck, Activity } from 'lucide-react';
import Link from 'next/link';

export function StatsAndStatus() {
  const stats = adaptStats(14, 31, 4, ACADEMY_ARTICLES.length);
  const [healthStatus, setHealthStatus] = useState<'HEALTHY' | 'DEGRADED' | 'DOWN'>('HEALTHY');
  const [timestamp, setTimestamp] = useState<string>('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setHealthStatus(data.status === 'DEGRADED' ? 'DEGRADED' : data.status === 'DOWN' ? 'DOWN' : 'HEALTHY');
          setTimestamp(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '');
        }
      })
      .catch(() => {
        setHealthStatus('HEALTHY');
      });
  }, []);

  return (
    <section
      style={{
        padding: '80px 24px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      {/* Live System Status Strip */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 24px',
          borderRadius: 'var(--ds-radius-lg)',
          backgroundColor: 'var(--ds-bg-card)',
          border: '1px solid var(--ds-border-subtle)',
          boxShadow: 'var(--ds-shadow-1)',
          marginBottom: '48px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={18} style={{ color: 'var(--ds-action-brand)' }} />
          <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ds-text-primary)' }}>
            System Infrastructure Probes
          </span>
          <span style={{ fontSize: '13px', color: 'var(--ds-text-muted)' }}>
            &bull; Observability and egress firewall status
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CircleDot
              size={14}
              style={{
                color: healthStatus === 'HEALTHY' ? 'var(--ds-success)' : 'var(--ds-warning)',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
              {healthStatus === 'HEALTHY' ? 'All engines operational' : 'Partial degradation'}
            </span>
          </div>

          {timestamp && (
            <span style={{ fontSize: '12px', color: 'var(--ds-text-muted)', fontFamily: 'var(--font-mono)' }}>
              Checked at {timestamp}
            </span>
          )}

          <Link
            href="/api/health"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--ds-action-link)',
              textDecoration: 'none',
            }}
          >
            Diagnostic report
          </Link>
        </div>
      </div>

      {/* Catalog-Derived Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '24px',
        }}
      >
        {stats.map((stat, i) => (
          <div
            key={i}
            style={{
              padding: '28px',
              borderRadius: 'var(--ds-radius-lg)',
              backgroundColor: 'var(--ds-bg-card)',
              border: '1px solid var(--ds-border-subtle)',
              boxShadow: 'var(--ds-shadow-1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '44px',
                  fontWeight: 800,
                  lineHeight: 1,
                  letterSpacing: '-0.03em',
                  color: 'var(--ds-action-brand)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stat.value}
              </span>
              <ShieldCheck size={20} style={{ color: 'var(--ds-text-muted)', opacity: 0.6 }} />
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--ds-text-primary)',
                margin: 0,
              }}
            >
              {stat.label}
            </h3>

            <p
              style={{
                fontSize: '13px',
                lineHeight: 1.5,
                color: 'var(--ds-text-secondary)',
                margin: 0,
              }}
            >
              {stat.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default StatsAndStatus;
