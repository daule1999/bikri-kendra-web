'use client';

import Link from 'next/link';
import { APP, ROUTES } from '@/core/config';
import { useAuth } from '@/core/auth';
import { Icon } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { useNavigation } from './use-navigation';
import { useShellState } from './shell-state';
import { UserAvatar } from './UserAvatar';

/** Desktop/tablet sidebar. Items come from the feature registry. */
export function Sidebar() {
  const { sidebarCollapsed: collapsed, toggleSidebar } = useShellState();
  const { items, isActive } = useNavigation();
  const { user, logout } = useAuth();

  return (
    <aside className={cn(
      'fixed left-0 top-0 z-40 hidden h-full flex-col overflow-hidden border-r border-sidebar-line bg-sidebar transition-all duration-300 md:flex',
      'w-sidebar-collapsed', !collapsed && 'lg:w-sidebar',
    )}>
      {/* Brand */}
      <div className="flex h-topbar flex-shrink-0 items-center border-b border-sidebar-line px-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-control bg-gradient-accent text-on-accent">
          <Icon name="cart" strokeWidth={2} />
        </div>
        <div className={cn('ml-3 hidden overflow-hidden', !collapsed && 'lg:block')}>
          <p className="whitespace-nowrap text-sm font-bold leading-tight text-on-accent">{APP.name}</p>
          <p className="whitespace-nowrap text-xs text-sidebar-fg-muted">{APP.org}</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto py-4" aria-label="Main">
        <ul className="space-y-0.5 px-2">
          {items.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  title={item.navLabel ?? item.label}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    active ? 'bg-gradient-nav-active text-on-accent' : 'text-sidebar-fg hover:bg-sidebar-hover',
                  )}
                >
                  {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent" />}
                  <Icon name={item.icon} className={active ? undefined : 'text-sidebar-fg-muted'} />
                  <span className={cn('hidden truncate', !collapsed && 'lg:inline')}>{item.navLabel ?? item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User + logout */}
      <div className="flex-shrink-0 border-t border-sidebar-line p-3">
        <div className={cn('flex items-center gap-3 rounded-control p-2', !collapsed && 'lg:bg-sidebar-hover')}>
          <UserAvatar username={user?.username} className="h-8 w-8 text-xs" />
          <div className={cn('hidden flex-1 overflow-hidden', !collapsed && 'lg:block')}>
            <p className="truncate text-xs font-semibold text-on-accent">{user?.username ?? 'User'}</p>
            <p className="truncate text-xs text-sidebar-fg-muted">{user?.role ?? 'Guest'}</p>
          </div>
          <div className={cn('hidden items-center gap-1', !collapsed && 'lg:flex')}>
            <Link href={ROUTES.changePassword} title="Change password" className="rounded-sm p-1.5 text-sidebar-fg-muted hover:bg-white/10">
              <Icon name="key" size="sm" strokeWidth={2} />
            </Link>
            <button onClick={logout} title="Log out" className="rounded-sm p-1.5 text-sidebar-fg-muted hover:bg-danger/20">
              <Icon name="logout" size="sm" />
            </button>
          </div>
        </div>
        <button onClick={logout} title="Log out"
          className={cn('mt-2 flex w-full items-center justify-center rounded-control p-2 text-sidebar-fg-muted hover:bg-danger/20', !collapsed && 'lg:hidden')}>
          <Icon name="logout" size="sm" />
        </button>
      </div>

      {/* Collapse toggle (desktop only) */}
      <button onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className="absolute -right-3 top-20 z-50 hidden h-6 w-6 items-center justify-center rounded-full border-2 border-sidebar bg-accent text-on-accent shadow-raised transition-all hover:scale-110 lg:flex">
        <Icon name="chevronsLeft" size="sm" strokeWidth={2} className={cn('transition-transform duration-300', collapsed && 'rotate-180')} />
      </button>
    </aside>
  );
}
