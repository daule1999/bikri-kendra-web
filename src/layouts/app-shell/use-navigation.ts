'use client';

import { usePathname } from 'next/navigation';
import { isWithinPath } from '@/core/config';
import { useVisibleFeatures, type FeatureDefinition } from '@/core/features';
import { FEATURES } from '@/features';

/** Nav items = registered features the user may see, flagged as active for the current path. */
export function useNavigation() {
  const pathname = usePathname();
  const items = useVisibleFeatures(FEATURES).filter((f) => f.showInNav !== false);
  const isActive = (f: FeatureDefinition) => isWithinPath(pathname, f.href);
  const current = items.find(isActive);
  return { items, isActive, current };
}
