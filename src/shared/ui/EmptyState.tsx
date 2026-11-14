import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function EmptyState({ icon = 'info', title, description, action }: {
  icon?: IconName; title: ReactNode; description?: ReactNode; action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-10 text-center">
      <Icon name={icon} size="2xl" strokeWidth={1.5} className="mx-auto mb-3 text-fg-faint" />
      <p className="font-medium text-fg-secondary">{title}</p>
      {description && <p className="mt-1 text-sm text-fg-faint">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function AccessDenied() {
  return <EmptyState icon="lock" title="You don't have access to this page" description="Contact your administrator to get access." />;
}
