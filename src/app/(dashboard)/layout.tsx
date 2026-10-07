'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { TopBar } from '@/components/dashboard/TopBar';
import { CommandPalette } from '@/components/ui/CommandPalette';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isPinned, setIsPinned] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem('zx_sidebar_pinned');
      if (stored === 'true') {
        setIsPinned(true);
      }
    } catch {
      // Ignore localStorage exceptions in private browsing
    }
  }, []);

  const handlePinChange = (pinned: boolean) => {
    setIsPinned(pinned);
    try {
      localStorage.setItem('zx_sidebar_pinned', pinned ? 'true' : 'false');
    } catch {
      // Ignore
    }
  };

  // Content margin shifts only when pinned on desktop
  const contentMarginLeft = mounted && isPinned ? '248px' : '72px';

  return (
    <ProtectedRoute>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          backgroundColor: 'var(--ds-bg-page)',
        }}
      >
        {/* Hover-expand Sidebar & Mobile Drawer */}
        <Sidebar isPinned={isPinned} onPinChange={handlePinChange} />

        {/* Global Command Palette */}
        <CommandPalette />

        {/* Main Content Area */}
        <div
          className="zx-dashboard-content-wrapper"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            marginLeft: contentMarginLeft,
            transition: 'margin-left 180ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Slim Top Bar */}
          <TopBar />

          {/* Page Viewport */}
          <main style={{ flex: 1, padding: '32px 32px 64px' }}>
            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
              {children}
            </div>
          </main>
        </div>

        {/* Responsive breakpoint override */}
        <style jsx global>{`
          @media (max-width: 767px) {
            .zx-dashboard-content-wrapper {
              margin-left: 0 !important;
              padding-bottom: 64px;
            }
          }
        `}</style>
      </div>
    </ProtectedRoute>
  );
}
