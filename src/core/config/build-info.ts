/**
 * Which build is running. Set by scripts/deploy.sh at build time (NEXT_PUBLIC_*
 * values are baked into the static JS — never put secrets here).
 */
export type AppEnvironment = 'local' | 'qa' | 'production';

export const BUILD_INFO = {
  environment: (process.env.NEXT_PUBLIC_APP_ENV || 'local') as AppEnvironment,
  version: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
  commit: process.env.NEXT_PUBLIC_GIT_SHA || '',
} as const;

export const isProduction = BUILD_INFO.environment === 'production';
