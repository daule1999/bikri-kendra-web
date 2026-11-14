/**
 * Dynamic page routes on a static export. Each [param] page is built once with
 * the placeholder "_" (out/shops/_.html, _.txt, _/__next.*.txt); any real id is
 * served from that build and the page reads the real id from the URL
 * (src/lib/routeParams.tsx).
 *
 * Add the base path here (and to assets.run_worker_first) when a new [param] page is added.
 */
const DYNAMIC_BASES: readonly string[] = ['/shops', '/inventory/movements', '/billing/invoices'];

/** Placeholder asset path for a dynamic URL, or null when it isn't one. */
export function resolveDynamicAsset(pathname: string): string | null {
  for (const base of DYNAMIC_BASES) {
    if (!pathname.startsWith(base + '/')) continue;
    const rest = pathname.slice(base.length + 1);          // "12", "12.txt", "12/__next._tree.txt"
    const slash = rest.indexOf('/');
    let id = slash === -1 ? rest : rest.slice(0, slash);
    const tail = slash === -1 ? '' : rest.slice(slash);
    if (!id || id === '_' || id.startsWith('__next.')) return null; // the list page's own files
    let ext = '';
    if (id.endsWith('.txt')) { ext = '.txt'; id = id.slice(0, -4); }
    if (!id || id === '_') return null;
    return `${base}/_${ext}${tail}`;
  }
  return null;
}
