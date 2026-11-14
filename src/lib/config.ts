// On the server (Next.js API routes running inside Docker), we must reach Traefik
// via its Docker service name. On the client (browser), localhost:8090 is correct.
// typeof window === 'undefined' is true only in Node.js (server-side).
const isServer = typeof window === "undefined";

export const config = {
  // API_BASE_URL: "http://localhost:8090",// Local 
  API_BASE_URL: isServer
    ? process.env.INTERNAL_API_BASE_URL || "http://localhost:8090" // Docker-internal
    : process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8090", // Browser


  endpoints: {
    // Authentication
    AUTH_LOGIN: '/api/auth-svc/login',

    // Users
    USERS_REGISTER: '/api/users-svc/register',
    USERS_ALL: '/api/users-svc/allUsers',
    USERS_BY_USERNAME: '/api/users-svc',
    USERS_DELETE: '/api/users-svc',
    USERS_VALIDATE: '/api/users-svc/validate',
    USERS_AUTHORIZATION: '/api/users-svc',
    USERS_ASSIGN_EVENTS: '/api/users-svc/assign-events',

    // User Roles
    USER_ROLES: '/api/users-svc/users-role',

    // Roles
    ROLES_ALL: '/api/users-svc/roles',

    // Role Permissions
    ROLE_PERMISSIONS: '/api/users-svc/roles-permission',

    // Categories
    CATEGORIES: '/api/inventory-svc/categories',

    // Products
    PRODUCTS: '/api/inventory-svc/products',
    PRODUCTS_BULK: '/api/inventory-svc/products/bulk',

    // Inventory
    INVENTORY_SALES: '/api/inventory-svc/sales',
    INVENTORY_SALES_BULK: '/api/inventory-svc/sales/bulk',
    INVENTORY_STOCK_MOVEMENTS: '/api/inventory-svc/stock-movements',
    INVENTORY_STOCKS: '/api/inventory-svc/stocks',
    INVENTORY_PURCHASES: '/api/inventory-svc/purchases',
    INVENTORY_SUPPLIERS: '/api/inventory-svc/suppliers',
    INVENTORY_REPORTS: '/api/inventory-svc/reports',
    INVENTORY_RUNNING_STOCK: '/api/inventory-svc/reports/running-stock',

    // Shops
    SHOPS: '/api/sales-svc/shops',
    SHOPS_REGISTER: '/api/sales-svc/shops/register',
    SHOPS_COUNTER: '/api/sales-svc/shops/counter',
    SHOPS_STAFF: '/api/sales-svc/shops-staff',
    SHOPS_STAFF_ASSIGN: '/api/sales-svc/shops-staff/assign',

    // Retail Sales
    RETAIL_SALES_CONFIRM: '/api/sales-svc/retail',
    RETAIL_SALES_COMPLETE: '/api/sales-svc/retail/complete',
    RETAIL_SALES_CATALOG: '/api/sales-svc/retail/shop', // /{shopId}/catalog appended at call site

    // Events
    EVENTS: '/api/sales-svc/events',

    // Billing
    BILLING_INVOICES: '/api/billing-svc/invoices',

    // Reports
    REPORTS_MASTER_SETTLEMENT: '/reports/master-settlement',
    REPORTS_3_WAY_MATCH: '/reports/3-way-match',
    REPORTS_LIVE_SNAPSHOT: '/reports/live-snapshot',
    REPORTS_LIVE_TALLY: '/reports/live-tally',
    REPORTS_TRUST_SCORE: '/reports/trust-score',

    // Shifts
    SHIFTS_ACTIVE: '/shifts/shop',
    SHIFTS_CLOSE: '/shifts',

    // Page-init aggregator
    PAGE_INIT: '/api/sales-svc/page-init',
  },

  // ─── Thermal Receipt ──────────────────────────────────────────────────────
  // Override any field via .env.local (see .env.example).
  // Values here are the hardcoded fallbacks used when the env var is absent.
  receipt: {
    shopName: process.env.NEXT_PUBLIC_RECEIPT_SHOP_NAME || 'BIKRI KENDRA',
    orgName: process.env.NEXT_PUBLIC_RECEIPT_ORG_NAME || 'Vihangam Yoga',
    currency: process.env.NEXT_PUBLIC_RECEIPT_CURRENCY || '₹',
    footerMessage: process.env.NEXT_PUBLIC_RECEIPT_FOOTER_MSG || 'THANK YOU!',
    footerSubtext: process.env.NEXT_PUBLIC_RECEIPT_FOOTER_SUB || 'Visit Again',
    /**
     * Optional URL for a remotely-hosted HTML template.
     * The template may contain {{TOKEN}} placeholders (see lib/printBill.ts).
     * Leave empty to use the built-in default (no network call at print time).
     *
     * Examples:
     *   /api/receipt-template            ← your own Next.js API route (DB-backed)
     *   https://bucket.s3.amazonaws.com/receipt.html   ← S3 / R2
     *   https://gist.github.com/.../raw/receipt.html   ← GitHub Gist
     */
    templateUrl: process.env.NEXT_PUBLIC_RECEIPT_TEMPLATE_URL || '',
  },
}