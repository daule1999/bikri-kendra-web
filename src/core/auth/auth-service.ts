import { CORE_ENDPOINTS, configureHttpClient, http } from '@/core/api';
import { SESSION_TIMING } from '@/core/config';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { sessionStore } from './session-store';
import { decodeJwtPayload, getTokenExpiryMs, isTokenExpired } from './token';
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

/** Fallback when the login body has no role: read it from the JWT claims. */
function roleFromToken(token: string): string | undefined {
  const c = decodeJwtPayload(token) as Record<string, unknown> | null;
  const v = c?.role ?? c?.roles ?? c?.authorities;
  const first = Array.isArray(v) ? v[0] : v;
  const r = typeof first === 'string' ? first : (first as { authority?: string } | undefined)?.authority;
  return r || undefined;
}

let refreshInFlight: Promise<boolean> | null = null;

export const authService = {
  async login(username: string, password: string): Promise<Session> {
    const data = await http.post<LoginResponse>(CORE_ENDPOINTS.login, { username, password }, { anonymous: true });
    const session: Session = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      username,
      role: data.role || data.roles?.[0] || roleFromToken(data.accessToken) || 'USER',
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

  /**
   * Same as EventManagement's dashboard: the authoritative role comes from
   * GET /users/{username} (`roles[0]`), not the login body. Updates the session
   * so sidebar, dashboard and guards re-evaluate.
   */
  async syncRole(): Promise<void> {
    const session = sessionStore.get();
    if (!session) return;
    try {
      const user = await http.get<{ roles?: unknown[] }>(CORE_ENDPOINTS.userByUsername(session.username));
      const first = Array.from(user?.roles ?? [])[0];
      const role = first == null ? '' : String(typeof first === 'object' ? (first as { name?: string }).name ?? '' : first);
      if (role && role !== session.role) sessionStore.update({ role });
    } catch {
      /* keep the role we already have */
    }
  },

  logout() {
    sessionStore.clear();
    activeEventStore.clear();
    // PHASE 1 COMPAT: per-session keys legacy pages keep
    ['shopId', 'counterId', 'selectedEventId'].forEach((k) => localStorage.removeItem(k));
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
