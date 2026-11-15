import { CORE_ENDPOINTS, configureHttpClient, http } from '@/core/api';
import { apiFetch } from '@/core/api/secure-fetch';
import { API_BASE_PATH } from '@/core/config';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { sessionStore } from './session-store';
import type { Session } from './types';

/**
 * Talks to the Worker's session endpoints. Credentials never reach this code:
 * login sets HttpOnly cookies, the Worker attaches the access token to backend calls
 * and refreshes it transparently. We only keep the (non-secret) identity hint.
 */
export const authService = {
  async login(username: string, password: string): Promise<Session> {
    const data = await http.post<Session>(CORE_ENDPOINTS.login, { username, password }, { anonymous: true });
    const session: Session = {
      username: data.username || username,
      role: data.role || 'USER',
      userId: data.userId ?? null,
      mustResetPassword: data.mustResetPassword === true,
    };
    sessionStore.set(session);
    return session;
  },

  /**
   * Validates the cookie session on page load (GET /api/session) and refreshes the identity hint.
   * 401 → the hint is stale, drop it. Network errors keep the hint so the app still opens offline-ish.
   */
  async restore(): Promise<void> {
    sessionStore.purgeLegacyTokens();
    try {
      const data = await http.get<Session>(CORE_ENDPOINTS.session, { anonymous: true });
      sessionStore.set({
        username: data.username,
        role: data.role || 'USER',
        userId: data.userId ?? null,
        mustResetPassword: data.mustResetPassword === true,
      });
    } catch (err) {
      if ((err as { status?: number })?.status === 401) authService.clearLocal();
    }
  },

  /** Local state only (used when the server already considers us signed out). */
  clearLocal() {
    sessionStore.clear();
    activeEventStore.clear();
    // PHASE 1 COMPAT: per-session keys legacy pages keep
    ['shopId', 'counterId', 'selectedEventId'].forEach((k) => localStorage.removeItem(k));
  },

  /** Ends the session: the Worker clears the cookies; `keepalive` lets it finish during a page redirect. */
  logout() {
    void apiFetch(`${API_BASE_PATH}${CORE_ENDPOINTS.logout}`, { method: 'POST', keepalive: true }).catch(() => {});
    authService.clearLocal();
  },
};

/** Wires the HTTP client to the session. Called once by AuthProvider. */
export function bindHttpClientToSession() {
  configureHttpClient({
    getEventId: () => activeEventStore.get()?.id ?? null,
    onUnauthorized: () => authService.logout(),
  });
}
