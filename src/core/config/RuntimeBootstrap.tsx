'use client';

import { useEffect } from 'react';
import { applyConsoleGuard } from './console-guard';
import { getRuntimeConfig } from './runtime-flags';

/** Applies runtime flags that need JS (console guard for `next dev`; the Worker already injects it in deployed builds). */
export function RuntimeBootstrap() {
  useEffect(() => { applyConsoleGuard(getRuntimeConfig().enableLogs); }, []);
  return null;
}
