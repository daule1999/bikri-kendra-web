/** Minimal Cloudflare bindings used by this Worker (avoids a dependency on @cloudflare/workers-types). */
export interface Env {
  /** Static assets binding (the Next.js export in ./out). */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Public HTTPS origin of the backend gateway (Traefik). Per environment in wrangler.jsonc. */
  BACKEND_URL?: string;
  /** local | qa | production — from wrangler.jsonc. */
  APP_ENV?: string;
  /** 'true' = require encrypted /api payloads (set per environment from the env file). */
  ENCRYPT_API?: string;
  /** Secret used to seal the session cookies (long random string). */
  SESSION_SECRET?: string;
  /** 'false' = silence browser console.log/info/debug (default: allowed). */
  ENABLE_LOGS?: string;
  /** Secret passphrase for payload encryption; served to the browser at runtime with the page config. */
  API_ENCRYPTION_KEY?: string;
  /** Git tag or branch@sha this deployment was built from — injected by scripts/deploy.sh. */
  APP_VERSION?: string;
  /** Full commit SHA — injected by scripts/deploy.sh. */
  GIT_SHA?: string;
}

/**
 * A custom handler for the few routes that are NOT a 1:1 pass-through
 * (BFF endpoints that fan out and merge, or that reshape the request).
 */
export interface HandlerContext {
  request: Request;
  env: Env;
  url: URL;
  /**
   * Calls the backend with the caller's Authorization / X-Event-Id / X-Request-Id
   * already applied. Returns the raw upstream Response.
   */
  backend: (backendPath: string, init?: { method?: string; body?: unknown; signal?: AbortSignal }) => Promise<Response>;
}

export type RouteHandler = (ctx: HandlerContext) => Promise<Response>;
