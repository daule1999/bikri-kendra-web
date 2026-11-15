import type { Session } from './types';

/**
 * Client-side session HINT (localStorage) with a subscribe API (useSyncExternalStore).
 * It holds only non-secret identity data — username, role, userId, mustResetPassword — and a
 * `hasSession` marker. The real credentials are HttpOnly cookies owned by the Worker; the hint
 * is re-validated against GET /api/session on every page load (AuthProvider).
 *
 * PHASE 1 COMPAT: same keys EventManagement used (username, userRole, mustResetPassword) because
 * ported pages read them directly. accessToken / refreshToken keys no longer exist.
 */
const KEYS = {
  hasSession: 'hasSession',
  username: 'username',
  role: 'userRole',
  userId: 'userId',
  mustResetPassword: 'mustResetPassword',
} as const;

/** Keys written by earlier versions that stored tokens in the browser. */
const LEGACY_TOKEN_KEYS = ['accessToken', 'refreshToken'] as const;

type Listener = () => void;
const listeners = new Set<Listener>();
let cachedRaw = '';
let cached: Session | null = null;

const isBrowser = () => typeof window !== 'undefined';

function read(): Session | null {
  if (!isBrowser()) return null;
  const v = Object.fromEntries(Object.entries(KEYS).map(([k, key]) => [k, localStorage.getItem(key)])) as Record<keyof typeof KEYS, string | null>;
  const raw = JSON.stringify(v);
  if (raw === cachedRaw) return cached; // stable snapshot for React
  cachedRaw = raw;
  cached = v.hasSession === '1' && v.username
    ? {
        username: v.username,
        role: v.role ?? 'USER',
        userId: v.userId && !Number.isNaN(Number(v.userId)) ? Number(v.userId) : null,
        mustResetPassword: v.mustResetPassword === 'true',
      }
    : null;
  return cached;
}

const emit = () => listeners.forEach((l) => l());

export const sessionStore = {
  get: read,
  set(session: Session) {
    localStorage.setItem(KEYS.hasSession, '1');
    localStorage.setItem(KEYS.username, session.username);
    if (session.userId == null) localStorage.removeItem(KEYS.userId); else localStorage.setItem(KEYS.userId, String(session.userId));
    localStorage.setItem(KEYS.role, String(session.role));
    localStorage.setItem(KEYS.mustResetPassword, String(session.mustResetPassword));
    emit();
  },
  update(patch: Partial<Session>) {
    const current = read();
    if (current) sessionStore.set({ ...current, ...patch });
  },
  /** Removes tokens that older versions left in localStorage. */
  purgeLegacyTokens() {
    if (isBrowser()) LEGACY_TOKEN_KEYS.forEach((k) => localStorage.removeItem(k));
  },
  clear() {
    if (isBrowser()) [...Object.values(KEYS), ...LEGACY_TOKEN_KEYS].forEach((k) => localStorage.removeItem(k));
    emit();
  },
  /** Re-read storage and notify (for legacy code that writes localStorage directly). */
  sync: emit,
  subscribe(listener: Listener) {
    listeners.add(listener);
    const onStorage = () => listener();
    if (isBrowser()) window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      if (isBrowser()) window.removeEventListener('storage', onStorage);
    };
  },
};
