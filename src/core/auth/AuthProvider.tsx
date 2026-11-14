'use client';

import { createContext, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { SESSION_TIMING } from '@/core/config';
import { authService, bindHttpClientToSession } from './auth-service';
import { permissionsForRole, type Permission } from './permissions';
import { sessionStore } from './session-store';
import type { AuthUser } from './types';

export interface AuthContextValue {
  /** false during the static-HTML render, true once the browser session has been read. */
  isReady: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  permissions: ReadonlySet<Permission>;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

const noopSubscribe = () => () => {};

bindHttpClientToSession();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  const isReady = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Background token refresh: on an interval and whenever the tab becomes visible again.
  useEffect(() => {
    if (!session) return;
    void authService.refreshIfStale();
    void authService.syncRole();
    const timer = setInterval(() => void authService.refreshIfStale(), SESSION_TIMING.refreshCheckIntervalMs);
    const onVisible = () => { if (document.visibilityState === 'visible') void authService.refreshIfStale(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [session?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username: string, password: string) => {
    const s = await authService.login(username, password);
    return { username: s.username, role: s.role, mustResetPassword: s.mustResetPassword };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session ? { username: session.username, role: session.role, mustResetPassword: session.mustResetPassword } : null;
    return {
      isReady,
      isAuthenticated: !!session,
      user,
      permissions: permissionsForRole(user?.role),
      login,
      logout: authService.logout,
    };
  }, [session, isReady, login]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
