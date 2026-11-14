'use client';

import { ROUTES } from '@/core/config';
import { AppShell } from '@/layouts/app-shell';
import { ButtonLink, EmptyState } from '@/shared/ui';

/** Unmigrated modules land here (Cloudflare serves 404.html for unknown paths). */
export default function NotFound() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl py-10">
        <EmptyState
          icon="clock"
          title="Coming soon"
          description="This module hasn't been moved to the new app yet."
          action={<ButtonLink href={ROUTES.dashboard} variant="secondary" size="sm">← Back to Dashboard</ButtonLink>}
        />
      </div>
    </AppShell>
  );
}
