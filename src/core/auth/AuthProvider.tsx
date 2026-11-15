'use client';

import { createContext, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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

bindHttpClientToSession();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, () => null);
  // Ready once the cookie session has been validated against the Worker (GET /api/session).
  const [isReady, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    authService.restore().finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const s = await authService.login(username, password);
    return { username: s.username, role: s.role, userId: s.userId, mustResetPassword: s.mustResetPassword };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session ? { username: session.username, role: session.role, userId: session.userId, mustResetPassword: session.mustResetPassword } : null;
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
