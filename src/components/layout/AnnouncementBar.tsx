'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { X, ArrowRight } from 'lucide-react';

export interface AnnouncementBarProps {
  id?: string;
  message?: string;
  ctaLabel?: string;
  ctaHref?: string;
  dismissible?: boolean;
}

export function AnnouncementBar({
  id = 'zx-announcement-v2',
  message = 'Deterministic Security Engine: Automated Vulnerability Scanning & SSRF Egress Defense Active.',
  ctaLabel = 'Explore Academy',
  ctaHref = '/academy',
  dismissible = true,
}: AnnouncementBarProps) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const isDismissed = localStorage.getItem(`zx_announcement_${id}`);
      if (isDismissed === 'true') {
        setDismissed(true);
      }
    } catch {
      // localStorage may fail in private browsing
    }
  }, [id]);

  // Hidden until mounted to guarantee ZERO hydration mismatch
  if (!mounted || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`zx_announcement_${id}`, 'true');
    } catch {
      // Ignore
    }
  };

  return (
    <aside
      role="banner"
      aria-label="Platform announcement"
      style={{
        backgroundColor: 'var(--ds-bg-ink)',
        color: 'var(--ds-text-on-ink)',
        fontSize: '13px',
        fontWeight: 500,
        minHeight: '38px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 16px',
        position: 'relative',
        zIndex: 100,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <span style={{ color: 'var(--ds-text-on-ink-dim)' }}>{message}</span>
        {ctaLabel && ctaHref && (
          <Link
            href={ctaHref}
            style={{
              color: 'var(--ds-mint)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '13px',
              padding: '2px 6px',
              borderRadius: 'var(--ds-radius-sm)',
            }}
          >
            {ctaLabel}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: 'var(--ds-text-on-ink-dim)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--ds-radius-sm)',
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </aside>
  );
}
