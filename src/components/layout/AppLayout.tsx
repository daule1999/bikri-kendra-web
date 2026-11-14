'use client';

/**
 * PHASE 1 COMPAT — legacy <AppLayout> used by ported pages.
 * Renders the new AppShell (auth guard, sidebar, topbar), applies the owning
 * feature's permission (features/upcoming.ts), and keeps EventManagement's
 * "an event must be selected" rule:
 *   - no event selected and none exist      → /events/ (onboarding)
 *   - no event selected but some exist      → /select-event/
 */
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { http } from '@/core/api';
import { useAuth, ProtectedRoute } from '@/core/auth';
import { ROUTES, isSamePath, isWithinPath } from '@/core/config';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { AppShell } from '@/layouts/app-shell';
import { FEATURES } from '@/features';
import { FullPageSpinner } from '@/shared/ui';

function useEventGate() {
  const { isReady, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'checking' | 'ok'>('checking');

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    if (activeEventStore.get()) { setState('ok'); return; }
    let cancelled = false;
    http.get<unknown>('/events')
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : ((data as { data?: unknown[] })?.data ?? []);
        if (list.length === 0) {
          if (isSamePath(pathname, ROUTES.events)) setState('ok');
          else router.replace(ROUTES.events);
        } else {
          router.replace(`${ROUTES.selectEvent}?manual=true`);
        }
      })
      .catch(() => { if (!cancelled && isSamePath(pathname, ROUTES.events)) setState('ok'); });
    return () => { cancelled = true; };
  }, [isReady, isAuthenticated, pathname, router]);

  return state === 'ok';
}

function Gate({ children }: { children: ReactNode }) {
  return useEventGate() ? <>{children}</> : <FullPageSpinner label="Loading your active event…" />;
}

/** Pages under a restricted module that every signed-in user may open. */
const OPEN_TO_ALL_USERS: readonly string[] = ['/user/profile', '/user/preferences', ROUTES.changePassword];

/** Page permission = the permission of the registered feature that owns this URL. */
function usePagePermission() {
  const pathname = usePathname();
  if (OPEN_TO_ALL_USERS.some((p) => isWithinPath(pathname, p))) return undefined;
  return FEATURES
    .filter((f) => isWithinPath(pathname, f.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.permission;
}

export default function AppLayout({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  const permission = usePagePermission();
  if (hideNav) {
    return (
      <ProtectedRoute permission={permission}>
        <main className="min-h-screen bg-canvas p-3 sm:p-4 md:p-5 lg:p-6"><Gate>{children}</Gate></main>
      </ProtectedRoute>
    );
  }
  return <AppShell permission={permission}><Gate>{children}</Gate></AppShell>;
}
