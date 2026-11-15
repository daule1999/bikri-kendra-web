/**
 * Superseded: the Worker refreshes the session transparently (worker/auth.ts), the browser holds
 * no tokens. Kept as an inert stub so any stale import still compiles.
 */
export const REFRESH_INTERVAL_MS = 0;
export type CheckResult = 'skip';
export async function checkAndRefresh(): Promise<CheckResult> {
  return 'skip';
}
