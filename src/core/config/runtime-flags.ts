'use client';

import { useSyncExternalStore } from 'react';
import type { AppEnvironment } from './build-info';

/**
 * RUNTIME configuration. The build contains NO environment-specific values:
 * the Worker injects `window.__APP_CONFIG__` into every HTML page from its own
 * vars/secrets (ENCRYPT_API, ENABLE_LOGS, API_ENCRYPTION_KEY, APP_ENV, ...), so the
 * exact same build runs on QA and production.
 * Under `next dev` (no Worker) the defaults below apply.
 */
export interface RuntimeConfig {
  environment: AppEnvironment;
  version: string;
  commit: string;
  /** Encrypt every /api body (Worker ENCRYPT_API=true). */
  encryptApi: boolean;
  /** Payload key — only present when encryptApi is true. Ships to the browser by design. */
  encryptionKey: string;
  /** console.log/debug/info allowed (Worker ENABLE_LOGS != 'false'). */
  enableLogs: boolean;
}

declare global {
  interface Window { __APP_CONFIG__?: Partial<RuntimeConfig>; }
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  environment: 'local', version: 'dev', commit: '', encryptApi: false, encryptionKey: '', enableLogs: true,
};

let cached: RuntimeConfig | null = null;

/** Current config (browser: injected values; server prerender / dev: defaults). */
export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined') return DEFAULT_RUNTIME_CONFIG;
  return (cached ??= { ...DEFAULT_RUNTIME_CONFIG, ...window.__APP_CONFIG__ });
}

const noopSubscribe = () => () => {};

/**
 * React hook for config that affects rendering. Uses the defaults during the static
 * prerender/hydration pass and the real values right after, so there is no mismatch.
 */
export function useRuntimeConfig(): RuntimeConfig {
  return useSyncExternalStore(noopSubscribe, getRuntimeConfig, () => DEFAULT_RUNTIME_CONFIG);
}

export const isProductionEnv = (c: RuntimeConfig) => c.environment === 'production';
