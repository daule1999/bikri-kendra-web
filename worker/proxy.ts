import type { Env, HandlerContext } from './types';
import { resolveRule } from './proxy-rules';
import { CUSTOM_HANDLERS } from './handlers';
import { ENCRYPTED_HEADER, decryptText, encryptText } from '../src/core/crypto/payload-crypto';

/** Request headers the browser may pass through to the backend. Everything else (cookies etc.) is dropped. */
const FORWARDED_REQUEST_HEADERS = ['authorization', 'content-type', 'accept', 'x-event-id', 'x-request-id'] as const;

/** Upstream response headers we pass back to the browser. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'x-request-id', 'cache-control', 'x-new-access-token'] as const;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const backendOrigin = (env: Env) => (env.BACKEND_URL || '').replace(/\/+$/, '');

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

/** Plain pass-through: same method, body and (allow-listed) headers. */
async function forward(env: Env, request: Request, backendPath: string, search: string, includeAuth: boolean) {
  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase());
  try {
    const upstream = await fetch(`${backendOrigin(env)}${backendPath}${search}`, {
      method: request.method,
      headers: buildUpstreamHeaders(request, includeAuth),
      body: hasBody ? request.body : undefined,
      redirect: 'manual',
    });
    return sanitizeResponse(upstream);
  } catch (err) {
    console.error('[proxy] upstream unreachable', backendPath, err);
    return json(502, { error: 'Backend unreachable', path: backendPath });
  }
}

/** Backend caller handed to custom handlers (auth/event/request-id applied). */
function makeBackendCaller(env: Env, request: Request): HandlerContext['backend'] {
  return (backendPath, init = {}) => {
    const headers = buildUpstreamHeaders(request, true);
    headers.set('content-type', 'application/json');
    return fetch(`${backendOrigin(env)}${backendPath}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: init.signal,
      redirect: 'manual',
    });
  };
}

/** Business routing (always sees plain JSON). */
async function handleApiPlain(request: Request, env: Env): Promise<Response> {
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
    return json(503, { error: 'Backend not configured', environment: env.APP_ENV, hint: 'Set the BACKEND_URL secret: scripts/set-backend-url.sh <env>' });
  }

  const custom = CUSTOM_HANDLERS[`${request.method.toUpperCase()} ${url.pathname.replace(/\/+$/, '')}`];
  if (custom) {
    try {
      return sanitizeResponse(await custom({ request, env, url, backend: makeBackendCaller(env, request) }));
    } catch (err) {
      console.error('[proxy] handler failed', url.pathname, err);
      return json(502, { error: 'Backend unreachable', path: url.pathname });
    }
  }

  const match = resolveRule(url.pathname);
  if (!match) return json(404, { error: 'Unknown API route', path: url.pathname });
  return forward(env, request, match.backendPath, url.search, !match.rule.public);
}

/**
 * Single entry point for every /api/* request. Adds the optional encryption
 * envelope around handleApiPlain: decrypt the request body, run, encrypt the
 * JSON response. If ENCRYPT_API=true, plain requests are rejected.
 */
export async function handleApi(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/health') return handleApiPlain(request, env);

  const encrypted = request.headers.get(ENCRYPTED_HEADER) === '1';
  if (!encrypted) {
    if (env.ENCRYPT_API === 'true') return json(400, { error: 'Encrypted payload required' });
    return handleApiPlain(request, env);
  }
  const key = env.API_ENCRYPTION_KEY;
  if (!key) return json(500, { error: 'Encryption not configured' });

  let req = request;
  const hasBody = !['GET', 'HEAD'].includes(request.method.toUpperCase());
  if (hasBody && (request.headers.get('content-type') || '').includes('application/json')) {
    try {
      const { enc } = JSON.parse(await request.text()) as { enc: string };
      req = new Request(request.url, { method: request.method, headers: request.headers, body: await decryptText(enc, key) });
    } catch {
      return json(400, { error: 'Invalid encrypted payload' });
    }
  }

  const res = await handleApiPlain(req, env);
  if (res.status === 204 || !(res.headers.get('content-type') || '').includes('application/json')) return res;
  const headers = new Headers(res.headers);
  headers.set(ENCRYPTED_HEADER, '1');
  headers.delete('content-length');
  return new Response(JSON.stringify({ enc: await encryptText(await res.text(), key) }), { status: res.status, statusText: res.statusText, headers });
}
