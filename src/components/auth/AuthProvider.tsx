'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthenticatedUser } from '@/core/auth/session-service';

export type AuthStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'AUTH_ERROR';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  organizationId: string | null;
  organizationName?: string | null;
  organizationRole: string | null;
  isOwner: boolean;
  viaStaffPortal: boolean;
  previewPlanId: string | null;
  staffRole: string | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  status: 'AUTH_LOADING',
  user: null,
  organizationId: null,
  organizationRole: null,
  isOwner: false,
  viaStaffPortal: false, previewPlanId: null, staffRole: null,
  refreshSession: async () => {},
  logout: async () => {},
  logoutAll: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('AUTH_LOADING');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);

  const [portalContext, setPortalContext] = useState({ viaStaffPortal: false, previewPlanId: null as string | null, staffRole: null as string | null });

  const fetchSession = useCallback(async () => {
    setStatus('AUTH_LOADING');
    try {
      const res = await fetch('/api/auth/session', {
        headers: { 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        setStatus('AUTH_ERROR');
        return;
      }

      const data = await res.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setOrganizationId(data.organizationId);
        setOrganizationName(data.organizationName || null);
        setOrganizationRole(data.organizationRole);
        setPortalContext({ viaStaffPortal: data.viaStaffPortal === true, previewPlanId: data.previewPlanId || null, staffRole: data.staffRole || null });
        setStatus('AUTHENTICATED');
      } else {
        setUser(null);
        setOrganizationId(null);
        setOrganizationRole(null);
        setPortalContext({ viaStaffPortal: false, previewPlanId: null, staffRole: null });
        setStatus('UNAUTHENTICATED');
      }
    } catch {
      setStatus('AUTH_ERROR');
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } finally {
      setUser(null);
      setOrganizationId(null);
      setOrganizationRole(null);
      setStatus('UNAUTHENTICATED');
      window.location.href = '/login';
    }
  }, []);

  const logoutAll = useCallback(async () => {
    try {
      await fetch('/api/auth/logout-all', {
        method: 'POST',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      });
    } finally {
      setUser(null);
      setOrganizationId(null);
      setOrganizationRole(null);
      setStatus('UNAUTHENTICATED');
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        organizationId,
        organizationName,
        organizationRole,
        isOwner: user?.role === 'OWNER',
        ...portalContext,
        refreshSession: fetchSession,
        logout,
        logoutAll,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
