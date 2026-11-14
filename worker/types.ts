/** Minimal Cloudflare bindings used by this Worker (avoids a dependency on @cloudflare/workers-types). */
export interface Env {
  /** Static assets binding (the Next.js export in ./out). */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** Public HTTPS origin of the backend gateway (Traefik). Per environment in wrangler.jsonc. */
  BACKEND_URL?: string;
  /** local | qa | production — from wrangler.jsonc. */
  APP_ENV?: string;
  /** Git tag or branch@sha this deployment was built from — injected by scripts/deploy.sh. */
  APP_VERSION?: string;
  /** Full commit SHA — injected by scripts/deploy.sh. */
  GIT_SHA?: string;
}

/**
 * A custom handler for the rare route that is NOT a 1:1 pass-through
 * (e.g. a BFF endpoint that fans out to several services and merges results).
 * Receives a `forward` helper that already applies auth/header/URL rules.
 */
export type RouteHandler = (ctx: {
  request: Request;
  env: Env;
  url: URL;
  forward: (backendPath: string, init?: RequestInit) => Promise<Response>;
}) => Promise<Response>;
