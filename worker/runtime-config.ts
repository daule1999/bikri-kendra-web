import type { Env } from './types';

/**
 * Runtime configuration for the browser. The static site is built ONCE with no
 * environment-specific values; every HTML response gets this injected into <head>
 * from the Worker's own vars/secrets, so the same build runs on QA and production.
 *
 *   ENCRYPT_API         'true' → encrypt /api bodies           (var)
 *   API_ENCRYPTION_KEY  payload key, sent only if encrypting   (secret)
 *   ENABLE_LOGS         'false' → silence console.log/info/... (var)
 *   APP_ENV / APP_VERSION / GIT_SHA                            (vars)
 */
declare const HTMLRewriter: any; // Workers runtime global

const CONSOLE_GUARD =
  "(function(){var n=function(){};['log','debug','info','trace'].forEach(function(m){try{console[m]=n}catch(e){}})})();";

export function buildRuntimeConfig(env: Env) {
  const encryptApi = env.ENCRYPT_API === 'true' && !!env.API_ENCRYPTION_KEY;
  return {
    environment: env.APP_ENV ?? 'local',
    version: env.APP_VERSION ?? 'dev',
    commit: env.GIT_SHA ?? '',
    encryptApi,
    encryptionKey: encryptApi ? env.API_ENCRYPTION_KEY! : '',
    enableLogs: env.ENABLE_LOGS !== 'false',
  };
}

/** JSON that is safe inside an inline <script>. */
const safeJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** Prepends the config (and console guard) to <head> of HTML responses; other responses pass through. */
export function injectRuntimeConfig(res: Response, env: Env): Response {
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res;
  const cfg = buildRuntimeConfig(env);
  const script = `<script>window.__APP_CONFIG__=${safeJson(cfg)};${cfg.enableLogs ? '' : CONSOLE_GUARD}</script>`;
  const out = new HTMLRewriter()
    .on('head', { element(el: { prepend(html: string, o: { html: boolean }): void }) { el.prepend(script, { html: true }); } })
    .transform(res) as Response;
  const headers = new Headers(out.headers);
  headers.set('cache-control', 'no-store');   // config differs per environment; never serve a stale copy
  headers.delete('etag');
  return new Response(out.body, { status: out.status, statusText: out.statusText, headers });
}
