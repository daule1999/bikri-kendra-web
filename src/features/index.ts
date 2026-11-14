import type { FeatureDefinition } from '@/core/features';
import { dashboardFeature } from './dashboard/feature';
import { UPCOMING_FEATURES } from './upcoming';

/**
 * FEATURE REGISTRY — the only list of modules in the app.
 * Sidebar, bottom nav, topbar titles and dashboard cards all read from here.
 *
 * To add a feature: create features/<name>/ with a feature.ts manifest,
 * add ONE line below, and add the route file under src/app/<route>/page.tsx.
 * No shared component changes.
 */
export const FEATURES: readonly FeatureDefinition[] = [
  dashboardFeature,
  ...UPCOMING_FEATURES,
];
