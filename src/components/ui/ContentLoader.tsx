'use client';

import { Spinner } from '@/components/ui/Spinner';

/**
 * ContentLoader — shared section/page loading indicator.
 *
 * Use this everywhere a content area is loading (tab bodies, page sections,
 * report tables, etc.). Do NOT use for button-level inline spinners.
 *
 * Usage:
 *   import { ContentLoader } from '@/components/ui/ContentLoader';
 *   {loading && <ContentLoader message="Loading sales report..." />}
 *
 *   // As a Suspense fallback:
 *   <Suspense fallback={<ContentLoader message="Loading..." />}>
 */
export function ContentLoader({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size="md" />
      {message && (
        <p className="mt-3 text-sm font-medium text-slate-500">{message}</p>
      )}
    </div>
  );
}
