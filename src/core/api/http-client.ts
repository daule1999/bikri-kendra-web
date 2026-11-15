import { API_BASE_PATH, HEADERS } from '@/core/config';
import { apiFetch } from './secure-fetch';
import { ApiError, extractErrorMessage } from './api-error';

/**
 * Centralised HTTP client. The ONLY place the app calls fetch().
 *
 * - baseURL: same-origin `/api` (the Worker proxy hides the real backend)
 * - injects X-Event-Id + X-Request-Id on every call (credentials travel as HttpOnly cookies)
 * - parses JSON / text / empty responses automatically
 * - throws a typed ApiError for non-2xx
 * - emits activity events so a global loader can subscribe
 *
 * The auth layer plugs in through `configureHttpClient` so this module has no
 * dependency on React or on how/where tokens are stored.
 */

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  query?: Record<string, QueryValue | QueryValue[]>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Don't treat a 401 as 'session lost' (login, session check). */
  anonymous?: boolean;
}

interface HttpClientHooks {
  getEventId: () => string | null;
  /** The session is gone (the Worker already tried to refresh it). */
  onUnauthorized: () => void;
}

let hooks: HttpClientHooks = {
  getEventId: () => null,
  onUnauthorized: () => {},
};

export function configureHttpClient(next: Partial<HttpClientHooks>) {
  hooks = { ...hooks, ...next };
}

// ── activity tracking (global loader) ────────────────────────────────────────
type ActivityListener = (pending: number) => void;
const activityListeners = new Set<ActivityListener>();
let pending = 0;
const bump = (delta: number) => {
  pending = Math.max(0, pending + delta);
  activityListeners.forEach((l) => l(pending));
};
export function subscribeToApiActivity(listener: ActivityListener) {
  activityListeners.add(listener);
  return () => { activityListeners.delete(listener); };
}

// ── helpers ──────────────────────────────────────────────────────────────────
const requestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = `${API_BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) if (v !== undefined && v !== null && v !== '') params.append(key, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    try { return JSON.parse(text); } catch { return text; }
  }
  return text;
}

async function send<T>(method: Method, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  const id = requestId();
  const headers: Record<string, string> = { Accept: 'application/json', [HEADERS.requestId]: id, ...options.headers };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const eventId = hooks.getEventId();
  if (eventId) headers[HEADERS.eventId] = eventId;

  bump(1);
  let response: Response;
  try {
    response = await apiFetch(buildUrl(path, options.query), {
      method,
      headers,
      signal: options.signal,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch (err) {
    bump(-1);
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('Network error. Please check your connection and try again.', 0, null, id);
  }
  bump(-1);

  // Cookie session: the Worker refreshes expiring tokens itself, so a 401 means the session is really gone.
  if (response.status === 401 && !options.anonymous) hooks.onUnauthorized();

  const data = await parseBody(response);
  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(data, `Request failed with status ${response.status}`),
      response.status,
      data,
      response.headers.get(HEADERS.requestId) ?? id,
    );
  }
  return data as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => send<T>('GET', path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => send<T>('POST', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => send<T>('PUT', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => send<T>('PATCH', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => send<T>('DELETE', path, undefined, options),
};
