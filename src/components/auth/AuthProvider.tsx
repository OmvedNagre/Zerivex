'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthenticatedUser } from '@/core/auth/session-service';

export type AuthStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'AUTH_ERROR';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  organizationId: string | null;
  organizationRole: string | null;
  isOwner: boolean;
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
  refreshSession: async () => {},
  logout: async () => {},
  logoutAll: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('AUTH_LOADING');
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationRole, setOrganizationRole] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) {
        setStatus('AUTH_ERROR');
        return;
      }

      const data = await res.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
        setOrganizationId(data.organizationId);
        setOrganizationRole(data.organizationRole);
        setStatus('AUTHENTICATED');
      } else {
        setUser(null);
        setOrganizationId(null);
        setOrganizationRole(null);
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
        organizationRole,
        isOwner: user?.role === 'OWNER',
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
