import type { Env } from './types';
import { handleApi } from './proxy';
import { resolveDynamicAsset } from './dynamic-routes';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    if (pathname === '/api' || pathname.startsWith('/api/')) return handleApi(request, env);

    const placeholder = resolveDynamicAsset(pathname);
    if (placeholder) {
      const rewritten = new URL(placeholder + url.search, url);
      const res = await env.ASSETS.fetch(new Request(rewritten.toString(), request));
      if (res.status !== 404) return res;
    }
    return env.ASSETS.fetch(request);
  },
};
