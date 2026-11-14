/** Every in-app URL. Trailing slashes match next.config `trailingSlash: true`. */
export const ROUTES = {
  login: '/',
  dashboard: '/dashboard/',
  selectEvent: '/select-event/',
  changePassword: '/user/security/',
  users: '/user/',
  inventory: '/inventory/',
  sales: '/sales/',
  reports: '/reports/',
  shops: '/shops/',
  shifts: '/shifts/',
  events: '/events/',
  billing: '/billing/',
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/** Normalises a pathname for comparisons ("/dashboard" and "/dashboard/" are the same page). */
export const normalizePath = (p: string) => (p.endsWith('/') ? p : `${p}/`);
