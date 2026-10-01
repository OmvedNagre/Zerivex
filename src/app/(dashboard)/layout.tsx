'use client';

import { AuthProvider } from '@/components/auth/AuthProvider';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
          <DashboardHeader />
          <main style={{ flex: 1, padding: '2rem 0 4rem' }}>
            <div className="container">{children}</div>
          </main>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}
