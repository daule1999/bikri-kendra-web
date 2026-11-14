import type { RouteHandler } from '../types';
import { extractRows, json, passThrough, readJson } from './http';

const RETAIL_LOOKUP_TIMEOUT_MS = 3000;

interface EnrichedRequestBody {
  eventId?: string | number;
  shopIds?: string;
  searchTerm?: string;
  billedBy?: string | number;
  page?: number;
  size?: number;
}

const orderNumberOf = (row: any): string | undefined =>
  row?.salesOrderNumber || row?.orderNumber || row?.invoiceNo || row?.invoiceId;

/**
 * POST /api/billing/invoices/enriched — ported from EventManagement's Next route.
 * 1. invoice search (billing-svc)  2. best-effort retail + payment lookups (sales-svc)
 * 3. merge, showing net-of-returns amounts for returned orders.
 */
export const enrichedInvoices: RouteHandler = async ({ request, backend }) => {
  const body = (await readJson<EnrichedRequestBody>(request)) ?? {};
  const eventId = body.eventId != null ? String(body.eventId) : request.headers.get('x-event-id') || '';
  const page = Number.isFinite(body.page) ? Number(body.page) : 0;
  const size = Number.isFinite(body.size) ? Number(body.size) : 10;

  const q = new URLSearchParams();
  if (eventId) q.set('eventIds', eventId);
  if (body.shopIds) q.set('shopIds', body.shopIds);
  if (body.searchTerm?.trim()) q.set('searchTerm', body.searchTerm.trim());
  if (body.billedBy != null && body.billedBy !== '') q.set('billedBy', String(body.billedBy));
  q.set('page', String(page));
  q.set('size', String(size));

  const invoicesRes = await backend(`/api/billing-svc/invoices/search?${q}`);
  if (!invoicesRes.ok) return passThrough(invoicesRes);
  const invoicesRaw: any = await invoicesRes.json();
  const invoices = extractRows(invoicesRaw);
  const orderNumbers = [...new Set(invoices.map(orderNumberOf).filter((v): v is string => !!v))];

  const lookup = async (path: string): Promise<any[]> => {
    if (orderNumbers.length === 0) return [];
    try {
      const res = await backend(path, { method: 'POST', body: { orderNumbers }, signal: AbortSignal.timeout(RETAIL_LOOKUP_TIMEOUT_MS) });
      if (!res.ok) return [];
      return extractRows(await res.json());
    } catch {
      return []; // best effort: return the page unenriched
    }
  };
  const [retailSales, paymentRows] = await Promise.all([
    lookup('/api/sales-svc/retail/by-order-numbers'),
    lookup('/api/sales-svc/retail/payments/by-order-numbers'),
  ]);
  const paymentByOrder = new Map<string, any>(paymentRows.map((p: any) => [p.orderNumber, p]));

  const merged = invoices.map((inv: any) => {
    const orderNo = orderNumberOf(inv);
    const rs = retailSales.find((r: any) =>
      r.orderNumber === orderNo || r.salesOrderNumber === orderNo || r.orderId === orderNo || r.id === orderNo || r.salesOrderId === orderNo);
    const orderStatus = rs?.status || rs?.orderStatus || inv.status;
    const isReturned = orderStatus === 'PARTIALLY_RETURNED' || orderStatus === 'RETURNED';
    const returnedNet = isReturned && rs?.orderSubtotal != null ? Number(rs.orderSubtotal) - Number(rs.discountAmount ?? 0) : undefined;
    const pay = paymentByOrder.get(orderNo as string);
    return {
      ...inv,
      status: orderStatus,
      originalAmount: inv.netAmount || inv.totalAmount,
      netAmount: returnedNet ?? (rs?.totalAmount || rs?.netAmount || inv.netAmount || inv.totalAmount),
      totalAmount: returnedNet ?? (rs?.totalAmount || rs?.netAmount || inv.totalAmount || inv.netAmount),
      paymentMode: pay?.paymentMode || rs?.paymentMode || rs?.payment_mode || inv.paymentMode || inv.payment_mode,
      cashReceived: rs?.cashReceived || rs?.cash_received || inv.cashReceived || inv.cash_received,
      cashAmount: pay?.cashAmount || rs?.cashAmount || rs?.cash_amount || inv.cashAmount || inv.cash_amount,
      onlineAmount: pay?.onlineAmount || rs?.onlineAmount || rs?.online_amount || inv.onlineAmount || inv.online_amount,
      paymentReference: rs?.paymentReference || rs?.payment_reference || inv.paymentReference || inv.payment_reference,
      change: rs?.changeGiven || rs?.change_given || rs?.change || inv.changeGiven || inv.change,
      receivingPrinted: rs?.receivingPrinted ?? rs?.receiving_printed ?? false,
    };
  });

  return json(200, {
    data: merged,
    totalElements: invoicesRaw?.totalElements ?? merged.length,
    totalPages: invoicesRaw?.totalPages ?? 1,
    page: invoicesRaw?.page ?? page,
    size: invoicesRaw?.size ?? size,
  });
};

/** PUT /api/billing/invoices — id travels in the body; backend wants it in the path. */
export const updateInvoice: RouteHandler = async ({ request, backend }) => {
  const body = (await readJson<Record<string, unknown>>(request)) ?? {};
  const { id, ...updateData } = body;
  const key = id ?? updateData.orderNumber;
  if (key == null) return json(400, { message: 'id or orderNumber is required' });
  return passThrough(await backend(`/api/billing-svc/invoices/${encodeURIComponent(String(key))}`, { method: 'PUT', body: updateData }));
};
