'use client';

import Link from 'next/link';
import { APP, ROUTES } from '@/core/config';
import { useAuth } from '@/core/auth';
import { EnvironmentBadge, Icon } from '@/shared/ui';
import { useNavigation } from './use-navigation';
import { UserAvatar } from './UserAvatar';

/** Title comes from the active feature's manifest — no separate page-title map. */
export function Topbar({ title }: { title?: string }) {
  const { current } = useNavigation();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface px-3 shadow-card sm:h-topbar sm:px-5 lg:px-6">
      <div className="mr-3 min-w-0 flex-1 overflow-hidden">
        <h2 className="truncate text-sm font-semibold leading-tight text-fg sm:text-base">{title ?? current?.label ?? APP.name}</h2>
        <p className="mt-0.5 hidden text-xs leading-tight text-fg-muted sm:block">{APP.name} · {APP.org}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
        <EnvironmentBadge />
        <div className="flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2 py-1 sm:gap-2 sm:px-3 sm:py-1.5">
          <UserAvatar username={user?.username} className="h-6 w-6 text-xs" />
          <span className="hidden max-w-[100px] truncate text-sm font-medium text-fg-secondary sm:block">{user?.username ?? 'User'}</span>
          {user?.role && <span className="tone-indigo hidden rounded-full bg-tone-soft px-1.5 py-0.5 text-xs font-medium text-tone lg:block">{user.role}</span>}
        </div>
        <Link href={ROUTES.dashboard} title="Go to dashboard" aria-label="Go to dashboard" className="rounded-control p-2 text-fg-muted hover:bg-black/5">
          <Icon name="home" />
        </Link>
      </div>
    </header>
  );
}
