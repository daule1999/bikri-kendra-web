/** Detail-page URLs (id travels in the query string — see lib/routeParams.tsx). */
export const detailRoutes = {
  shop: (id: string | number) => `/shops/detail?id=${encodeURIComponent(String(id))}`,
  movement: (id: string | number) => `/inventory/movements/detail?id=${encodeURIComponent(String(id))}`,
  invoice: (id: string | number) => `/billing/invoices/detail?id=${encodeURIComponent(String(id))}`,
} as const;
