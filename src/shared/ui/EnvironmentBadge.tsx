import { BUILD_INFO, isProduction } from '@/core/config';
import { Badge } from './Badge';

/** Shows "QA · v1.2.0-rc1" on non-production builds so testers never confuse instances. */
export function EnvironmentBadge({ className }: { className?: string }) {
  if (isProduction) return null;
  return (
    <Badge tone={BUILD_INFO.environment === 'qa' ? 'orange' : 'slate'} className={className}>
      <span title={BUILD_INFO.commit || undefined}>{BUILD_INFO.environment.toUpperCase()} · {BUILD_INFO.version}</span>
    </Badge>
  );
}
