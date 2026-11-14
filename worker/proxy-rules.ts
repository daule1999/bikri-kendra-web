/**
 * THE ONLY PLACE that knows how public /api/* paths map to backend services.
 *
 * Each rule rewrites a public prefix to a backend prefix; the rest of the path
 * and the query string are carried over unchanged. Matching is on whole path
 * segments ("/api/shops" never matches "/api/shops-staff"), and the first
 * matching rule wins, so list more specific prefixes first.
 *
 * Anything that matches no rule is rejected with 404 — this is an allowlist,
 * not an open proxy.
 *
 * Adding an endpoint under an existing prefix needs ZERO changes.
 * Adding a new backend service is ONE line here.
 */
export interface ProxyRule {
  /** Public path prefix the browser calls. */
  from: string;
  /** Backend path prefix it is rewritten to (appended to BACKEND_URL). */
  to: string;
  /** Skip forwarding the Authorization header (public endpoints such as login). */
  public?: boolean;
}

export const PROXY_RULES: readonly ProxyRule[] = [
  // ── auth-svc ──────────────────────────────────────────────
  { from: '/api/login',          to: '/api/auth-svc/login', public: true },
  { from: '/api/auth/refresh',   to: '/api/auth-svc/refresh', public: true },
  { from: '/api/auth',           to: '/api/auth-svc' },

  // ── users-svc ─────────────────────────────────────────────
  { from: '/api/users-role',     to: '/api/users-svc/users-role' },
  { from: '/api/users',          to: '/api/users-svc' },
  { from: '/api/roles',          to: '/api/users-svc/roles' },

  // ── inventory-svc ─────────────────────────────────────────
  { from: '/api/categories',     to: '/api/inventory-svc/categories' },
  { from: '/api/products',       to: '/api/inventory-svc/products' },
  { from: '/api/inventory',      to: '/api/inventory-svc' },

  // ── billing-svc ───────────────────────────────────────────
  { from: '/api/billing',        to: '/api/billing-svc' },

  // ── sales-svc ─────────────────────────────────────────────
  { from: '/api/invoice/next-number', to: '/api/sales-svc/retail/next-invoice' },
  { from: '/api/sales',          to: '/api/sales-svc' },        // sales/retail/*, sales/events/*
  { from: '/api/events',         to: '/api/sales-svc/events' },
  { from: '/api/shops-staff',    to: '/api/sales-svc/shops-staff' },
  { from: '/api/shops',          to: '/api/sales-svc/shops' },
  { from: '/api/shifts',         to: '/api/sales-svc/shifts' },
  { from: '/api/reports',        to: '/api/sales-svc/reports' },
  { from: '/api/page-init',      to: '/api/sales-svc/page-init' },

  // ── legacy (EventManagement used a separate NEXT_PUBLIC_BACKEND_URL for these) ──
  { from: '/api/retail',         to: '/api/retail' },
];

/** Returns the matching rule and the rewritten backend path, or null. */
export function resolveRule(pathname: string): { rule: ProxyRule; backendPath: string } | null {
  for (const rule of PROXY_RULES) {
    if (pathname === rule.from || pathname.startsWith(rule.from + '/')) {
      return { rule, backendPath: rule.to + pathname.slice(rule.from.length) };
    }
  }
  return null;
}
