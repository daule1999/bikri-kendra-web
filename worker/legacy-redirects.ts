/**
 * Detail pages are static routes that read the id from the query string
 * (/shops/detail?id=12). Old path-style URLs from EventManagement (/shops/12,
 * /inventory/movements/7, /billing/invoices/INV-1) are redirected to them so
 * bookmarks and shared links keep working.
 */
const LEGACY_DETAIL_BASES = ['/shops', '/inventory/movements', '/billing/invoices'] as const;

/** Redirect target for a legacy path-style detail URL, or null when it isn't one. */
export function legacyDetailRedirect(pathname: string, search = ''): string | null {
  for (const base of LEGACY_DETAIL_BASES) {
    if (!pathname.startsWith(base + '/')) continue;
    const rest = pathname.slice(base.length + 1).replace(/\/+$/, '');
    if (!rest || rest.includes('/') || rest.includes('.') || rest === 'detail' || rest.startsWith('__next')) return null;
    const params = new URLSearchParams(search);
    params.set('id', decodeURIComponent(rest));
    return `${base}/detail?${params}`;
  }
  return null;
}
