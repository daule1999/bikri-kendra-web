import Link from 'next/link';
import type { FeatureDefinition } from '@/core/features';
import { Badge, Card, Icon, IconBadge, toneClass } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';

/** One dashboard tile, fully driven by a feature manifest. */
export function ModuleCard({ feature }: { feature: FeatureDefinition }) {
  const available = feature.status === 'available';

  const content = (
    <Card interactive={available} className={cn(toneClass(feature.tone), 'group h-full border-tone-line')}>
      <IconBadge icon={feature.icon} tone={feature.tone} className="mb-4 transition-transform duration-200 group-hover:scale-110" />
      <h3 className="mb-1.5 text-base font-semibold text-fg">{feature.label}</h3>
      <p className="mb-4 text-sm leading-relaxed text-fg-muted">{feature.description}</p>
      {available ? (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-tone transition-all group-hover:gap-2.5">
          Open <Icon name="chevronRight" size="xs" strokeWidth={2.5} />
        </span>
      ) : (
        <Badge tone={feature.tone}>Coming soon</Badge>
      )}
      <span aria-hidden className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-card bg-tone opacity-0 transition-opacity group-hover:opacity-100" />
    </Card>
  );

  return available ? <Link href={feature.href} className="block">{content}</Link> : <div aria-disabled="true">{content}</div>;
}
