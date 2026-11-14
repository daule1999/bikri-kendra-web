'use client';

import { useMemo } from 'react';
import { usePermissions, type PermissionRequirement } from '@/core/auth';
import type { FeatureDefinition } from './types';

/** Filters a feature list down to what the current user may see. */
export function useVisibleFeatures(features: readonly FeatureDefinition[]) {
  const { can, canAny, canAll, permissions } = usePermissions();
  return useMemo(() => {
    const allowed = (req?: PermissionRequirement) =>
      !req ? true : typeof req === 'string' ? can(req) : 'anyOf' in req ? canAny(req.anyOf) : canAll(req.allOf);
    return [...features].filter((f) => allowed(f.permission)).sort((a, b) => a.order - b.order);
  }, [features, permissions]); // eslint-disable-line react-hooks/exhaustive-deps
}
