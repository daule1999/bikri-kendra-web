import { STORAGE_KEYS } from '@/core/config';
import type { Session } from './types';

/**
 * localStorage-backed session store with a subscribe API, consumed by React via
 * useSyncExternalStore. Also syncs across tabs (logout in one tab logs out all).
 */
type Listener = () => void;
const listeners = new Set<Listener>();
let cached: Session | null | undefined;

const isBrowser = () => typeof window !== 'undefined';

function read(): Session | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.session);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

const emit = () => listeners.forEach((l) => l());

export const sessionStore = {
  get(): Session | null {
    if (cached === undefined) cached = read();
    return cached;
  },
  set(session: Session) {
    cached = session;
    localStorage.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    emit();
  },
  update(patch: Partial<Session>) {
    const current = sessionStore.get();
    if (current) sessionStore.set({ ...current, ...patch });
  },
  clear() {
    cached = null;
    if (isBrowser()) localStorage.removeItem(STORAGE_KEYS.session);
    emit();
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.session) { cached = read(); listener(); }
    };
    if (isBrowser()) window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      if (isBrowser()) window.removeEventListener('storage', onStorage);
    };
  },
};
