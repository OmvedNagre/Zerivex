'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import {
  ShieldCheck,
  ChevronDown,
  Menu,
  X,
  ScanSearch,
  Radar,
  Bug,
  Fingerprint,
  Network,
  FileCode,
  GitBranch,
  Webhook,
  ScrollText,
  FileText,
  ArrowRight,
  Users,
  Building2,
} from 'lucide-react';

export function Header() {
  const { user } = useAuth();
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isHeroScrolledPast, setIsHeroScrolledPast] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);

  // Monitor scroll position to swap nav CTA style per the "one Brand button per viewport" rule
  useEffect(() => {
    const handleScroll = () => {
      // Once scrolled past hero section (> 480px), nav CTA upgrades to Brand
      if (window.scrollY > 480) {
        setIsHeroScrolledPast(true);
      } else {
        setIsHeroScrolledPast(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mega menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (megaRef.current && !megaRef.current.contains(e.target as Node)) {
        setMegaOpen(false);
      }
    };
    if (megaOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [megaOpen]);

  const platformGroups = [
    {
      title: 'Detect',
      links: [
        { label: 'Scanner Battery', href: '/#scanners', icon: ScanSearch, desc: '14 deterministic active & passive engines' },
        { label: 'Attack Surface', href: '/#surface', icon: Radar, desc: 'Automated crawler & route discovery' },
        { label: 'AI Code Smells', href: '/academy/securing-ai-generated-code', icon: Bug, desc: 'Defense against Cursor, v0 & Lovable flaws' },
      ],
    },
    {
      title: 'Verify & Defend',
      links: [
        { label: 'Target Ownership', href: '/#ownership', icon: Fingerprint, desc: 'DNS TXT, HTTP header & HTML meta challenge' },
        { label: 'SSRF Egress Shield', href: '/#egress', icon: Network, desc: 'Socket-level DNS pinning & private IP defense' },
        { label: 'Fix Recipes Catalog', href: '/#remediation', icon: FileCode, desc: '31+ before/after diffs for Next, Express, Nginx' },
      ],
    },
    {
      title: 'Ship Safely',
      links: [
        { label: 'CI/CD Quality Gates', href: '/#cicd', icon: GitBranch, desc: 'Deterministic build breaker for GitHub & GitLab' },
        { label: 'OASIS SARIF v2.1.0', href: '/#sarif', icon: FileText, desc: 'Direct GitHub Code Scanning tab integration' },
        { label: 'Webhooks & API Keys', href: '/#webhooks', icon: Webhook, desc: 'HMAC signed real-time event alerts' },
      ],
    },
    {
      title: 'Prove It',
      links: [
        { label: 'Compliance Audit Vault', href: '/#audit-vault', icon: ScrollText, desc: 'Tamper-evident logs with RFC 4180 CSV export' },
        { label: 'Multi-Tenant RBAC', href: '/#rbac', icon: Users, desc: '5-tier roles with secure token invitations' },
        { label: 'Agency Portfolio', href: '/#agency', icon: Building2, desc: 'White-label reporting for multi-client fleets' },
      ],
    },
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: '12px',
        zIndex: 90,
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 16px',
      }}
    >
      <nav
        aria-label="Main Navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '56px',
          padding: '0 16px 0 20px',
          backgroundColor: 'var(--ds-bg-card)',
          borderRadius: 'var(--ds-radius-pill)',
          border: '1px solid var(--ds-border-default)',
          boxShadow: 'var(--ds-shadow-1)',
        }}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            color: 'var(--ds-text-primary)',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--ds-radius-sm)',
              backgroundColor: 'var(--ds-action-brand)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--ds-on-brand)',
            }}
          >
            <ShieldCheck size={18} strokeWidth={2.2} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            }}
          >
            ZERIVEX
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <div
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '24px',
          }}
          className="zx-desktop-nav"
        >
          {/* Platform Mega Menu Toggle */}
          <div ref={megaRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setMegaOpen(!megaOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                color: megaOpen ? 'var(--ds-text-primary)' : 'var(--ds-text-secondary)',
                cursor: 'pointer',
                padding: '6px 0',
              }}
              aria-expanded={megaOpen}
            >
              <span>Platform</span>
              <ChevronDown
                size={14}
                style={{
                  transform: megaOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s var(--ds-ease)',
                }}
              />
            </button>

            {/* Mega Menu Dropdown */}
            {megaOpen && (
              <div
                data-lenis-prevent
                style={{
                  position: 'absolute',
                  top: '44px',
                  left: '-120px',
                  width: '840px',
                  backgroundColor: 'var(--ds-bg-card)',
                  border: '1px solid var(--ds-border-default)',
                  borderRadius: 'var(--ds-radius-lg)',
                  boxShadow: 'var(--ds-shadow-3)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                  {platformGroups.map((grp) => (
                    <div key={grp.title}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--ds-text-muted)',
                          display: 'block',
                          marginBottom: '10px',
                        }}
                      >
                        {grp.title}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {grp.links.map((lnk) => {
                          const Icon = lnk.icon;
                          return (
                            <Link
                              key={lnk.label}
                              href={lnk.href}
                              onClick={() => setMegaOpen(false)}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '8px',
                                textDecoration: 'none',
                                padding: '6px',
                                borderRadius: 'var(--ds-radius-sm)',
                                transition: 'background-color 0.15s',
                              }}
                              className="zx-mega-link"
                            >
                              <Icon size={15} style={{ color: 'var(--ds-action-brand)', marginTop: 2, flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ds-text-primary)' }}>
                                  {lnk.label}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--ds-text-muted)', lineHeight: 1.3 }}>
                                  {lnk.desc}
                                </div>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo bottom strip */}
                <div
                  style={{
                    backgroundColor: 'var(--ds-bg-subtle)',
                    borderRadius: 'var(--ds-radius-md)',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid var(--ds-border-subtle)',
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--ds-text-secondary)' }}>
                    <strong>Free scan:</strong> 1 public scan per week included. No credit card required.
                  </span>
                  <Link
                    href="/#hero-scan"
                    onClick={() => setMegaOpen(false)}
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--ds-action-brand)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                    }}
                  >
                    <span>Run free scan</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            href="/pricing"
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-text-secondary)', textDecoration: 'none' }}
          >
            Pricing
          </Link>
          <Link
            href="/academy"
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-text-secondary)', textDecoration: 'none' }}
          >
            Academy
          </Link>
          <Link
            href="/.well-known/security.txt"
            style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ds-text-secondary)', textDecoration: 'none' }}
          >
            security.txt
          </Link>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!user && (
            <Link
              href="/login"
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--ds-text-secondary)',
                textDecoration: 'none',
                padding: '0 12px',
              }}
            >
              Sign in
            </Link>
          )}

          {/* CTA Button: Secondary while Hero is in view, Brand once Hero scrolls out */}
          <Link
            href={user ? '/dashboard' : '/login'}
            className={`zx-btn zx-btn--sm ${isHeroScrolledPast ? 'zx-btn--brand' : 'zx-btn--secondary'}`}
          >
            <span>{user ? 'Go to dashboard' : 'Scan my site'}</span>
            <ArrowRight size={13} />
          </Link>

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ds-text-primary)',
            }}
            className="zx-mobile-trigger"
            aria-label="Toggle navigation drawer"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          data-lenis-prevent
          style={{
            position: 'fixed',
            inset: 0,
            top: '72px',
            backgroundColor: 'var(--ds-bg-card)',
            padding: '24px',
            zIndex: 85,
            overflowY: 'auto',
            borderTop: '1px solid var(--ds-border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ds-text-primary)', textDecoration: 'none' }}
            >
              Pricing
            </Link>
            <Link
              href="/academy"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ds-text-primary)', textDecoration: 'none' }}
            >
              Security Academy
            </Link>
            <Link
              href="/.well-known/security.txt"
              onClick={() => setMobileOpen(false)}
              style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ds-text-primary)', textDecoration: 'none' }}
            >
              security.txt
            </Link>
          </div>

          <hr style={{ borderColor: 'var(--ds-border-subtle)', margin: 0 }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ds-text-muted)', textTransform: 'uppercase' }}>
              Platform Capabilities
            </span>
            <Link href="/#scanners" onClick={() => setMobileOpen(false)} style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
              14 Deterministic Scanner Engines
            </Link>
            <Link href="/#ownership" onClick={() => setMobileOpen(false)} style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
              Cryptographic Target Ownership
            </Link>
            <Link href="/#remediation" onClick={() => setMobileOpen(false)} style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
              31+ Multi-Framework Fix Recipes
            </Link>
            <Link href="/#cicd" onClick={() => setMobileOpen(false)} style={{ fontSize: '14px', color: 'var(--ds-text-secondary)', textDecoration: 'none' }}>
              CI/CD Quality Gates & SARIF
            </Link>
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
            <Link
              href={user ? '/dashboard' : '/login'}
              onClick={() => setMobileOpen(false)}
              className="zx-btn zx-btn--brand zx-btn--md"
              style={{ width: '100%' }}
            >
              <span>{user ? 'Go to dashboard' : 'Scan my site free'}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* Global CSS for desktop/mobile visibility without Tailwind */}
      <style jsx global>{`
        @media (min-width: 840px) {
          .zx-desktop-nav {
            display: flex !important;
          }
          .zx-mobile-trigger {
            display: none !important;
          }
        }
        .zx-mega-link:hover {
          background-color: var(--ds-bg-subtle);
        }
      `}</style>
    </header>
  );
}
