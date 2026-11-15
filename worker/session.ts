import { decodeJwtPayload } from '../src/core/auth/token';
import { decryptText, encryptText } from '../src/core/crypto/payload-crypto';

/**
 * Server-side session. The browser never sees the tokens: they are sealed
 * (AES-256-GCM, key = SESSION_SECRET) into HttpOnly cookies that only this Worker can read.
 * The sealed value is split over several cookies to stay under the 4 KB per-cookie limit.
 */
export interface SessionData {
  accessToken: string;
  refreshToken: string;
  username: string;
  role: string;
  userId: number | null;
  mustResetPassword: boolean;
}

/** What the browser is allowed to know. */
export interface PublicSession {
  username: string;
  role: string;
  userId: number | null;
  mustResetPassword: boolean;
}

const COOKIE = 'bk_s';
const CHUNK_SIZE = 3500;
const MAX_CHUNKS = 6;
const DEFAULT_MAX_AGE_S = 7 * 24 * 3600;
const MAX_AGE_CAP_S = 30 * 24 * 3600;

export const toPublic = (s: SessionData): PublicSession => ({
  username: s.username, role: s.role, userId: s.userId, mustResetPassword: s.mustResetPassword,
});

/** Access-token expiry in epoch ms (0 when unreadable → treated as expired). */
export function tokenExpiryMs(token: string): number {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : 0;
}

/** Role/userId live in the JWT (auth-service puts `roles` and `userId` claims in it). */
export function claimsOf(accessToken: string): { role: string; userId: number | null } {
  const c = decodeJwtPayload(accessToken) ?? {};
  const roles = Array.isArray(c.roles) ? c.roles : c.role ? [c.role] : [];
  const first = roles[0];
  const role = first == null ? 'USER' : String(typeof first === 'object' ? (first as { name?: string }).name ?? 'USER' : first);
  const userId = c.userId == null || Number.isNaN(Number(c.userId)) ? null : Number(c.userId);
  return { role, userId };
}

function parseCookies(header: string | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
  }
  return out;
}

const toUrlSafe = (b64: string) => b64.replace(/\+/g, '-').replace(/\//g, '_');
const fromUrlSafe = (s: string) => s.replace(/-/g, '+').replace(/_/g, '/');

export async function readSession(request: Request, secret: string | undefined): Promise<SessionData | null> {
  if (!secret) return null;
  const jar = parseCookies(request.headers.get('cookie'));
  let sealed = '';
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const part = jar.get(`${COOKIE}${i}`);
    if (!part) break;
    sealed += part;
  }
  if (!sealed) return null;
  try {
    const s = JSON.parse(await decryptText(fromUrlSafe(sealed), secret)) as SessionData;
    return s.accessToken && s.refreshToken && s.username ? s : null;
  } catch {
    return null; // tampered, wrong key, or old format
  }
}

const attrs = (secure: boolean, maxAge: number) =>
  `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;

/** Set-Cookie values that store (or replace) the session. */
export async function sessionCookies(session: SessionData, secret: string, secure: boolean): Promise<string[]> {
  const sealed = toUrlSafe(await encryptText(JSON.stringify(session), secret));
  const chunks: string[] = [];
  for (let i = 0; i < sealed.length; i += CHUNK_SIZE) chunks.push(sealed.slice(i, i + CHUNK_SIZE));
  if (chunks.length > MAX_CHUNKS) throw new Error('Session too large');

  const refreshExp = tokenExpiryMs(session.refreshToken);
  const maxAge = refreshExp
    ? Math.min(MAX_AGE_CAP_S, Math.max(60, Math.floor((refreshExp - Date.now()) / 1000)))
    : DEFAULT_MAX_AGE_S;

  const cookies = chunks.map((c, i) => `${COOKIE}${i}=${c}; ${attrs(secure, maxAge)}`);
  for (let i = chunks.length; i < MAX_CHUNKS; i++) cookies.push(`${COOKIE}${i}=; ${attrs(secure, 0)}`); // drop leftovers
  return cookies;
}

export function clearCookies(secure: boolean): string[] {
  return Array.from({ length: MAX_CHUNKS }, (_, i) => `${COOKIE}${i}=; ${attrs(secure, 0)}`);
}
