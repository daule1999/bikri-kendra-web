'use client';

import { isProductionEnv, useRuntimeConfig } from '@/core/config';
import { EnvironmentBadge } from './EnvironmentBadge';

/** Footer stamp: bare version on production, "QA · version" badge elsewhere. */
export function EnvironmentStamp() {
  const cfg = useRuntimeConfig();
  return isProductionEnv(cfg) ? <span>{cfg.version}</span> : <EnvironmentBadge />;
}
