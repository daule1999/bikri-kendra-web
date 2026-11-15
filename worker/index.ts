import type { Env } from './types';
import { handleApi } from './proxy';
import { injectRuntimeConfig } from './runtime-config';
import { legacyDetailRedirect } from './legacy-redirects';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(request, env);

    const redirect = legacyDetailRedirect(pathname, url.search);
    if (redirect) return Response.redirect(new URL(redirect, url).toString(), 302);

    return injectRuntimeConfig(await env.ASSETS.fetch(request), env);
  },
};
