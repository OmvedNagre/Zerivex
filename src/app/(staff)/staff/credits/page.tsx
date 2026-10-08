'use client';

import Link from 'next/link';
import { ArrowLeft, Coins } from 'lucide-react';

export default function StaffCreditsComingSoonPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '700px' }}>
      <Link
        href="/staff"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#AB6CFE', fontSize: '13px', textDecoration: 'none' }}
      >
        <ArrowLeft size={14} /> Back to Overview
      </Link>

      <div className="staff-card" style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(171, 108, 254, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Coins size={24} color="#AB6CFE" />
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#FFFFFF', margin: '0 0 8px' }}>
          Platform Credit Ledger
        </h1>
        <p style={{ color: 'var(--staff-text-secondary)', fontSize: '13.5px', margin: '0 0 20px', lineHeight: 1.5 }}>
          Platform credit ledger, usage metering, and operator grant tools are coming soon in an upcoming release once the double-entry accounting ledger is deployed.
        </p>
        <span className="staff-pill staff-pill-muted">
          Coming soon
        </span>
      </div>
    </div>
  );
}
