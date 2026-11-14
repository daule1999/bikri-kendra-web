/**
 * Active event (tenant). Sent as X-Event-Id on every API call by the HTTP client.
 * PHASE 1 COMPAT: uses EventManagement's keys (shared with lib/event.ts and the
 * legacy Redux auth slice).
 */
export interface ActiveEvent { id: string; name: string }

const ID_KEY = 'active_event_id';
const NAME_KEY = 'active_event_name';

export const activeEventStore = {
  get(): ActiveEvent | null {
    if (typeof window === 'undefined') return null;
    const id = localStorage.getItem(ID_KEY);
    return id ? { id, name: localStorage.getItem(NAME_KEY) ?? '' } : null;
  },
  set(event: ActiveEvent) {
    localStorage.setItem(ID_KEY, event.id);
    localStorage.setItem(NAME_KEY, event.name);
  },
  clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ID_KEY);
    localStorage.removeItem(NAME_KEY);
  },
};
