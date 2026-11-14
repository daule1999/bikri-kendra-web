'use client';

/**
 * PHASE 1 COMPAT — guard for standalone legacy pages that render without the app
 * chrome (event picker, change password, full-screen reports). In EventManagement
 * these were protected by server middleware, which doesn't exist on a static site.
 */
import type { ReactNode } from 'react';
import { ProtectedRoute, type PermissionRequirement } from '@/core/auth';

export default function AuthOnlyLayout({ children, permission }: { children: ReactNode; permission?: PermissionRequirement }) {
  return <ProtectedRoute permission={permission}>{children}</ProtectedRoute>;
}
