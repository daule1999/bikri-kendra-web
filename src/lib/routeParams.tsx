'use client';

/**
 * PHASE 1 COMPAT — dynamic segments on a static export.
 * Each [param] page is pre-built once with a placeholder ("_"); the Worker serves
 * that build for any real id (worker/dynamic-routes.ts). The real value is read
 * from the address bar here and provided to the page via useLegacyParams().
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FullPageSpinner } from '@/shared/ui';

const ParamsContext = createContext<Record<string, string>>({});

/** Drop-in for next/navigation useParams() in ported dynamic pages. */
export function useLegacyParams<T extends Record<string, string> = Record<string, string>>(): T {
  return useContext(ParamsContext) as T;
}

/** `segments` maps param name → index in the path (e.g. /shops/12 → { id: 1 }). */
export function PathParamsGate({ segments, children }: { segments: Record<string, number>; children: ReactNode }) {
  const [params, setParams] = useState<Record<string, string> | null>(null);
  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    setParams(Object.fromEntries(Object.entries(segments).map(([k, i]) => [k, decodeURIComponent(parts[i] ?? '')])));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!params) return <FullPageSpinner />;
  return <ParamsContext.Provider value={params}>{children}</ParamsContext.Provider>;
}
