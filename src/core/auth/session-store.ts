import type { Session } from './types';

/**
 * localStorage-backed session store with a subscribe API (useSyncExternalStore).
 *
 * PHASE 1 COMPAT: the session is stored under the same keys EventManagement used
 * (accessToken, refreshToken, username, userRole, mustResetPassword) because the
 * ported pages and the legacy Redux auth slice read them directly. When the last
 * legacy page is refactored, switch to a single namespaced key.
 */
const KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  username: 'username',
  role: 'userRole',
  mustResetPassword: 'mustResetPassword',
} as const;

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
  cached = v.accessToken && v.username
    ? {
        accessToken: v.accessToken,
        refreshToken: v.refreshToken ?? '',
        username: v.username,
        role: v.role ?? 'USER',
        mustResetPassword: v.mustResetPassword === 'true',
      }
    : null;
  return cached;
}

const emit = () => listeners.forEach((l) => l());

export const sessionStore = {
  get: read,
  set(session: Session) {
    localStorage.setItem(KEYS.accessToken, session.accessToken);
    localStorage.setItem(KEYS.refreshToken, session.refreshToken);
    localStorage.setItem(KEYS.username, session.username);
    localStorage.setItem(KEYS.role, String(session.role));
    localStorage.setItem(KEYS.mustResetPassword, String(session.mustResetPassword));
    emit();
  },
  update(patch: Partial<Session>) {
    const current = read();
    if (current) sessionStore.set({ ...current, ...patch });
  },
  clear() {
    if (isBrowser()) Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
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
