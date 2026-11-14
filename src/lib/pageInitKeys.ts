/**
 * Generic page-init API key constants.
 *
 * Keep in sync with PageInitKey.java (sales-service/util/PageInitKey.java).
 *
 * Usage:
 *   import { SHOPS_PAGE_KEYS } from '@/lib/pageInitKeys';
 *   const response = await apiClient.get(`/page-init?include=${SHOPS_PAGE_KEYS.join(',')}`);
 */

export const PAGE_INIT_KEYS = {
  CATEGORIES:             'categories',
  PRODUCTS:               'products',
  USERS:                  'users',
  STOCKS:                 'stocks',
  SALES:                  'sales',
  SHOPS:                  'shops',
  PRODUCT_SHOP_SALES:     'productShopSales',
  EVENTS:                 'events',
  ROLES:                  'roles',
  SHOP_STAFF_ASSIGNMENTS: 'shopStaffAssignments',
  REPORT_SCOPE:           'reportScope',
} as const;

export type PageInitKey = typeof PAGE_INIT_KEYS[keyof typeof PAGE_INIT_KEYS];

// ── Per-page declarations ────────────────────────────────────────────────────
// This is the only place you change what a page fetches.

/** inventory/issue page — 7 slices */
export const INVENTORY_ISSUE_KEYS: PageInitKey[] = [
  PAGE_INIT_KEYS.CATEGORIES,
  PAGE_INIT_KEYS.PRODUCTS,
  PAGE_INIT_KEYS.USERS,
  PAGE_INIT_KEYS.STOCKS,
  PAGE_INIT_KEYS.SALES,
  PAGE_INIT_KEYS.SHOPS,
  PAGE_INIT_KEYS.PRODUCT_SHOP_SALES,
];

/** shops page — shops, categories, events on mount */
export const SHOPS_PAGE_KEYS: PageInitKey[] = [
  PAGE_INIT_KEYS.SHOPS,
  PAGE_INIT_KEYS.CATEGORIES,
  PAGE_INIT_KEYS.EVENTS,
];

/** user management page — 5 slices */
export const USER_PAGE_KEYS: PageInitKey[] = [
  PAGE_INIT_KEYS.USERS,
  PAGE_INIT_KEYS.ROLES,
  PAGE_INIT_KEYS.SHOP_STAFF_ASSIGNMENTS,
  PAGE_INIT_KEYS.SHOPS,
  PAGE_INIT_KEYS.EVENTS,
];

/** reports page — static init data (6 slices); shops come from ShopContext */
export const REPORTS_PAGE_KEYS: PageInitKey[] = [
  PAGE_INIT_KEYS.CATEGORIES,
  PAGE_INIT_KEYS.PRODUCTS,
  PAGE_INIT_KEYS.USERS,
  PAGE_INIT_KEYS.SALES,
  PAGE_INIT_KEYS.SHOP_STAFF_ASSIGNMENTS,
  PAGE_INIT_KEYS.REPORT_SCOPE,
];
