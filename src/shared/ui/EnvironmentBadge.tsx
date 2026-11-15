'use client';

import { isProductionEnv, useRuntimeConfig } from '@/core/config';
import { Badge } from './Badge';

/** Shows "QA · v1.2.0-rc1" on non-production builds so testers never confuse instances. */
export function EnvironmentBadge({ className }: { className?: string }) {
  const cfg = useRuntimeConfig();
  if (isProductionEnv(cfg)) return null;
  return (
    <Badge tone={cfg.environment === 'qa' ? 'orange' : 'slate'} className={className}>
      <span title={cfg.commit || undefined}>{cfg.environment.toUpperCase()} · {cfg.version}</span>
    </Badge>
  );
}
