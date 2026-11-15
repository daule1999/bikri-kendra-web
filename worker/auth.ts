import type { Env } from './types';
import { claimsOf, readSession, tokenExpiryMs, toPublic, clearCookies, sessionCookies, type SessionData } from './session';

/** Per-request session state; the final response gets Set-Cookie if it changed. */
export class AuthState {
  changed = false;
  cleared = false;
  constructor(public session: SessionData | null) {}

  static async from(request: Request, env: Env): Promise<AuthState> {
    return new AuthState(await readSession(request, env.SESSION_SECRET));
  }

  /** Adds Set-Cookie headers to `res` when the session was created, refreshed or cleared. */
  async apply(res: Response, env: Env, secure: boolean): Promise<Response> {
    if (!this.cleared && !(this.changed && this.session)) return res;
    const out = new Response(res.body, res);
    const cookies = this.cleared || !this.session ? clearCookies(secure) : await sessionCookies(this.session, env.SESSION_SECRET!, secure);
    for (const c of cookies) out.headers.append('set-cookie', c);
    return out;
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const backendOrigin = (env: Env) => (env.BACKEND_URL || '').replace(/\/+$/, '');
const REFRESH_SKEW_MS = 20_000;

/** Exchanges the refresh token for a new access token (auth-service does not rotate refresh tokens). */
export async function refreshSession(env: Env, auth: AuthState): Promise<boolean> {
  const s = auth.session;
  if (!s) return false;
  try {
    const res = await fetch(`${backendOrigin(env)}/api/auth-svc/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }),
    });
    if (res.ok) {
      const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
      if (data.accessToken) {
        auth.session = { ...s, accessToken: data.accessToken, refreshToken: data.refreshToken || s.refreshToken };
        auth.changed = true;
        return true;
      }
    }
    if (res.status === 401 || res.status === 403) { auth.session = null; auth.cleared = true; } // refresh token dead → logged out
  } catch { /* backend unreachable: keep the session, caller reports 502/401 */ }
  return false;
}

/** A usable access token, refreshing first when it is about to expire. Null = not authenticated. */
export async function accessTokenFor(env: Env, auth: AuthState): Promise<string | null> {
  if (!auth.session) return null;
  if (tokenExpiryMs(auth.session.accessToken) - Date.now() <= REFRESH_SKEW_MS && !(await refreshSession(env, auth))) {
    // refresh failed: a still-valid token can be used one more time
    return auth.session && tokenExpiryMs(auth.session.accessToken) > Date.now() ? auth.session.accessToken : null;
  }
  return auth.session?.accessToken ?? null;
}

/**
 * fetch() to the backend as the signed-in user. Retries once after a refresh on 401 and
 * folds a sliding `X-New-Access-Token` into the session. `body` must be re-sendable.
 */
export async function authedFetch(env: Env, auth: AuthState, url: string, init: RequestInit & { headers: Headers }): Promise<Response> {
  let token = await accessTokenFor(env, auth);
  if (!token) return json(401, { error: 'Not authenticated' });
  const send = (t: string) => { const h = new Headers(init.headers); h.set('authorization', `Bearer ${t}`); return fetch(url, { ...init, headers: h }); };
  let res = await send(token);
  if (res.status === 401 && (await refreshSession(env, auth)) && auth.session) res = await send(auth.session.accessToken);
  const next = res.headers.get('x-new-access-token');
  if (next && auth.session && next !== auth.session.accessToken) { auth.session = { ...auth.session, accessToken: next }; auth.changed = true; }
  return res;
}

/** Login / session / logout endpoints. Returns null when the path is not an auth route. */
export async function handleAuthRoutes(request: Request, env: Env, url: URL, auth: AuthState): Promise<Response | null> {
  const key = `${request.method.toUpperCase()} ${url.pathname.replace(/\/+$/, '')}`;

  if (key === 'POST /api/login') {
    if (!env.SESSION_SECRET) return json(500, { error: 'Session not configured' });
    let creds: { username?: string; password?: string } = {};
    try { creds = await request.json(); } catch { return json(400, { error: 'Invalid JSON body' }); }
    let res: Response;
    try {
      res = await fetch(`${backendOrigin(env)}/api/auth-svc/login`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: creds.username, password: creds.password }),
      });
    } catch { return json(502, { error: 'Backend unreachable' }); }
    if (!res.ok) {
      const text = await res.text();
      return new Response(text, { status: res.status, headers: { 'content-type': res.headers.get('content-type') || 'text/plain' } });
    }
    const data = (await res.json()) as { accessToken: string; refreshToken: string; mustResetPassword?: boolean };
    const { role, userId } = claimsOf(data.accessToken);
    auth.session = {
      accessToken: data.accessToken, refreshToken: data.refreshToken, username: String(creds.username),
      role, userId, mustResetPassword: data.mustResetPassword === true,
    };
    auth.changed = true; auth.cleared = false;
    return json(200, toPublic(auth.session));
  }

  if (key === 'GET /api/session') {
    if (!(await accessTokenFor(env, auth)) || !auth.session) return json(401, { error: 'No session' });
    return json(200, toPublic(auth.session));
  }

  if (key === 'POST /api/auth/logout') {
    auth.session = null; auth.cleared = true;
    return json(200, { ok: true });
  }

  // Tokens are never handed to the browser, so there is nothing for it to refresh.
  if (url.pathname === '/api/auth/refresh') return json(404, { error: 'Unknown API route', path: url.pathname });

  return null;
}
