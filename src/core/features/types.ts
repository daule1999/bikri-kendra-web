import type { AppRoute } from '@/core/config';
import type { PermissionRequirement } from '@/core/auth';
import type { IconName, Tone } from '@/shared/ui';

/**
 * A feature's public manifest. The app shell (sidebar, bottom nav) and the
 * dashboard module grid are both generated from these — neither has its own list.
 */
export interface FeatureDefinition {
  key: string;
  label: string;
  /** Shorter label for the sidebar (defaults to `label`). */
  navLabel?: string;
  description: string;
  href: AppRoute;
  icon: IconName;
  tone: Tone;
  /** Who can see/open it. Omit = every signed-in user. */
  permission?: PermissionRequirement;
  /** 'coming-soon' = not migrated yet; shown but not clickable. */
  status: 'available' | 'coming-soon';
  /** Sort order in nav/dashboard (lower first). */
  order: number;
  /** Show as a module card on the dashboard. Default true. */
  showOnDashboard?: boolean;
  /** Show in sidebar / bottom nav. Default true. */
  showInNav?: boolean;
}

export const defineFeature = (f: FeatureDefinition) => f;
