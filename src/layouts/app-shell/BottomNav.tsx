'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/core/auth';
import { Icon } from '@/shared/ui';
import { cn } from '@/shared/lib/cn';
import { useNavigation } from './use-navigation';

const PRIMARY_SLOTS = 4;

/** Mobile bottom navigation: first 4 items + a "More" pop-up for the rest and logout. */
export function BottomNav() {
  const { items, isActive } = useNavigation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  const primary = items.slice(0, PRIMARY_SLOTS);
  const overflow = items.slice(PRIMARY_SLOTS);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-line bg-surface px-4 pt-2 shadow-overlay md:hidden" aria-label="Main">
      {primary.map((item) => {
        const active = isActive(item);
        return (
          <Link key={item.key} href={item.href} aria-current={active ? 'page' : undefined} className="flex min-w-16 flex-col items-center gap-1 p-2">
            <span className={cn('rounded-control p-1.5 transition-colors', active ? 'tone-indigo bg-tone-soft text-tone' : 'text-fg-faint')}><Icon name={item.icon} /></span>
            <span className={cn('text-[10px] font-semibold tracking-wide', active ? 'text-brand' : 'text-fg-muted')}>{item.navLabel ?? item.label}</span>
          </Link>
        );
      })}

      <div className="relative flex min-w-16 flex-col items-center gap-1 p-2">
        <button onClick={() => setOpen((v) => !v)} aria-label="More navigation options" aria-expanded={open} className="flex flex-col items-center gap-1">
          <span className="rounded-control p-1.5 text-fg-faint"><Icon name="menu" /></span>
          <span className="text-[10px] font-semibold tracking-wide text-fg-muted">More</span>
        </button>
        {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />}
        <div className={cn(
          'absolute bottom-full right-0 z-50 mb-2 flex w-48 flex-col overflow-hidden rounded-card border border-line bg-surface p-2 shadow-overlay transition-all',
          open ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}>
          <p className="mb-1 border-b border-line px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-fg-faint">Menu</p>
          {overflow.map((item) => (
            <Link key={item.key} href={item.href}
              className={cn('flex items-center gap-3 rounded-control p-3 text-sm font-semibold', isActive(item) ? 'tone-indigo bg-tone-soft text-tone' : 'text-fg-secondary hover:bg-surface-hover')}>
              <Icon name={item.icon} />{item.navLabel ?? item.label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-control p-3 text-left text-sm font-semibold text-danger hover:bg-danger-bg">
            <Icon name="logout" />Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
