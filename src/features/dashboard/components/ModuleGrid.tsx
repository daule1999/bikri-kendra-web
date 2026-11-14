import type { FeatureDefinition } from '@/core/features';
import { EmptyState } from '@/shared/ui';
import { ModuleCard } from './ModuleCard';

export function ModuleGrid({ features }: { features: readonly FeatureDefinition[] }) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-fg-muted">Quick Access</h2>
      {features.length === 0 ? (
        <EmptyState icon="lock" title="No modules available" description="Contact your administrator to get access" />
      ) : (
        <div className="stagger-children grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {features.map((f) => <ModuleCard key={f.key} feature={f} />)}
        </div>
      )}
    </section>
  );
}
