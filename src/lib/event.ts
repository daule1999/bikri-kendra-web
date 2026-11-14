import { X_EVENT_ID_HEADER } from './constants';

/**
 * Event context utilities for the EventManagement frontend.
 * Manages the active event selection stored in localStorage
 * and sends it as the X-Event-Id header on all API requests.
 */

export const EVENT_STORAGE_KEY = 'active_event_id';
export const EVENT_NAME_STORAGE_KEY = 'active_event_name';

export const ACTIVE_EVENT_ID_KEY = 'active_event_id';
export const ACTIVE_EVENT_NAME_KEY = 'active_event_name';

export interface EventSummary {
  id: number;
  eventName: string;
  eventType?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
}

/**
 * Stores the selected event in localStorage.
 */
export function setActiveEvent(event: EventSummary): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(EVENT_STORAGE_KEY, String(event.id));
  localStorage.setItem(ACTIVE_EVENT_ID_KEY, String(event.id));
  localStorage.setItem(EVENT_NAME_STORAGE_KEY, event.eventName);
  localStorage.setItem(ACTIVE_EVENT_NAME_KEY, event.eventName);
}

/**
 * Reads the active event ID from localStorage.
 * Returns null if no event has been selected yet.
 */
export function getActiveEventId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_EVENT_ID_KEY) || localStorage.getItem(EVENT_STORAGE_KEY);
}

/**
 * Reads the active event display name from localStorage.
 */
export function getActiveEventName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(ACTIVE_EVENT_NAME_KEY) || localStorage.getItem(EVENT_NAME_STORAGE_KEY) || 'No Event Selected';
}

/**
 * Clears the active event selection from localStorage.
 * Called on logout or when the user wants to re-select an event.
 */
export function clearActiveEvent(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(EVENT_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_EVENT_ID_KEY);
  localStorage.removeItem(EVENT_NAME_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_EVENT_NAME_KEY);
}

/**
 * Checks if an event has been selected.
 */
export function hasActiveEvent(): boolean {
  return getActiveEventId() !== null;
}

/**
 * Returns the X-Event-Id header object for use in API requests.
 * Returns an empty object if no event is selected.
 */
export function getEventHeader(): Record<string, string> {
  const eventId = getActiveEventId();
  return eventId ? { [X_EVENT_ID_HEADER]: eventId } : {};
}


