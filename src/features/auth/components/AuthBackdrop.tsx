import type { ReactNode } from 'react';

/** Full-screen branded background for unauthenticated pages. */
export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-auth-page p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-accent opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand opacity-15 blur-3xl" />
        <div className="absolute left-1/4 top-1/2 h-64 w-64 rounded-full tone-violet bg-tone opacity-10 blur-3xl" />
      </div>
      {children}
    </main>
  );
}
