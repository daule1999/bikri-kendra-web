import type { RouteHandler } from '../types';
import { enrichedInvoices, updateInvoice } from './billing';
import { bulkIssueToShop, issueToShop } from './inventory';
import { registerShop, unassignStaff } from './shops';

/**
 * Custom (non pass-through) handlers, keyed by "METHOD /public/path".
 * Checked BEFORE the generic rules in proxy-rules.ts; other methods on the same
 * path still use the generic rule (e.g. GET /api/shops).
 *
 * These are the EventManagement routes that did more than rewrite a URL.
 */
export const CUSTOM_HANDLERS: Readonly<Record<string, RouteHandler>> = {
  'POST /api/billing/invoices/enriched': enrichedInvoices,
  'PUT /api/billing/invoices': updateInvoice,
  'POST /api/inventory/sales': issueToShop,
  'POST /api/inventory/sales/bulk': bulkIssueToShop,
  'POST /api/shops': registerShop,
  'POST /api/shops-staff/unassign': unassignStaff,
};
