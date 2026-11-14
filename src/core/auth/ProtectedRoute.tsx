'use client';

import { useEffect, type ComponentType, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ROUTES, normalizePath } from '@/core/config';
import { FullPageSpinner, AccessDenied } from '@/shared/ui';
import { useAuth, useHasPermission, type PermissionRequirement } from './hooks';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Optional page-level permission. Signed-in users without it see `fallback`. */
  permission?: PermissionRequirement;
  fallback?: ReactNode;
}

/**
 * Page-level guard.
 * - not signed in          → redirect to login
 * - must reset password    → redirect to the change-password page
 * - missing `permission`   → render AccessDenied (or `fallback`)
 *
 * This is a UX guard for a static site; the backend remains the real authority.
 */
export function ProtectedRoute({ children, permission, fallback }: ProtectedRouteProps) {
  const { isReady, isAuthenticated, user } = useAuth();
  const allowed = useHasPermission(permission);
  const router = useRouter();
  const pathname = normalizePath(usePathname());

  const mustReset = !!user?.mustResetPassword && pathname !== ROUTES.changePassword;

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) router.replace(ROUTES.login);
    else if (mustReset) router.replace(ROUTES.changePassword);
  }, [isReady, isAuthenticated, mustReset, router]);

  if (!isReady || !isAuthenticated || mustReset) return <FullPageSpinner />;
  if (!allowed) return <>{fallback ?? <AccessDenied />}</>;
  return <>{children}</>;
}

/** Inverse guard for the login page: signed-in users are sent to the dashboard. */
export function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { isReady, isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (isReady && isAuthenticated) router.replace(ROUTES.dashboard);
  }, [isReady, isAuthenticated, router]);
  if (isReady && isAuthenticated) return <FullPageSpinner />;
  return <>{children}</>;
}

/** HOC form: export default withPermission(ReportsPage, PERMISSIONS.reportsView) */
export function withPermission<P extends object>(Component: ComponentType<P>, permission?: PermissionRequirement) {
  const Guarded = (props: P) => (
    <ProtectedRoute permission={permission}>
      <Component {...props} />
    </ProtectedRoute>
  );
  Guarded.displayName = `withPermission(${Component.displayName || Component.name || 'Component'})`;
  return Guarded;
}
