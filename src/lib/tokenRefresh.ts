/** Superseded by core/auth/auth-service (single-flight refresh). Kept as a thin re-export. */
import { authService } from '@/core/auth/auth-service';
import { SESSION_TIMING } from '@/core/config';

export const REFRESH_INTERVAL_MS = SESSION_TIMING.refreshCheckIntervalMs;
export type CheckResult = { accessToken: string; refreshToken?: string } | 'skip' | 'expired';
export async function checkAndRefresh(): Promise<CheckResult> {
  await authService.refreshIfStale();
  return 'skip';
}
