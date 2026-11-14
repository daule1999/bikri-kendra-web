import type { RouteHandler } from '../types';

/**
 * Custom (non pass-through) handlers, keyed by exact public path.
 * Checked BEFORE the generic rules in proxy-rules.ts.
 *
 * Empty today. As pages are migrated, the few EventManagement routes that
 * aggregate several backend calls (e.g. /api/billing/invoices/enriched,
 * /api/inventory/sales) either move into the backend, into the client, or —
 * as a last resort — get a handler file here registered with one line.
 */
export const CUSTOM_HANDLERS: Readonly<Record<string, RouteHandler>> = {};
