/** App-wide constants. Anything a page would otherwise hardcode lives here. */
export const APP = {
  name: 'Bikri Kendra',
  org: 'Vihangam Yoga',
  tagline: 'Vihangam Yoga · Shop Management',
  title: 'Bikri Kendra - Vihangam Yoga',
  description: 'Sales and inventory management system for Vihangam Yoga centers',
  locale: 'en-IN',
} as const;

/** All browser API calls go to the same-origin proxy (worker/). Never a backend URL. */
export const API_BASE_PATH = '/api';

export const HEADERS = {
  eventId: 'X-Event-Id',
  requestId: 'X-Request-Id',
} as const;

export const SESSION_TIMING = {
  /** How often the background refresher checks the access token. */
  refreshCheckIntervalMs: 20 * 60 * 1000,
  /** Refresh when less than this much lifetime remains. */
  refreshThresholdMs: 30 * 60 * 1000,
} as const;
