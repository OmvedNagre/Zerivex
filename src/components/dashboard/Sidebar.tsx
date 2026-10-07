'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Drawer } from 'vaul';
import {
  LayoutDashboard,
  Crosshair,
  ScanSearch,
  ShieldAlert,
  CalendarClock,
  GraduationCap,
  Users,
  Building2,
  ScrollText,
  CreditCard,
  KeyRound,
  Webhook,
  UserRound,
  HelpCircle,
  Pin,
  PinOff,
  Menu,
  LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { adaptNavBadges, NavBadges } from '@/adapters/dashboard-adapters';
import { getOrgRoleLabel } from '@/lib/labels';
import '@/styles/dashboard-sidebar.css';

interface NavLinkConfig {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: keyof NavBadges;
  badgeVariant?: 'danger' | 'amber';
  requiredRole?: string[];
  planRequired?: string;
}

interface NavGroupConfig {
  title: string;
  items: NavLinkConfig[];
}

const NAV_GROUPS: NavGroupConfig[] = [
  {
    title: 'Protect',
    items: [
      { label: 'Overview', href: '/dashboard', icon: LayoutDashboard, exact: true },
      { label: 'Targets', href: '/dashboard/targets', icon: Crosshair },
      { label: 'Scans', href: '/dashboard/scans', icon: ScanSearch, badgeKey: 'scansInProgress', badgeVariant: 'amber' },
      { label: 'Findings', href: '/dashboard/findings', icon: ShieldAlert, badgeKey: 'openCriticalHigh', badgeVariant: 'danger' },
    ],
  },
  {
    title: 'Automate',
    items: [
      { label: 'Automation', href: '/dashboard/automation', icon: CalendarClock },
    ],
  },
  {
    title: 'Learn',
    items: [
      { label: 'Academy', href: '/academy', icon: GraduationCap },
    ],
  },
  {
    title: 'Organization',
    items: [
      { label: 'Team', href: '/dashboard/team', icon: Users },
      { label: 'Agency', href: '/dashboard/agency', icon: Building2 },
      { label: 'Audit Vault', href: '/dashboard/audit-vault', icon: ScrollText },
      { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    ],
  },
  {
    title: 'Developer',
    items: [
      { label: 'API Keys', href: '/dashboard/settings/api-keys', icon: KeyRound },
      { label: 'Webhooks', href: '/dashboard/settings/webhooks', icon: Webhook },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Profile & Sessions', href: '/dashboard/settings/security', icon: UserRound },
      { label: 'Help', href: 'mailto:support@zerivex.com', icon: HelpCircle },
    ],
  },
];

export interface SidebarProps {
  isPinned: boolean;
  onPinChange: (pinned: boolean) => void;
}

export function Sidebar({ isPinned, onPinChange }: SidebarProps) {
  const pathname = usePathname();
  const { user, organizationRole } = useAuth();

  const [isHovered, setIsHovered] = useState(false);
  const [badges, setBadges] = useState<NavBadges>({
    openCriticalHigh: 0,
    scansInProgress: 0,
    unreadAlerts: 0,
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isExpanded = isPinned || isHovered;

  // Fetch badge numbers once on mount
  useEffect(() => {
    let isCancelled = false;

    async function loadBadges() {
      try {
        const [findingsRes, scansRes] = await Promise.allSettled([
          fetch('/api/findings').then((r) => r.json()),
          fetch('/api/scans').then((r) => r.json()),
        ]);

        if (isCancelled) return;

        const findings = findingsRes.status === 'fulfilled' && findingsRes.value?.success
          ? findingsRes.value.data?.findings
          : [];
        const scans = scansRes.status === 'fulfilled' && scansRes.value?.success
          ? scansRes.value.data?.scans
          : [];

        const adapted = adaptNavBadges({
          findings,
          scans,
        });

        setBadges(adapted);
      } catch {
        // Silently preserve 0 badges on network failure
      }
    }

    loadBadges();
    return () => {
      isCancelled = true;
    };
  }, [pathname]);

  // Handle ~120ms hover intent
  const handleMouseEnter = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (!hoverTimerRef.current) {
      hoverTimerRef.current = setTimeout(() => {
        setIsHovered(true);
        hoverTimerRef.current = null;
      }, 120);
    }
  };

  // Handle ~200ms leave intent
  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (!leaveTimerRef.current) {
      leaveTimerRef.current = setTimeout(() => {
        setIsHovered(false);
        leaveTimerRef.current = null;
      }, 200);
    }
  };

  // Keyboard navigation & Esc collapse
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isPinned) {
      setIsHovered(false);
      (e.target as HTMLElement)?.blur();
    }
  };

  const isRouteActive = useCallback(
    (item: NavLinkConfig) => {
      if (item.exact) {
        return pathname === item.href;
      }
      return pathname.startsWith(item.href);
    },
    [pathname]
  );

  const userRoleLabel = getOrgRoleLabel(organizationRole || user?.role);
  const userOrgName = user?.displayName ? `${user.displayName}'s Workspace` : 'Zerivex Workspace';

  return (
    <>
      <Tooltip.Provider delayDuration={150}>
        <nav
          aria-label="Dashboard"
          className={`zx-sidebar-rail ${isExpanded ? 'is-expanded' : ''} ${isPinned ? 'is-pinned' : ''}`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onFocus={() => setIsHovered(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node) && !isPinned) {
              setIsHovered(false);
            }
          }}
          onKeyDown={handleKeyDown}
        >
          {/* Workspace Switcher / Header */}
          <div className="zx-sidebar-header">
            <Link href="/dashboard" className="zx-sidebar-logo-mark" aria-label="Zerivex Overview">
              ZX
            </Link>
            <div className="zx-sidebar-workspace-info">
              <span className="zx-sidebar-workspace-name">{userOrgName}</span>
              <span className="zx-sidebar-workspace-role">{userRoleLabel}</span>
            </div>
          </div>

          {/* Grouped Navigation */}
          <div className="zx-sidebar-nav">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="zx-nav-group">
                <span className="zx-nav-group-title" aria-hidden={!isExpanded}>
                  {group.title}
                </span>

                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isRouteActive(item);
                  const badgeValue = item.badgeKey ? badges[item.badgeKey] : 0;
                  const hasBadge = badgeValue > 0;

                  const navLinkContent = (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`zx-nav-item ${active ? 'is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      <span className="zx-nav-icon">
                        <Icon size={18} />
                      </span>
                      <span className="zx-nav-label">{item.label}</span>
                      {hasBadge && (
                        <span
                          className={`zx-nav-badge ${
                            item.badgeVariant === 'danger' ? 'badge-danger' : 'badge-amber'
                          }`}
                        >
                          {badgeValue}
                        </span>
                      )}
                    </Link>
                  );

                  if (isExpanded) {
                    return navLinkContent;
                  }

                  return (
                    <Tooltip.Root key={item.href}>
                      <Tooltip.Trigger asChild>{navLinkContent}</Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content
                          side="right"
                          sideOffset={12}
                          className="zx-tooltip-content"
                          style={{
                            backgroundColor: 'var(--ds-bg-ink)',
                            color: '#FFFFFF',
                            fontSize: '12px',
                            fontWeight: 600,
                            padding: '5px 10px',
                            borderRadius: 'var(--ds-radius-sm)',
                            zIndex: 100,
                            boxShadow: 'var(--ds-shadow-2)',
                          }}
                        >
                          {item.label}
                          {hasBadge && ` (${badgeValue})`}
                          <Tooltip.Arrow style={{ fill: 'var(--ds-bg-ink)' }} />
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Bottom Rail Actions: Pin Toggle */}
          <div className="zx-sidebar-footer">
            <button
              type="button"
              className="zx-sidebar-pin-btn"
              onClick={() => onPinChange(!isPinned)}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar expanded'}
              title={isPinned ? 'Unpin sidebar' : 'Pin sidebar expanded'}
            >
              <span className="zx-nav-icon">
                {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
              </span>
              <span className="zx-nav-label" style={{ opacity: isExpanded ? 1 : 0 }}>
                {isPinned ? 'Unpin sidebar' : 'Pin expanded'}
              </span>
            </button>
          </div>
        </nav>
      </Tooltip.Provider>

      {/* Mobile Bottom Tab Bar (<768px) */}
      <div className="zx-mobile-tabbar" role="navigation" aria-label="Mobile navigation">
        <Link
          href="/dashboard"
          className={`zx-mobile-tab ${pathname === '/dashboard' ? 'is-active' : ''}`}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </Link>

        <Link
          href="/dashboard/targets"
          className={`zx-mobile-tab ${pathname.startsWith('/dashboard/targets') ? 'is-active' : ''}`}
        >
          <Crosshair size={18} />
          <span>Targets</span>
        </Link>

        <Link
          href="/dashboard/scans"
          className={`zx-mobile-tab ${pathname.startsWith('/dashboard/scans') ? 'is-active' : ''}`}
        >
          <ScanSearch size={18} />
          <span>Scans</span>
        </Link>

        <Link
          href="/dashboard/findings"
          className={`zx-mobile-tab ${pathname.startsWith('/dashboard/findings') ? 'is-active' : ''}`}
        >
          <ShieldAlert size={18} />
          <span>Findings</span>
        </Link>

        <Drawer.Root open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
          <Drawer.Trigger asChild>
            <button type="button" className="zx-mobile-tab" aria-label="More navigation modules">
              <Menu size={18} />
              <span>More</span>
            </button>
          </Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Overlay
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(20, 22, 28, 0.45)',
                zIndex: 90,
              }}
            />
            <Drawer.Content
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'var(--ds-bg-card)',
                borderTopLeftRadius: '20px',
                borderTopRightRadius: '20px',
                padding: '20px',
                maxHeight: '80vh',
                overflowY: 'auto',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  width: '36px',
                  height: '4px',
                  backgroundColor: 'var(--ds-border-default)',
                  borderRadius: '2px',
                  margin: '0 auto 16px',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--ds-text-primary)' }}>
                  All Modules
                </h3>
                {NAV_GROUPS.map((group) => (
                  <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase' }}>
                      {group.title}
                    </span>
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileDrawerOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          color: 'var(--ds-text-primary)',
                          textDecoration: 'none',
                          fontSize: '14px',
                        }}
                      >
                        <item.icon size={18} />
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      </div>
    </>
  );
}
