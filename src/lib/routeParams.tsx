'use client';

/**
 * Detail pages are plain static routes that take their id from the query string
 * (/shops/detail?id=12), so nothing is rewritten by the Worker and no placeholder
 * pages are built. Old path-style URLs (/shops/12) are redirected by the Worker.
 */
import { Suspense, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { FullPageSpinner } from '@/shared/ui';

/** Reads a required id from the query string. Empty string when missing. */
export function useQueryId(name = 'id'): string {
  return useSearchParams().get(name) ?? '';
}

/** Wrap a detail page: useSearchParams() needs a Suspense boundary in a static export. */
export function DetailPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>;
}
