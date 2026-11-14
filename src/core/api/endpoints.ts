/**
 * Public API paths (relative to /api). These are what the browser calls; the
 * Worker's proxy-rules.ts maps them to backend services. Features add their own
 * endpoint constants inside their `api/` folder — this file only holds the
 * cross-cutting ones the core layer needs.
 */
export const CORE_ENDPOINTS = {
  login: '/login',
  refresh: '/auth/refresh',
  userByUsername: (username: string) => `/users/${encodeURIComponent(username)}`,
} as const;
