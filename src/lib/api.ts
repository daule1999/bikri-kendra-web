/**
 * PHASE 1 COMPAT — legacy `apiClient` (returns raw Response) used by ported pages.
 * Now shares the new core: same token/event source, single-flight refresh on 401,
 * same logout. New code should use `http` from '@/core/api' instead.
 */
import { authService } from '@/core/auth/auth-service';
import { sessionStore } from '@/core/auth/session-store';
import { getTokenExpiryMs as coreExpiry, isTokenExpired } from '@/core/auth/token';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { API_BASE_PATH, HEADERS, ROUTES } from '@/core/config';

export const getTokenExpiryMs = (token: string): number | null => coreExpiry(token);
export const isTokenLocallyExpired = (token: string): boolean => isTokenExpired(token);

let active = 0;
const track = (delta: number) => {
  if (typeof window === 'undefined') return;
  active = Math.max(0, active + delta);
  window.dispatchEvent(new CustomEvent('api-loading-state', { detail: { isLoading: active > 0, count: active } }));
};

const requestId = () => {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
};

function headersFor(extra?: Record<string, string>): Record<string, string> {
  const token = sessionStore.get()?.accessToken;
  const eventId = activeEventStore.get()?.id;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(eventId ? { [HEADERS.eventId]: eventId } : {}),
    [HEADERS.requestId]: requestId(),
    ...extra,
  };
}

function forceLogout() {
  authService.logout();
  if (typeof window !== 'undefined' && window.location.pathname !== ROUTES.login) window.location.href = ROUTES.login;
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function coreRequest(method: Method, endpoint: string, data?: unknown, headers?: Record<string, string>): Promise<Response> {
  const doFetch = () => fetch(`${API_BASE_PATH}${endpoint}`, {
    method,
    headers: headersFor(headers),
    ...(data !== undefined && { body: JSON.stringify(data) }),
  });
  track(1);
  try {
    let response = await doFetch();
    if (response.status === 401) {
      if (await authService.refresh()) response = await doFetch();
      if (response.status === 401) forceLogout();
    }
    return response;
  } finally {
    track(-1);
  }
}

export const apiClient = {
  get: (endpoint: string, headers?: Record<string, string>) => coreRequest('GET', endpoint, undefined, headers),
  post: (endpoint: string, data: any, headers?: Record<string, string>) => coreRequest('POST', endpoint, data, headers),
  put: (endpoint: string, data: any, headers?: Record<string, string>) => coreRequest('PUT', endpoint, data, headers),
  patch: (endpoint: string, data?: any, headers?: Record<string, string>) => coreRequest('PATCH', endpoint, data, headers),
  delete: (endpoint: string, headers?: Record<string, string>) => coreRequest('DELETE', endpoint, undefined, headers),
};
