'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';
import {
  LucideIcon,
  LayoutDashboard,
  Target,
  Zap,
  ShieldAlert,
  Layers,
  ChevronDown,
  ShieldCheck,
  GraduationCap,
  Building2,
  Users,
  Lock,
  CreditCard,
  KeyRound,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

import { useAuth } from '@/components/auth/AuthProvider';
import { StaggeredText } from '@/components/ui/StaggeredText';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  exact?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'Targets', href: '/dashboard/targets', icon: Target },
  { name: 'Scans', href: '/dashboard/scans', icon: Zap },
  { name: 'Findings', href: '/dashboard/findings', icon: ShieldAlert },
];

const MODULE_ITEMS = [
  {
    name: 'Security Academy',
    href: '/academy',
    desc: 'Remediation playbooks & tests',
    icon: GraduationCap,
  },
  {
    name: 'Agency Hub',
    href: '/dashboard/agency',
    desc: 'Multi-client portfolio posture',
    icon: Building2,
  },
  {
    name: 'Team & Roles',
    href: '/dashboard/team',
    desc: 'RBAC & member invitations',
    icon: Users,
  },
  {
    name: 'Compliance Audit Vault',
    href: '/dashboard/audit-vault',
    desc: 'Immutable logs & RFC 4180 export',
    icon: Lock,
  },
  {
    name: 'Billing & Quotas',
    href: '/dashboard/billing',
    desc: 'Scan quotas & subscription',
    icon: CreditCard,
  },
  {
    name: 'Active Sessions',
    href: '/dashboard/settings/security',
    desc: 'Device tracking & revocation',
    icon: KeyRound,
  },
];

export function DashboardHeader() {
  const pathname = usePathname();
  const { user, isOwner, logout } = useAuth();

  // Navigation states
  const [isModulesOpen, setIsModulesOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // References for DOM and GSAP control
  const modulesBtnRef = useRef<HTMLButtonElement>(null);
  const modulesDropdownRef = useRef<HTMLDivElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const drawerCloseBtnRef = useRef<HTMLButtonElement>(null);

  // Derive user initial for avatar
  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  // Route active helper
  const isRouteActive = useCallback(
    (item: NavItem) => {
      if (item.exact) {
        return pathname === item.href;
      }
      return pathname.startsWith(item.href);
    },
    [pathname]
  );

  // Close menus automatically on pathname change
  useEffect(() => {
    setIsModulesOpen(false);
    if (isDrawerOpen) {
      closeDrawer();
    }
  }, [pathname]);

  // Reduced motion preference
  const isReducedMotion = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // GSAP animation for Modules dropdown open/close
  useEffect(() => {
    const el = modulesDropdownRef.current;
    if (!el) return;

    if (isModulesOpen) {
      if (isReducedMotion()) {
        gsap.set(el, { opacity: 1, y: 0, scale: 1 });
      } else {
        gsap.fromTo(
          el,
          { opacity: 0, y: -6, scale: 0.98 },
          { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: 'power2.out' }
        );
      }
    }
  }, [isModulesOpen, isReducedMotion]);

  // Handle outside click & Escape for Modules dropdown
  useEffect(() => {
    if (!isModulesOpen) return;

    const handleDocumentClick = (e: MouseEvent) => {
      if (
        modulesDropdownRef.current &&
        !modulesDropdownRef.current.contains(e.target as Node) &&
        modulesBtnRef.current &&
        !modulesBtnRef.current.contains(e.target as Node)
      ) {
        setIsModulesOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModulesOpen(false);
        modulesBtnRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModulesOpen]);

  // Mobile drawer open animation & body scroll lock
  const openDrawer = () => {
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (!drawerRef.current || !backdropRef.current) {
      setIsDrawerOpen(false);
      return;
    }

    if (isReducedMotion()) {
      setIsDrawerOpen(false);
      drawerTriggerRef.current?.focus();
      return;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        setIsDrawerOpen(false);
        drawerTriggerRef.current?.focus();
      },
    });

    tl.to(drawerRef.current, { x: '100%', duration: 0.22, ease: 'power3.in' }, 0);
    tl.to(backdropRef.current, { opacity: 0, duration: 0.18 }, 0);
  };

  // GSAP animation when drawer mounts
  useEffect(() => {
    if (!isDrawerOpen) return;

    document.body.style.overflow = 'hidden';

    if (drawerRef.current && backdropRef.current) {
      if (isReducedMotion()) {
        gsap.set(backdropRef.current, { opacity: 1 });
        gsap.set(drawerRef.current, { x: '0%' });
      } else {
        gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2 });
        gsap.fromTo(
          drawerRef.current,
          { x: '100%' },
          { x: '0%', duration: 0.26, ease: 'power3.out' }
        );
      }
    }

    // Set focus to close button
    const timer = setTimeout(() => drawerCloseBtnRef.current?.focus(), 50);

    const handleDrawerKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDrawer();
      }

      // Focus trap
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableEls = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableEls.length > 0) {
          const firstEl = focusableEls[0];
          const lastEl = focusableEls[focusableEls.length - 1];

          if (firstEl && lastEl) {
            if (e.shiftKey && document.activeElement === firstEl) {
              e.preventDefault();
              lastEl.focus();
            } else if (!e.shiftKey && document.activeElement === lastEl) {
              e.preventDefault();
              firstEl.focus();
            }
          }
        }
      }
    };

    document.addEventListener('keydown', handleDrawerKeyDown);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleDrawerKeyDown);
    };
  }, [isDrawerOpen, isReducedMotion]);

  return (
    <>
      <header className="zh-header" role="banner">
        <div className="zh-container">
          {/* ================================================================
              ZONE 1: BRAND IDENTITY & SYSTEM HEALTH SIGNAL (LEFT)
              ================================================================ */}
          <div className="zh-brand-group">
            <Link
              href="/"
              className="zh-brand-link"
              aria-label="Back to Zerivex home"
            >
              <div className="zh-logo-badge" aria-hidden="true">
                Z
              </div>
              <div className="zh-brand-titles">
                <span className="zh-brand-name">ZERIVEX</span>
                <span className="zh-status-signal">
                  <span className="zh-signal-dot" aria-hidden="true" />
                  <StaggeredText
                    text="SHIELD ACTIVE"
                    staggerDuration={0.02}
                    initialDelay={0.05}
                  />
                </span>
              </div>
            </Link>
          </div>

          {/* ================================================================
              ZONE 2: PRIMARY WORKFLOW NAVIGATION (CENTER)
              ================================================================ */}
          <nav
            className="zh-nav-desktop"
            role="navigation"
            aria-label="Primary Workspace Navigation"
          >
            {PRIMARY_NAV.map((item) => {
              const active = isRouteActive(item);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`zh-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="zh-nav-icon">
                    <Icon size={15} strokeWidth={1.75} />
                  </span>
                  <span>{item.name}</span>
                  {item.badge && <span className="zh-badge-micro">{item.badge}</span>}
                </Link>
              );
            })}

            {/* Modules Secondary Dropdown Menu */}
            <div className="zh-dropdown-wrapper">
              <button
                ref={modulesBtnRef}
                type="button"
                id="modules-menu-button"
                className={`zh-dropdown-trigger ${isModulesOpen ? 'open' : ''}`}
                aria-haspopup="menu"
                aria-expanded={isModulesOpen}
                aria-controls="modules-dropdown-menu"
                onClick={() => setIsModulesOpen((prev) => !prev)}
              >
                <span className="zh-nav-icon">
                  <Layers size={15} strokeWidth={1.75} />
                </span>
                <span>Modules</span>
                <ChevronDown size={13} strokeWidth={2} className="zh-dropdown-chevron" />
              </button>

              {isModulesOpen && (
                <div
                  ref={modulesDropdownRef}
                  id="modules-dropdown-menu"
                  className="zh-dropdown-menu"
                  role="menu"
                  aria-labelledby="modules-menu-button"
                >
                  {MODULE_ITEMS.map((mod) => {
                    const ModIcon = mod.icon;
                    const isActive = pathname.startsWith(mod.href);

                    return (
                      <Link
                        key={mod.href}
                        href={mod.href}
                        className="zh-dropdown-item"
                        role="menuitem"
                        onClick={() => setIsModulesOpen(false)}
                      >
                        <ModIcon
                          size={16}
                          strokeWidth={1.75}
                          style={{
                            color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: isActive ? 600 : 500 }}>{mod.name}</span>
                          <span className="zh-dropdown-item-desc">{mod.desc}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Privileged Platform Owner Control Center */}
            {isOwner && (
              <Link
                href="/admin"
                className="zh-privileged-link"
                title="System administration & tenant audit logs"
                aria-current={pathname.startsWith('/admin') ? 'page' : undefined}
              >
                <ShieldCheck size={15} strokeWidth={2} />
                <span>Control Center</span>
              </Link>
            )}
          </nav>

          {/* ================================================================
              ZONE 3: ACCOUNT & ENVIRONMENT CONTROLS (RIGHT)
              ================================================================ */}
          <div className="zh-actions-desktop">
            {/* Compact User Identity Pill */}
            <div
              className="zh-user-pill"
              title={`Logged in as ${user?.displayName || user?.email}`}
            >
              <div className="zh-avatar" aria-hidden="true">
                {userInitial}
              </div>
              <div className="zh-user-details">
                <span className="zh-user-name">
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
                <span
                  className="zh-user-role"
                  style={{
                    color: isOwner ? 'var(--accent-primary)' : 'var(--text-muted)',
                  }}
                >
                  {user?.role || 'MEMBER'}
                </span>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={() => logout()}
              className="zh-signout-btn"
              title="Sign out of your active workspace"
              aria-label="Sign out"
            >
              <LogOut size={14} strokeWidth={2} />
              <span>Sign Out</span>
            </button>
          </div>

          {/* ================================================================
              ZONE 4: MOBILE HAMBURGER & THEME TRIGGER (< 960px)
              ================================================================ */}
          <div className="zh-mobile-actions">
            <button
              ref={drawerTriggerRef}
              type="button"
              className="zh-mobile-trigger"
              aria-label={isDrawerOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={isDrawerOpen}
              aria-controls="mobile-navigation-drawer"
              onClick={openDrawer}
            >
              <Menu size={20} strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================
          MOBILE NAVIGATION SLIDE-OUT DRAWER
          ================================================================== */}
      {isDrawerOpen && (
        <>
          <div
            ref={backdropRef}
            className="zh-drawer-backdrop"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          <aside
            ref={drawerRef}
            id="mobile-navigation-drawer"
            className="zh-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            {/* Drawer Header */}
            <div className="zh-drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div className="zh-logo-badge" style={{ width: '28px', height: '28px', fontSize: '0.85rem' }}>
                  Z
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    ZERIVEX
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--emerald)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    SHIELD ACTIVE
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button
                  ref={drawerCloseBtnRef}
                  type="button"
                  className="zh-drawer-close"
                  onClick={closeDrawer}
                  aria-label="Close navigation"
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="zh-drawer-content">
              {/* Primary Section */}
              <div>
                <div className="zh-drawer-section-title">Core Workflows</div>
                <div className="zh-drawer-nav-list">
                  {PRIMARY_NAV.map((item) => {
                    const active = isRouteActive(item);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`zh-drawer-item ${active ? 'active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={closeDrawer}
                      >
                        <div className="zh-drawer-item-left">
                          <Icon size={18} strokeWidth={1.75} style={{ color: active ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && <span className="zh-badge-micro">{item.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Modules Section */}
              <div>
                <div className="zh-drawer-section-title">Security Modules</div>
                <div className="zh-drawer-nav-list">
                  {MODULE_ITEMS.map((mod) => {
                    const ModIcon = mod.icon;
                    const isActive = pathname.startsWith(mod.href);
                    return (
                      <Link
                        key={mod.href}
                        href={mod.href}
                        className={`zh-drawer-item ${isActive ? 'active' : ''}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={closeDrawer}
                      >
                        <div className="zh-drawer-item-left">
                          <ModIcon size={18} strokeWidth={1.75} style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.88rem' }}>{mod.name}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Privileged Control Center */}
              {isOwner && (
                <div>
                  <div className="zh-drawer-section-title">Administration</div>
                  <Link
                    href="/admin"
                    className="zh-drawer-item"
                    style={{
                      backgroundColor: 'var(--accent-subtle)',
                      border: '1px solid var(--border-accent)',
                      color: 'var(--accent-primary)',
                      fontWeight: 600,
                    }}
                    onClick={closeDrawer}
                  >
                    <div className="zh-drawer-item-left">
                      <ShieldCheck size={18} strokeWidth={2} />
                      <span>Control Center</span>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* Drawer Account Footer */}
            <div className="zh-drawer-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="zh-avatar" style={{ width: '32px', height: '32px', fontSize: '0.85rem' }}>
                  {userInitial}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.displayName || user?.email}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: isOwner ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ROLE: {user?.role || 'MEMBER'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  closeDrawer();
                  logout();
                }}
                className="zh-signout-btn"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <LogOut size={16} strokeWidth={2} />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
