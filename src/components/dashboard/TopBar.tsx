'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Popover from '@radix-ui/react-popover';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Bell,
  Search,
  ChevronRight,
  UserRound,
  LogOut,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getOrgRoleLabel } from '@/lib/labels';

interface AlertItem {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function TopBar() {
  const pathname = usePathname();
  const { user, organizationRole, logout } = useAuth();

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [planChipText, setPlanChipText] = useState('Free Plan');

  // Derive breadcrumbs
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, idx) => {
    const href = '/' + pathSegments.slice(0, idx + 1).join('/');
    const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');
    return { href, label, isLast: idx === pathSegments.length - 1 };
  });

  // Fetch billing summary for plan chip
  useEffect(() => {
    async function loadPlanInfo() {
      try {
        const res = await fetch('/api/billing');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.data?.entitlements) {
          const e = data.data.entitlements;
          const planName = e.plan?.name || 'Free';
          const maxScans = e.plan?.limits?.maxMonthlyScans || 5;
          const usedScans = e.scansCount || 0;
          const remaining = Math.max(maxScans - usedScans, 0);
          setPlanChipText(`${planName} · ${remaining} scan${remaining === 1 ? '' : 's'} left`);
        }
      } catch {
        // Fallback default
        setPlanChipText('Free Plan');
      }
    }
    loadPlanInfo();
  }, []);

  // Fetch alerts
  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/monitoring/alerts?limit=10');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.data?.alerts) {
        setAlerts(data.data.alerts);
        const unread = data.data.alerts.filter((a: AlertItem) => !a.isRead).length;
        setUnreadCount(unread);
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [pathname]);

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })));
      setUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  // Trigger CmdK
  const openCmdK = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
    });
    document.dispatchEvent(event);
  };

  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();
  const userRole = getOrgRoleLabel(organizationRole || user?.role);

  return (
    <header className="zx-topbar" role="banner">
      {/* Left: Breadcrumbs */}
      <div className="zx-topbar-left">
        <nav aria-label="Breadcrumb" className="zx-breadcrumbs">
          <Link href="/dashboard" className="zx-breadcrumb-link">
            Dashboard
          </Link>
          {breadcrumbs.slice(1).map((b) => (
            <React.Fragment key={b.href}>
              <ChevronRight size={14} className="zx-breadcrumb-sep" />
              {b.isLast ? (
                <span className="zx-breadcrumb-current" aria-current="page">
                  {b.label}
                </span>
              ) : (
                <Link href={b.href} className="zx-breadcrumb-link">
                  {b.label}
                </Link>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      {/* Right: CmdK, Alerts Bell, Plan Chip, Avatar Dropdown */}
      <div className="zx-topbar-right">
        {/* ⌘K Trigger Button */}
        <button
          type="button"
          onClick={openCmdK}
          className="zx-cmdk-trigger"
          aria-label="Open command palette (⌘K)"
        >
          <Search size={14} />
          <span>Quick search...</span>
          <kbd className="zx-kbd-chip">⌘K</kbd>
        </button>

        {/* Plan Chip */}
        <Link href="/dashboard/billing" className="zx-plan-chip" title="Manage subscription">
          <span className="zx-plan-chip-dot" aria-hidden="true" />
          <span>{planChipText}</span>
        </Link>

        {/* Alerts Bell Popover */}
        <Popover.Root>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="zx-bell-btn"
              aria-label={`Security alerts: ${unreadCount} unread`}
            >
              <Bell size={16} />
              {unreadCount > 0 && <span className="zx-bell-dot" aria-hidden="true" />}
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="bottom"
              align="end"
              sideOffset={8}
              style={{
                width: '320px',
                backgroundColor: 'var(--ds-bg-card)',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid var(--ds-border-subtle)',
                boxShadow: 'var(--ds-shadow-2)',
                padding: '16px',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                }}
              >
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                  Security Alerts
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--ds-action-brand)',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {alerts.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ds-text-muted)', fontSize: '13px' }}>
                  No alerts recorded.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                  {alerts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--ds-radius-sm)',
                        backgroundColor: a.isRead ? 'transparent' : 'var(--ds-bg-subtle)',
                        border: '1px solid var(--ds-border-subtle)',
                        fontSize: '12px',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: 'var(--ds-text-primary)', marginBottom: '2px' }}>
                        {a.title}
                      </div>
                      <div style={{ color: 'var(--ds-text-secondary)', fontSize: '11.5px' }}>
                        {a.message}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* User Avatar Dropdown */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="zx-avatar-btn"
              aria-label="User account menu"
            >
              {userInitial}
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              sideOffset={8}
              style={{
                width: '220px',
                backgroundColor: 'var(--ds-bg-card)',
                borderRadius: 'var(--ds-radius-md)',
                border: '1px solid var(--ds-border-subtle)',
                boxShadow: 'var(--ds-shadow-2)',
                padding: '6px',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--ds-border-subtle)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ds-text-primary)' }}>
                  {user?.displayName || 'User'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)' }}>
                  {user?.email}
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--ds-action-brand)', fontWeight: 600, marginTop: '2px' }}>
                  {userRole}
                </div>
              </div>

              <DropdownMenu.Item asChild>
                <Link
                  href="/dashboard/settings/security"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: 'var(--ds-text-secondary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--ds-radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <UserRound size={15} />
                  <span>Profile &amp; Sessions</span>
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Item asChild>
                <Link
                  href="/dashboard/billing"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    color: 'var(--ds-text-secondary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--ds-radius-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <CreditCard size={15} />
                  <span>Billing &amp; Usage</span>
                </Link>
              </DropdownMenu.Item>

              <DropdownMenu.Separator style={{ height: '1px', backgroundColor: 'var(--ds-border-subtle)', margin: '4px 0' }} />

              <DropdownMenu.Item
                onSelect={() => logout()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  fontSize: '13px',
                  color: 'var(--ds-danger)',
                  borderRadius: 'var(--ds-radius-sm)',
                  cursor: 'pointer',
                }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
