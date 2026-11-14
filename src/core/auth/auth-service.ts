import { CORE_ENDPOINTS, configureHttpClient, http } from '@/core/api';
import { SESSION_TIMING } from '@/core/config';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { sessionStore } from './session-store';
import { getTokenExpiryMs, isTokenExpired } from './token';
import type { Session } from './types';

/** Shape returned by auth-svc /login. */
interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  role?: string;
  roles?: string[];
  mustResetPassword?: boolean;
}

interface RefreshResponse { accessToken: string; refreshToken?: string }

let refreshInFlight: Promise<boolean> | null = null;

export const authService = {
  async login(username: string, password: string): Promise<Session> {
    const data = await http.post<LoginResponse>(CORE_ENDPOINTS.login, { username, password }, { anonymous: true });
    const session: Session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      username,
      role: data.role || data.roles?.[0] || 'USER',
      mustResetPassword: data.mustResetPassword === true,
    };
    sessionStore.set(session);
    return session;
  },

  /** Single-flight refresh: concurrent callers share one network request. */
  refresh(): Promise<boolean> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      const session = sessionStore.get();
      if (!session?.refreshToken) return false;
      try {
        const data = await http.post<RefreshResponse>(
          CORE_ENDPOINTS.refresh, { refreshToken: session.refreshToken }, { anonymous: true },
        );
        if (!data?.accessToken) return false;
        sessionStore.update({ accessToken: data.accessToken, refreshToken: data.refreshToken ?? session.refreshToken });
        return true;
      } catch {
        return false;
      }
    })().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  },

  /** Refreshes only when the token is close to expiry. Logs out if it can't and the token is already dead. */
  async refreshIfStale(): Promise<void> {
    const session = sessionStore.get();
    if (!session) return;
    const expiry = getTokenExpiryMs(session.accessToken);
    const remaining = expiry === null ? -Infinity : expiry - Date.now();
    if (remaining > SESSION_TIMING.refreshThresholdMs) return;
    const ok = await authService.refresh();
    if (!ok && isTokenExpired(session.accessToken)) authService.logout();
  },

  logout() {
    sessionStore.clear();
    activeEventStore.clear();
  },
};

/** Wires the HTTP client to the session. Called once by AuthProvider. */
export function bindHttpClientToSession() {
  configureHttpClient({
    getAccessToken: () => sessionStore.get()?.accessToken ?? null,
    getEventId: () => activeEventStore.get()?.id ?? null,
    refreshSession: () => authService.refresh(),
    onUnauthorized: () => authService.logout(),
  });
}
