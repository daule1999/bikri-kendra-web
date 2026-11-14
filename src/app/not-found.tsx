'use client';

import { ROUTES } from '@/core/config';
import { AppShell } from '@/layouts/app-shell';
import { ButtonLink, EmptyState } from '@/shared/ui';

/** Unknown URLs land here (Cloudflare serves 404.html). */
export default function NotFound() {
  return (
    <AppShell>
      <div className="mx-auto max-w-xl py-10">
        <EmptyState
          icon="info"
          title="Page not found"
          description="This page doesn't exist or has moved."
          action={<ButtonLink href={ROUTES.dashboard} variant="secondary" size="sm">← Back to Dashboard</ButtonLink>}
        />
      </div>
    </AppShell>
  );
}
