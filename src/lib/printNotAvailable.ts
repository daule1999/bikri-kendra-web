/** Printing is out of scope for the Cloudflare build (phase 1). */
export const PRINTING_UNAVAILABLE_MESSAGE =
  'Printing is not available in the web version yet. The sale has been saved.';
export class PrintingUnavailableError extends Error {
  constructor() { super(PRINTING_UNAVAILABLE_MESSAGE); this.name = 'PrintingUnavailableError'; }
}
