/** Every in-app URL — identical to EventManagement's (no trailing slash). */
export const ROUTES = {
  login: '/',
  dashboard: '/dashboard',
  selectEvent: '/select-event',
  changePassword: '/user/security',
  users: '/user',
  inventory: '/inventory',
  sales: '/sales',
  reports: '/reports',
  shops: '/shops',
  shifts: '/shifts',
  events: '/events',
  billing: '/billing',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** Canonical form for comparisons: always ends with "/" ("/dashboard" ≡ "/dashboard/"). */
export const normalizePath = (p: string) => (p.endsWith('/') ? p : `${p}/`);

/** Same page? */
export const isSamePath = (a: string, b: string) => normalizePath(a) === normalizePath(b);

/** Is `pathname` `base` or below it? Segment-aware: "/user" never matches "/users". */
export const isWithinPath = (pathname: string, base: string) => normalizePath(pathname).startsWith(normalizePath(base));
