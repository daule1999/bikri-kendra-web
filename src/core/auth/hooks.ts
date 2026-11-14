'use client';

import { useContext } from 'react';
import { AuthContext } from './AuthProvider';
import type { Permission } from './permissions';

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Permission checks for components. Pass a single permission or a list. */
export function usePermissions() {
  const { permissions, user } = useAuth();
  const can = (p: Permission) => permissions.has(p);
  return {
    role: user?.role ?? null,
    permissions,
    can,
    canAny: (ps: readonly Permission[]) => ps.some(can),
    canAll: (ps: readonly Permission[]) => ps.every(can),
  };
}

export type PermissionRequirement = Permission | { anyOf: readonly Permission[] } | { allOf: readonly Permission[] };

/** Evaluates a requirement object; used by <Can>, <ProtectedRoute>, withPermission and the feature registry. */
export function useHasPermission(requirement: PermissionRequirement | undefined): boolean {
  const { can, canAny, canAll } = usePermissions();
  if (!requirement) return true;
  if (typeof requirement === 'string') return can(requirement);
  if ('anyOf' in requirement) return canAny(requirement.anyOf);
  return canAll(requirement.allOf);
}
