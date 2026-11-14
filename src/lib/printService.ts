/**
 * printService.ts — the SINGLE print entry point for the app.
 *
 * Pages (app/sales/page.tsx, app/billing/page.tsx) call `printDocuments(bill, ctx)` and nothing
 * else. This is the "one hood that decides everything":
 *
 *   1. Always prints the BILL via printBillSmart (which itself routes central-vs-local).
 *   2. Prints the RECEIVING slip too — but ONLY when every gate passes:
 *        - ctx.config.receivingPrint.enabled       (event admin switch)
 *        - ctx.shop.receivingPrintEnabled          (per-shop switch)
 *        - ctx.userReceivingPrintEnabled !== false (per-user, per-shop opt-out — localStorage,
 *                                                    see lib/userPrintPreference.ts. `undefined`/
 *                                                    `null`/`true` all mean "no objection"; only an
 *                                                    explicit `false` blocks the print.)
 *        - !ctx.isReprint                          (receiving fires on new checkout, not history)
 *        - !ctx.receivingAlreadyPrinted            (idempotent — never double-print a slip)
 *      Receiving uses printReceivingSmart, so it takes the SAME route as the bill (both land on the
 *      central queue, or both print locally — never split across machines).
 *   3. Persists the receiving-printed flag after a successful receiving print.
 *
 * It wraps the existing, working functions (printBillSmart / printReceivingSmart / printBill /
 * printReceiving / buildEscPos*) — it does NOT re-implement any rendering or routing.
 */
import { printBillSmart, printReceivingSmart, type PrintRoute } from '@/lib/centralPrint';
import type { PrintReceiptConfig } from '@/lib/thermalPrinter';
import type { ReceiptEventConfig } from '@/lib/recieptConfig';

export type DocumentType = 'INVOICE' | 'RECEIVING';

export interface PrintContext {
  /** Receipt identity — from resolveShopInfo(shopId, assignedShops) */
  shopName: string;
  orgName: string;
  counterNumber?: number;
  eventName?: string;
  /** The event's receiptConfig (single source of truth for layout + the receiving gate). */
  config: ReceiptEventConfig;
  /** The shop row — only `receivingPrintEnabled` is read here. */
  shop: { receivingPrintEnabled?: boolean };
  /** Per-user, per-shop opt-out (localStorage — see lib/userPrintPreference.ts).
   *  `undefined`/`null`/`true` → no objection, defer to the event/shop gates.
   *  `false` → operator explicitly opted out of receiving slips at this shop. */
  userReceivingPrintEnabled?: boolean | null;
  /** Billing-history reprint? Receiving auto-print is suppressed for reprints. */
  isReprint?: boolean;
  /** Already-printed flag from the order — suppresses a duplicate receiving slip. */
  receivingAlreadyPrinted?: boolean;
}

export interface PrintResult {
  route: PrintRoute;                                  // 'central' | 'local' (decided for the bill)
  printed: DocumentType[];                            // what actually printed/queued
  skipped: { type: DocumentType; reason: string }[]; // what we deliberately or safely skipped
}

/**
 * Print the bill (+ receiving when gated). Returns what happened.
 *
 * Throws only if the BILL itself fails (e.g. NoCentralTargetError) — callers should surface that.
 * A receiving failure never throws: the bill has already printed, so it is recorded in `skipped`.
 */
export async function printDocuments(bill: any, ctx: PrintContext): Promise<PrintResult> {
  const userConfig: PrintReceiptConfig = {
    shopName: ctx.shopName,
    orgName: ctx.orgName,
    counterNumber: ctx.counterNumber,
    eventName: ctx.eventName,
    eventConfigPayload: ctx.config,
  };

  const printed: DocumentType[] = [];
  const skipped: { type: DocumentType; reason: string }[] = [];

  // 1) BILL — printBillSmart picks the route (central queue vs local) and may throw if Central
  //    mode is on with no target printer selected. Let that propagate to the caller.
  const route = await printBillSmart(bill, userConfig);
  printed.push('INVOICE');

  // 2) RECEIVING — gate once, here.
  const wantReceiving =
    !ctx.isReprint &&
    !!ctx.config?.receivingPrint?.enabled &&
    !!ctx.shop?.receivingPrintEnabled &&
    ctx.userReceivingPrintEnabled !== false &&
    !ctx.receivingAlreadyPrinted;

  if (!wantReceiving) {
    const reason =
      ctx.isReprint ? 'reprint — receiving not auto-printed'
      : ctx.receivingAlreadyPrinted ? 'already printed'
      : !ctx.config?.receivingPrint?.enabled ? 'event receivingPrint disabled'
      : !ctx.shop?.receivingPrintEnabled ? 'shop receivingPrintEnabled off'
      : ctx.userReceivingPrintEnabled === false ? 'user opted out of receiving print at this shop'
      : 'receiving gate not met';
    skipped.push({ type: 'RECEIVING', reason });
    return { route, printed, skipped };
  }

  try {
    // Same route as the bill — both go central or both go local.
    await printReceivingSmart(bill, userConfig);
    printed.push('RECEIVING');

    // NOTE: no longer PATCHing /sales/retail/{orderNo}/receiving-printed here — by
    // request, receiving-print is treated as always "done" for a given checkout;
    // we don't persist a printed flag or call that endpoint anymore. The gate above
    // (ctx.receivingAlreadyPrinted) still works if a caller passes it in directly.
  } catch (err: any) {
    // Bill already printed — do not throw; record and move on.
    console.warn('[printService] receiving print failed (bill already printed):', err?.message || err);
    skipped.push({ type: 'RECEIVING', reason: `print error: ${err?.message || err}` });
  }

  return { route, printed, skipped };
}
