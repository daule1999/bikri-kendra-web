/**
 * Tiny cookie helpers — no external dependency.
 *
 * These cookies carry no auth weight themselves and are NEVER sent to the
 * backend or used to authorize an API call (the real JWT stays in
 * localStorage, read by lib/api.ts exactly as before). They exist purely so
 * middleware.ts can make a redirect decision on the server, before any HTML
 * is generated, instead of the old approach of blocking client-side render
 * on a useEffect (see RouteGuard.tsx).
 *
 * Not marked Secure because this app is deployed over plain HTTP on a local
 * LAN (server.ssl.enabled: false across every backend service) — a Secure
 * cookie would silently be dropped by the browser in that setup.
 */

const SEVEN_DAYS_SECONDS = 60 * 60 * 24 * 7;

export function setBooleanCookie(name: string, value: boolean): void {
  if (typeof document === 'undefined') return;
  if (value) {
    document.cookie = `${name}=1; Path=/; Max-Age=${SEVEN_DAYS_SECONDS}; SameSite=Lax`;
  } else {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

/**
 * For non-sensitive display strings only (e.g. username, role label) — NEVER
 * the access/refresh token. These are read server-side in app/layout.tsx to
 * seed Redux's initial auth state during SSR, purely so the first render
 * shows the right username/role instead of a blank flash. The actual bearer
 * token stays exclusively in localStorage and is never mirrored into a
 * cookie, since store/services/baseQuery.ts uses Redux's accessToken field
 * as a real credential — a cookie-sourced placeholder there would be a
 * correctness/security hazard, not just cosmetic.
 */
export function setStringCookie(name: string, value: string | null): void {
  if (typeof document === 'undefined') return;
  if (value) {
    document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${SEVEN_DAYS_SECONDS}; SameSite=Lax`;
  } else {
    document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}
