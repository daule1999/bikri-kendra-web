'use client';

import { usePathname } from 'next/navigation';
import { normalizePath } from '@/core/config';
import { useVisibleFeatures, type FeatureDefinition } from '@/core/features';
import { FEATURES } from '@/features';

/** Nav items = registered features the user may see, flagged as active for the current path. */
export function useNavigation() {
  const pathname = normalizePath(usePathname());
  const items = useVisibleFeatures(FEATURES).filter((f) => f.showInNav !== false);
  const isActive = (f: FeatureDefinition) => pathname === f.href || pathname.startsWith(f.href);
  const current = items.find(isActive);
  return { items, isActive, current };
}
