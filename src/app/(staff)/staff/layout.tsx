'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  ScanSearch,
  ShieldAlert,
  Users,
  ScrollText,
  LogOut,
  Shield,
  Loader2,
} from 'lucide-react';
import { PortalSwitcher } from '@/components/staff/PortalSwitcher';
import '@/styles/staff.css';

interface StaffUser {
  id: string;
  email: string;
  displayName: string | null;
  role: 'STAFF_OWNER' | 'STAFF_ADMIN' | 'STAFF_SUPPORT';
}

export default function StaffConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Skip auth check if on /staff/login
  const isLoginPage = pathname === '/staff/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    async function loadStaffProfile() {
      try {
        const res = await fetch('/api/staff/me');
        if (!res.ok) {
          router.push('/staff/login');
          return;
        }
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUser(data.data.user);
        } else {
          router.push('/staff/login');
        }
      } catch {
        router.push('/staff/login');
      } finally {
        setLoading(false);
      }
    }

    loadStaffProfile();
  }, [pathname, isLoginPage, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/staff/auth/logout', { method: 'POST' });
      router.push('/staff/login');
    } catch {
      router.push('/staff/login');
    }
  };

  if (isLoginPage) {
    return <div className="staff-root">{children}</div>;
  }

  if (loading) {
    return (
      <div
        className="staff-root"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        <Loader2 size={32} className="animate-spin" color="#AB6CFE" />
        <span style={{ fontSize: '13px', color: '#9FA4B8' }}>
          Verifying privileged staff session...
        </span>
      </div>
    );
  }

  const isOwner = user?.role === 'STAFF_OWNER';

  return (
    <div className="staff-root" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 1. Permanent 28px Violet Staff Stripe */}
      <header className="staff-stripe">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={14} />
          <span>STAFF · PLATFORM OPERATOR CONSOLE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ color: '#E9EAF0', opacity: 0.9 }}>
            {user?.email}
          </span>
          <span
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.35)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            {user?.role}
          </span>
        </div>
      </header>

      {/* 2. Main Operator Shell */}
      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 28px)' }}>
        {/* Left Rail */}
        <aside className="staff-sidebar">
          {/* Top: PortalSwitcher */}
          <PortalSwitcher currentPortal="staff" />

          {/* Navigation Items */}
          <nav style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '2px' }}>
            <Link
              href="/staff"
              className={`staff-nav-item ${pathname === '/staff' ? 'active' : ''}`}
            >
              <LayoutDashboard size={16} />
              <span>Overview</span>
            </Link>

            <Link
              href="/staff/orgs"
              className={`staff-nav-item ${pathname.startsWith('/staff/orgs') ? 'active' : ''}`}
            >
              <Building2 size={16} />
              <span>Organizations</span>
            </Link>

            <Link
              href="/staff/queue"
              className={`staff-nav-item ${pathname.startsWith('/staff/queue') ? 'active' : ''}`}
            >
              <ScanSearch size={16} />
              <span>Scan Queue</span>
            </Link>

            <Link
              href="/staff/security-events"
              className={`staff-nav-item ${pathname.startsWith('/staff/security-events') ? 'active' : ''}`}
            >
              <ShieldAlert size={16} />
              <span>Security Events</span>
            </Link>

            {isOwner && (
              <Link
                href="/staff/staff"
                className={`staff-nav-item ${pathname.startsWith('/staff/staff') ? 'active' : ''}`}
              >
                <Users size={16} />
                <span>Staff & Roles</span>
              </Link>
            )}

            <Link
              href="/staff/audit"
              className={`staff-nav-item ${pathname.startsWith('/staff/audit') ? 'active' : ''}`}
            >
              <ScrollText size={16} />
              <span>Activity Log</span>
            </Link>
          </nav>

          {/* Bottom Actions */}
          <div style={{ padding: '16px', borderTop: '1px solid var(--staff-border)' }}>
            <button
              type="button"
              onClick={handleLogout}
              className="staff-btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Content Viewport */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
