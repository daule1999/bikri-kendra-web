/**
 * PHASE 1: printing disabled on the Cloudflare build. Signatures kept so the
 * ported pages compile; every call rejects with a clear message.
 */
import type { PrintReceiptConfig } from '@/lib/thermalPrinter';
import { PrintingUnavailableError } from './printNotAvailable';

export type PrintRoute = 'local';

export async function printBillSmart(_bill: any, _userConfig: PrintReceiptConfig): Promise<PrintRoute> {
  throw new PrintingUnavailableError();
}

export async function printReceivingSmart(_bill: any, _userConfig: PrintReceiptConfig): Promise<PrintRoute> {
  throw new PrintingUnavailableError();
}
