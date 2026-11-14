import { STORAGE_KEYS } from '@/core/config';

/** Active event (tenant). Sent as X-Event-Id on every API call by the HTTP client. */
export interface ActiveEvent { id: string; name: string }

export const activeEventStore = {
  get(): ActiveEvent | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.activeEvent);
      return raw ? (JSON.parse(raw) as ActiveEvent) : null;
    } catch {
      return null;
    }
  },
  set(event: ActiveEvent) { localStorage.setItem(STORAGE_KEYS.activeEvent, JSON.stringify(event)); },
  clear() { if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.activeEvent); },
};
