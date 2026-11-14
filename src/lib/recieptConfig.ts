// ─── Receipt Event Config — Single source of truth for all print behaviour ───
// All fields are stored on the backend event record under `receiptConfig`.
// DEFAULT_RECEIPT_CONFIG is the absolute fallback when no event config exists.
//
// Receipt layout (in order printed):
//   headerLines[]              ← admin-configurable, unlimited lines
//   ─── divider ───
//   Invoice Number             ← showInvoiceNumber
//   Sale Order Number          ← showSaleOrderNumber
//   Date / Time                ← showDateTime + dateTimeFormat
//   Customer Name              ← showCustomerName
//   Customer Mobile            ← showCustomerMobile
//   Seller                     ← showSellerUserId
//   ─── divider ───
//   All Items                  ← always; showReturnDetails controls return lines
//   ─── divider ───
//   Grand Total                ← always
//   ─── divider ───
//   Payment Mode               ← showPaymentMode
//   Cash / Online breakdown    ← showCashBreakdown (only for BOTH mode)
//   Payment Reference          ← showPaymentReference
//   Change                     ← showChange
//   ─── divider ───
//   footerLines[]              ← admin-configurable, unlimited lines

export interface OsProfile {
  htmlBottomMargin: string;       // e.g. '10mm' — bottom margin for HTML print
  thermalBottomFeedLines: number; // blank lines before paper cut (ESC/POS)
}

/** One configurable line in the header or footer block.
 *  `text` supports token substitution at print time:
 *    {{SHOP_NAME}}  — event.shopName
 *    {{ORG_NAME}}   — event.orgName
 *    {{EVENT_NAME}} — active event name
 *    {{DATE}}       — current date/time in dateTimeFormat
 */
export interface ReceiptLineConfig {
  text: string;
  bold?: boolean;                           // Default: false
  fontSize?: string;                        // e.g. '12px'. Default: '11px'
  alignment?: 'left' | 'center' | 'right'; // Default: 'center'
}

export interface ReceiptEventConfig {
  // ── Print engine ────────────────────────────────────────────────────────────
  currency: {
    displaySymbol: string;    // HTML print — supports Unicode, e.g. '₹'
    thermalFallback: string;  // ESC/POS ASCII-safe fallback, e.g. 'Rs'
  };

  osOverrides: {
    enabled: boolean;
    mac: OsProfile;
    windows: OsProfile;
    linux: OsProfile;
  };

  htmlConfig: {
    paperWidth: string; // e.g. '80mm', '58mm'
    contentWidth: string; // e.g. '70mm'
    margins: { top: string; bottom: string; left: string; right: string };
    padding: string;      // e.g. '5px'
  };

  thermalConfig: {
    charsPerLine: number; // 44 for 80mm normal font, 42 for condensed/small
    leftMarginSpaces: number; // spaces to indent from left edge
    bottomFeedLines: number; // blank lines before cut (OS override takes precedence)
    /** Alignment for TRANSACTION INFO lines (invoice, date, customer, seller).
     *  Defaults to 'left' if not set. */
    infoAlignment?: 'left' | 'center' | 'right';
    /** Alignment for PAYMENT section lines (mode, reference, change).
     *  Defaults to 'left' if not set. */
    paymentAlignment?: 'left' | 'center' | 'right';
  };

  // ── Receipt layout ───────────────────────────────────────────────────────────

  /** Lines printed at the very top, before the first divider.
   *  Supports {{SHOP_NAME}}, {{ORG_NAME}}, {{EVENT_NAME}}, {{DATE}} tokens. */
  headerLines: ReceiptLineConfig[];

  // — Transaction info section —
  showInvoiceNumber: boolean;
  showSaleOrderNumber: boolean;
  showDateTime: boolean;
  /** Format used for {{DATE}} token and the DateTime row.
   *  'locale'       → browser locale full date+time
   *  'date-locale'  → browser locale date only
   *  'dd/mm/yyyy hh:mm' → 24-hour date+time
   *  'dd/mm/yyyy'   → date only
   *  'iso'          → ISO 8601 full string */
  dateTimeFormat: 'locale' | 'date-locale' | 'dd/mm/yyyy hh:mm' | 'dd/mm/yyyy' | 'iso';
  showCustomerName: boolean;
  showCustomerMobile: boolean;
  showSellerUserId: boolean; // Shows sellerName or sellerId from the sale
  /** Print the counter number line. Set to false to suppress it per-event. Default: true */
  showCounterNumber?: boolean;

  // — Items section — (always rendered)
  showReturnDetails: boolean; // Show returned qty and net amount on line items

  // — Payment section —
  showPaymentMode: boolean; // Show "Payment: CASH / ONLINE / BOTH"
  showCashBreakdown: boolean; // Show cash + online split (only relevant for BOTH mode)
  showPaymentReference: boolean; // Show UPI / card reference number
  showChange: boolean; // Show change amount for cash payments

  /** Lines printed at the very bottom, after the last divider.
   *  Supports the same tokens as headerLines. */
  footerLines: ReceiptLineConfig[];

  /** Receiving slip config — printed immediately after the main bill when BOTH
   *  this enabled flag AND shop.receivingPrintEnabled are true.
   *  Completely independent config from the main receipt. */
  receivingPrint: ReceivingReceiptConfig;
}

// ─── Receiving Receipt Config — separate from main ReceiptEventConfig ─────────
//
// Receiving slip layout (in order printed):
//   headerLines[]       ← same token support as main receipt
//   ─── divider ───
//   Invoice Number      ← showInvoiceNumber
//   Date / Time         ← showDateTime
//   Seller              ← showSellerUserId
//   ─── divider ───
//   Items               ← SN. | Item | SKU | Rate | Qty  (no Amount column)
//   ─── divider ───
//   footerLines[]

export interface ReceivingReceiptConfig {
  /** Master switch — event admin enables/disables the receiving slip feature */
  enabled: boolean;

  thermalConfig: {
    charsPerLine: number;       // 44 for 80mm normal font
    leftMarginSpaces: number;
    bottomFeedLines: number;
    /** Alignment for the transaction-info block (Bill No/Date/Seller/Counter).
     *  Applies to BOTH the ESC/POS renderer and the HTML/browser-print fallback.
     *  Defaults to 'left' if not set. */
    infoAlignment?: 'left' | 'center' | 'right';
  };

  htmlConfig: {
    paperWidth: string;         // e.g. '80mm'
    contentWidth: string;
    margins: { top: string; bottom: string; left: string; right: string };
    padding: string;
  };

  /** Same {{SHOP_NAME}}, {{ORG_NAME}}, {{EVENT_NAME}}, {{DATE}} tokens */
  headerLines: ReceiptLineConfig[];

  // ── Transaction info (only these three shown on receiving slip) ───────────
  showInvoiceNumber: boolean;
  showDateTime: boolean;
  dateTimeFormat: 'locale' | 'date-locale' | 'dd/mm/yyyy hh:mm' | 'dd/mm/yyyy' | 'iso';
  showSellerUserId: boolean;
  /** Print the counter number line on the receiving slip. Default: true */
  showCounterNumber?: boolean;
  /** Print the payment mode (CASH/ONLINE/BOTH) line on the receiving slip. Default: true */
  showPaymentMode?: boolean;
  /** Print the payment reference (UTR/Transaction ID) line — only shown when the
   *  order actually has one (i.e. ONLINE or BOTH payment modes). Default: true */
  showPaymentReference?: boolean;

  footerLines: ReceiptLineConfig[];
}

export const DEFAULT_RECEIVING_CONFIG: ReceivingReceiptConfig = {
  enabled: false,

  thermalConfig: {
    charsPerLine: 44, //32
    leftMarginSpaces: 0,
    bottomFeedLines: 4,
    infoAlignment: 'left',
  },

  htmlConfig: {
    paperWidth: '80mm',
    contentWidth: '70mm',
    margins: { top: '0', bottom: '10mm', left: '5mm', right: '5mm' },
    padding: '5px',
  },

  headerLines: [
    { text: '{{SHOP_NAME}}', bold: true, fontSize: '14px', alignment: 'center' },
    { text: '{{ORG_NAME}}', bold: false, fontSize: '11px', alignment: 'center' },
    { text: '{{EVENT_NAME}}', bold: false, fontSize: '11px', alignment: 'center' },
  ],

  showInvoiceNumber: true,
  showDateTime: true,
  dateTimeFormat: 'locale',
  showSellerUserId: true,
  showCounterNumber: true,
  showPaymentMode: true,
  showPaymentReference: true,

  footerLines: [
    { text: 'Receiving Copy', bold: true, fontSize: '10px', alignment: 'center' },
  ],
};

// ─── Defaults — used when an event has no stored receiptConfig ───────────────

export const DEFAULT_RECEIPT_CONFIG: ReceiptEventConfig = {
  currency: {
    displaySymbol: '₹',
    thermalFallback: 'Rs',
  },

  osOverrides: {
    enabled: true,
    mac: { htmlBottomMargin: '10mm', thermalBottomFeedLines: 8 },
    windows: { htmlBottomMargin: '15mm', thermalBottomFeedLines: 5 },
    linux: { htmlBottomMargin: '12mm', thermalBottomFeedLines: 6 },
  },

  htmlConfig: {
    paperWidth: '80mm',
    contentWidth: '70mm',
    margins: { top: '0', bottom: '15mm', left: '5mm', right: '5mm' },
    padding: '5px',
  },

  thermalConfig: {
    charsPerLine: 44, //32
    leftMarginSpaces: 0,
    bottomFeedLines: 6,
    infoAlignment: 'left',
    paymentAlignment: 'left',
  },

  // Header — token-substituted at print time
  headerLines: [
    { text: '{{SHOP_NAME}}', bold: true, fontSize: '14px', alignment: 'center' },
    { text: '{{ORG_NAME}}', bold: false, fontSize: '11px', alignment: 'center' },
    { text: '{{EVENT_NAME}}', bold: false, fontSize: '11px', alignment: 'center' },
  ],

  // Transaction info
  showInvoiceNumber: true,
  showSaleOrderNumber: false,
  showDateTime: true,
  dateTimeFormat: 'locale',
  showCustomerName: true,
  showCustomerMobile: true,
  showSellerUserId: false,
  showCounterNumber: true,

  // Items
  showReturnDetails: true,

  // Payment
  showPaymentMode: true,
  showCashBreakdown: true,
  showPaymentReference: true,
  showChange: true,

  // Footer
  footerLines: [
    { text: 'Thank You| Visit Again||', bold: true, fontSize: '9px', alignment: 'center' },
    { text: '|| Jai Sadguru Deo ||', bold: false, fontSize: '9px', alignment: 'center' },
  ],

  // Receiving slip — disabled by default
  receivingPrint: DEFAULT_RECEIVING_CONFIG,
};
