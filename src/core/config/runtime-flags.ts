/**
 * Build-time feature flags, read from the env file for the target environment
 * (.env.production / .env.qa — see .env.example). NEXT_PUBLIC_* values are baked
 * into the JS bundle, so treat them as public.
 */
export const RUNTIME_FLAGS = {
  /** Encrypt every /api request and response body (prod: true, QA: false). */
  encryptApi: process.env.NEXT_PUBLIC_ENCRYPT_API === 'true',
  /** Key the Worker also holds (API_ENCRYPTION_KEY secret). */
  encryptionKey: process.env.NEXT_PUBLIC_API_ENCRYPTION_KEY || '',
  /** Allow console.log/debug/info in the browser (prod: false, QA: true). */
  enableLogs: process.env.NEXT_PUBLIC_ENABLE_LOGS !== 'false',
} as const;
