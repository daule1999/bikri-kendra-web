import type { Env } from './types';
import { resolveRule } from './proxy-rules';
import { CUSTOM_HANDLERS } from './handlers';

/** Request headers the browser may pass through to the backend. Everything else (cookies etc.) is dropped. */
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'x-event-id', 'x-request-id'] as const;

/** Upstream response headers we pass back to the browser. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'x-request-id', 'cache-control'] as const;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function buildUpstreamHeaders(request: Request, includeAuth: boolean): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    if (name === 'authorization' && !includeAuth) continue;
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!headers.has('x-request-id')) headers.set('x-request-id', crypto.randomUUID());
  const clientIp = request.headers.get('cf-connecting-ip');
  if (clientIp) headers.set('x-forwarded-for', clientIp);
  return headers;
}

function sanitizeResponse(upstream: Response): Response {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
}

async function forwardTo(env: Env, request: Request, backendPath: string, search: string, includeAuth: boolean, init?: RequestInit) {
  const backend = (env.BACKEND_URL || '').replace(/\/+$/, '');
  const method = init?.method ?? request.method;
  const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
  try {
    const upstream = await fetch(`${backend}${backendPath}${search}`, {
      method,
      headers: init?.headers ?? buildUpstreamHeaders(request, includeAuth),
      body: init?.body ?? (hasBody ? request.body : undefined),
      redirect: 'manual',
    });
    return sanitizeResponse(upstream);
  } catch (err) {
    console.error('[proxy] upstream unreachable', backendPath, err);
    return json(502, { error: 'Backend unreachable', path: backendPath });
  }
}

/** Single entry point for every /api/* request. */
export async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === '/api/health') {
    return json(200, {
      status: 'ok',
      environment: env.APP_ENV ?? 'unknown',
      version: env.APP_VERSION ?? 'dev',
      commit: env.GIT_SHA ?? null,
      backendConfigured: !!env.BACKEND_URL,
    });
  }
  if (!env.BACKEND_URL) {
    return json(503, { error: 'Backend not configured', environment: env.APP_ENV, hint: 'Set BACKEND_URL for this environment in wrangler.jsonc' });
  }

  const custom = CUSTOM_HANDLERS[url.pathname];
  if (custom) {
    return custom({
      request, env, url,
      forward: (backendPath, init) => forwardTo(env, request, backendPath, '', true, init),
    });
  }

  const match = resolveRule(url.pathname);
  if (!match) return json(404, { error: 'Unknown API route', path: url.pathname });

  return forwardTo(env, request, match.backendPath, url.search, !match.rule.public);
}
