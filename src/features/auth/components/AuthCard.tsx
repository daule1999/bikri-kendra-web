import type { ReactNode } from 'react';
import { APP } from '@/core/config';
import { EnvironmentStamp, Icon } from '@/shared/ui';

/** Branded card used by login (and later: forgot/reset password). */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="relative z-10 mx-auto w-full max-w-md animate-fade-in-up drop-shadow-2xl">
      <div className="overflow-hidden rounded-card bg-surface">
        <div className="h-1.5 w-full bg-gradient-brand-bar" />
        <header className="bg-gradient-auth-header px-8 pb-6 pt-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-card bg-gradient-accent text-on-accent shadow-raised">
              <Icon name="cart" size="xl" strokeWidth={2} />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-on-accent">{APP.name}</h1>
          <p className="mt-1 text-sm text-on-dark">{APP.tagline}</p>
        </header>
        <div className="px-8 py-8">
          <h2 className="mb-6 text-lg font-semibold text-fg">{title}</h2>
          {children}
        </div>
        <footer className="border-t border-line px-8 py-4 text-center text-xs text-fg-faint">
          © {new Date().getFullYear()} {APP.org} · {APP.name}
          <span className="mt-2 flex items-center justify-center gap-2">
            <EnvironmentStamp />
          </span>
        </footer>
      </div>
    </div>
  );
}
