'use client';

import type { ReactNode } from 'react';
import { ProtectedRoute, type PermissionRequirement } from '@/core/auth';
import { cn } from '@/shared/lib/cn';
import { BottomNav } from './BottomNav';
import { ShellStateProvider, useShellState } from './shell-state';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function ShellFrame({ children, title }: { children: ReactNode; title?: string }) {
  const { sidebarCollapsed } = useShellState();
  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <div className={cn(
        'ml-0 flex flex-1 flex-col overflow-hidden transition-[margin] duration-300 md:ml-sidebar-collapsed',
        !sidebarCollapsed && 'lg:ml-sidebar',
      )}>
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-20 animate-fade-in sm:p-4 md:p-5 md:pb-5 lg:p-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

/**
 * Authenticated page wrapper: auth guard + optional page permission + chrome.
 *
 *   <AppShell permission={PERMISSIONS.reportsView}>…</AppShell>
 */
export function AppShell({ children, permission, title }: { children: ReactNode; permission?: PermissionRequirement; title?: string }) {
  return (
    <ProtectedRoute>
      <ShellStateProvider>
        <ShellFrame title={title}>
          <ProtectedRoute permission={permission}>{children}</ProtectedRoute>
        </ShellFrame>
      </ShellStateProvider>
    </ProtectedRoute>
  );
}
