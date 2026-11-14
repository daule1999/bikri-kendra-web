/**
 * thermalPrinter.ts
 *
 * Single source of truth for all receipt printing.
 *
 *  ┌─────────────────────────────────────────────────────────────────┐
 *  │  BROWSER-SAFE section (used by printer settings UI, etc.)       │
 *  │   - PrinterConfig type                                          │
 *  │   - Storage keys + loadPrinterConfig / savePrinterConfig        │
 *  │   - isThermalEnabled / setThermalEnabled                        │
 *  ├─────────────────────────────────────────────────────────────────┤
 *  │  SHARED PURE section (string-only, works on server + browser)   │
 *  │   - ESC/POS command bytes                                       │
 *  │   - resolveTokens, alignText, twoCol, divider helpers           │
 *  │   - buildEscPos(data, receiptCfg) → string                      │
 *  │     (returns a string of binary chars — caller wraps in Buffer) │
 *  ├─────────────────────────────────────────────────────────────────┤
 *  │  PRINT ORCHESTRATOR (browser-only)                              │
 *  │   - PrintReceiptConfig interface                                │
 *  │   - printBill(bill, config) — dispatches to thermal or HTML     │
 *  └─────────────────────────────────────────────────────────────────┘
 *
 * The API route (app/api/print/route.ts) calls buildEscPos and wraps
 * the result in Buffer.from(str, 'binary') before sending to the printer.
 */

import {
  DEFAULT_RECEIPT_CONFIG,
  DEFAULT_RECEIVING_CONFIG,
  ReceiptEventConfig,
  ReceiptLineConfig,
  ReceivingReceiptConfig,
} from "./recieptConfig";

import { apiClient } from "@/lib/api";
import { getOS } from "./osDetection";

// ── Items fetch cache — prevents double API call when printBill + printReceiving ──
// run back-to-back for the same order. TTL is 30 s — enough to cover both prints.
const _itemsCache = new Map<string, { items: any[]; ts: number }>();
const ITEMS_CACHE_TTL = 30_000;

async function fetchItemsCached(orderNo: string): Promise<any[]> {
  const hit = _itemsCache.get(orderNo);
  if (hit && Date.now() - hit.ts < ITEMS_CACHE_TTL) return hit.items;
  try {
    const res = await apiClient.get(`/billing/invoices/order/${orderNo}/items`);
    if (res.ok) {
      const raw = await res.json();
      const items: any[] = Array.isArray(raw) ? raw : (raw.data ?? []);
      _itemsCache.set(orderNo, { items, ts: Date.now() });
      return items;
    }
  } catch {
    /* fail silently */
  }
  return [];
}

// ─── Printer connection config ────────────────────────────────────────────────

/**
 * How to reach the thermal printer:
 *
 *  auto    → detect OS: CUPS on Mac/Linux, Windows spool on Win32
 *  cups    → explicit `lp -d <printerName>`   (Mac / Linux)
 *  windows → explicit PowerShell winspool      (Windows)
 *  tcp     → raw TCP socket to host:port 9100  (network printer, any OS)
 *  serial  → write bytes to serial device path (USB-serial / COM port)
 */
export type ConnectionType =
  | "auto"
  | "cups"
  | "windows"
  | "tcp"
  | "serial"
  | "webserial"
  | "agent";

export interface PrinterConfig {
  connectionType: ConnectionType;
  /** Printer name for cups / windows / auto */
  printerName: string;
  /** IP / hostname for tcp */
  host: string;
  /** Port for tcp  (default 9100 — ESC/POS standard) */
  port: number;
  /** Device path for serial — e.g. /dev/ttyUSB0  or  COM3 */
  serialPath: string;
  /** Baud rate for serial (default 9600) */
  baudRate: number;
  /**
   * Hostname / IP of the machine running the Local Print Agent.
   * Default: 'localhost' (agent on the same device as the browser).
   * Set to the cashier machine's LAN IP (e.g. '192.168.1.2') when the
   * browser is on a different device on the same network.
   */
  agentHost?: string;
  /**
   * Port the Local Print Agent listens on (default 4321).
   * Used when connectionType === 'agent'.
   */
  agentPort?: number;
  /**
   * Which connection method the agent should use internally.
   * Defaults to 'auto' (CUPS on Mac/Linux, Windows Spooler on Windows).
   * Set to 'tcp' / 'serial' / 'cups' / 'windows' to be explicit.
   */
  agentConnectionType?: "auto" | "cups" | "windows" | "tcp" | "serial";
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

export const THERMAL_ENABLED_KEY = "thermal_enabled";
export const THERMAL_CONFIG_KEY = "thermal_printer_config";

// ─── Browser-side helpers ─────────────────────────────────────────────────────

function defaultPrinterConfig(): PrinterConfig {
  return {
    connectionType: "auto",
    printerName: "ThermalPOS",
    host: "",
    port: 9100,
    serialPath: "",
    baudRate: 9600,
    agentHost: "localhost",
    agentPort: 4321,
    agentConnectionType: "auto",
  };
}

export function loadPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") return defaultPrinterConfig();
  try {
    const raw = localStorage.getItem(THERMAL_CONFIG_KEY);
    if (raw) return { ...defaultPrinterConfig(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultPrinterConfig();
}

export function savePrinterConfig(cfg: PrinterConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THERMAL_CONFIG_KEY, JSON.stringify(cfg));
}

export function isThermalEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(THERMAL_ENABLED_KEY) === "true";
}

export function setThermalEnabled(val: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THERMAL_ENABLED_KEY, String(val));
}

/**
 * One-time migration from the old QZ Tray localStorage keys to the new ones.
 * Call on app mount.
 *
 * Old keys:
 *   qz_enabled       — 'true' / 'false'
 *   qz_printer_name  — plain printer name string
 *
 * New keys:
 *   thermal_enabled        — 'true' / 'false'
 *   thermal_printer_config — JSON PrinterConfig object
 */
export function migrateFromQZTray(): void {
  if (typeof window === "undefined") return;

  const alreadyMigrated =
    localStorage.getItem(THERMAL_ENABLED_KEY) !== null ||
    localStorage.getItem(THERMAL_CONFIG_KEY) !== null;
  if (alreadyMigrated) return; // already using new keys — nothing to do

  const oldEnabled = localStorage.getItem("qz_enabled");
  const oldPrinterName = localStorage.getItem("qz_printer_name");

  if (oldEnabled !== null) {
    localStorage.setItem(THERMAL_ENABLED_KEY, oldEnabled);
    localStorage.removeItem("qz_enabled");
  }
  if (oldPrinterName) {
    const cfg: PrinterConfig = {
      ...defaultPrinterConfig(),
      connectionType: "cups", // QZ Tray was always CUPS-backed on Mac
      printerName: oldPrinterName,
    };
    localStorage.setItem(THERMAL_CONFIG_KEY, JSON.stringify(cfg));
    localStorage.removeItem("qz_printer_name");
  }
}

// ─── Web Serial API (browser-native, Chrome / Edge 89+) ──────────────────────
//
// Allows the browser itself to write raw ESC/POS bytes directly to a USB or
// serial thermal printer — no server-side process needed, so this works
// perfectly on cloud-hosted deployments (Vercel, etc.).
//
// The browser remembers granted ports across sessions via
// navigator.serial.getPorts(), so the user only needs to click "Select Port"
// once.  After that, every print reuses the saved port automatically.

/** Cached port for the current browser tab/session */
let _webSerialPort: any | null = null;

/** Returns true if the Web Serial API is available in this browser */
export function isWebSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

/**
 * Open the browser's port-picker dialog and store the result.
 * MUST be called from a user gesture (button click) — browsers block it
 * otherwise.  Returns true on success, false if the user cancelled.
 */
export async function selectWebSerialPort(): Promise<boolean> {
  if (!isWebSerialSupported()) return false;
  try {
    _webSerialPort = await (navigator as any).serial.requestPort();
    return true;
  } catch {
    return false; // user dismissed the picker
  }
}

/**
 * Returns a port the user previously granted (this session or a past one).
 * Call on mount to auto-restore the port without re-prompting.
 * Returns null if nothing has been granted yet.
 */
export async function getGrantedWebSerialPort(): Promise<any | null> {
  if (_webSerialPort) return _webSerialPort;
  if (!isWebSerialSupported()) return null;
  try {
    const ports = await (navigator as any).serial.getPorts();
    if (ports.length > 0) {
      _webSerialPort = ports[0];
      return _webSerialPort;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Write a binary ESC/POS string to the selected serial port.
 * Opens the port first if it isn't already open.
 *
 * Throws if no port has been selected — caller should fall back to HTML print.
 */
export async function printViaWebSerial(
  escPosString: string,
  baudRate = 9600,
): Promise<void> {
  if (!isWebSerialSupported()) {
    throw new Error(
      "Web Serial API is not supported in this browser. Use Chrome or Edge 89+, or switch to Local Print Agent.",
    );
  }

  let port = _webSerialPort ?? (await getGrantedWebSerialPort());
  if (!port) {
    throw new Error(
      "No serial port selected. Open Printer Settings → Select Port first.",
    );
  }

  // Open the port if closed. port.writable is a WritableStream while open,
  // null when closed. On first print of a new page session it will be null —
  // port.open() is automatic here and requires NO user gesture.
  if (!port.writable) {
    try {
      await port.open({ baudRate });
    } catch (openErr: any) {
      const msg = String(openErr?.message ?? "");
      if (msg.includes("already open")) {
        /* concurrent call already opened it — fall through */
      } else {
        // Port may be in an error state (USB unplugged / replugged).
        // Refresh the reference from the browser's granted-port list and retry.
        _webSerialPort = null;
        const fresh = await getGrantedWebSerialPort();
        if (!fresh) throw openErr;
        port = fresh;
        _webSerialPort = port;
        if (!port.writable) await port.open({ baudRate });
      }
    }
  }

  const writer = (port.writable as WritableStream<Uint8Array>).getWriter();
  try {
    const buf = new Uint8Array(escPosString.length);
    for (let i = 0; i < escPosString.length; i++) {
      buf[i] = escPosString.charCodeAt(i) & 0xff;
    }
    await writer.write(buf);
  } finally {
    writer.releaseLock();
  }
}

// ─── Local Print Agent (browser → localhost:4321) ────────────────────────────
//
// The Local Print Agent is a tiny Node.js server that runs on the cashier's
// machine (see print-agent/index.js).  The browser POSTs the pre-built ESC/POS
// string (base64) to http://localhost:4321/print, and the agent dispatches it
// using whichever local method is configured (CUPS / Windows / TCP / serial).
//
// This works from cloud-hosted apps because the POST goes to localhost —
// the agent is on the same machine as the browser, not on the Vercel server.

/**
 * Send a pre-built ESC/POS binary string to the Local Print Agent.
 *
 * @param escPosString  binary string (one char per byte) — from buildEscPos()
 * @param cfg           the full PrinterConfig so the agent knows which method to use
 */
export async function printViaAgent(
  escPosString: string,
  cfg: PrinterConfig,
): Promise<void> {
  const host = cfg.agentHost ?? "localhost";
  const port = cfg.agentPort ?? 4321;
  // Convert binary string → base64 for safe JSON transport
  const base64 = btoa(
    Array.from({ length: escPosString.length }, (_, i) =>
      String.fromCharCode(escPosString.charCodeAt(i) & 0xff),
    ).join(""),
  );

  // Tell the agent which method to use internally.
  // agentConnectionType is what the agent dispatches on (cups/windows/tcp/serial/auto).
  // The rest of the config fields (printerName, host, port, serialPath, baudRate) are forwarded as-is.
  const agentInternalCfg = {
    ...cfg,
    connectionType: cfg.agentConnectionType ?? "auto",
  };

  const agentUrl = `http://${host}:${port}`;

  // ── Mixed Content guard ───────────────────────────────────────────────────
  // Chrome 94+ and modern Firefox explicitly exempt http://localhost from mixed
  // content blocking (localhost is a "potentially trustworthy origin" per spec).
  // Only block upfront for NON-localhost hosts — a remote agent over plain HTTP
  // will definitely be blocked by the browser.
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  if (
    !isLocalhost &&
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
  ) {
    throw new Error(
      `Mixed Content blocked: your app runs on HTTPS but the Print Agent at ${agentUrl} is HTTP. ` +
        `Either run the agent on the same machine as the browser (use localhost) ` +
        `or enable HTTPS on the agent.`,
    );
  }

  // Windows PowerShell Add-Type compiles C# on first call — can take 15–60 s.
  // The agent itself waits up to 60 s for PowerShell, so we must wait at least
  // that long on the browser side. 70 s gives a 10 s buffer.
  const TIMEOUT_MS = 70_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${agentUrl}/print`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerConfig: agentInternalCfg,
        rawEscPos: base64,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(
        `Print Agent timed out (${TIMEOUT_MS / 1000} s) — is it running on ${agentUrl}? Run: cd print-agent && node index.js`,
      );
    }
    // Network error: agent not running, wrong IP, firewall, or mixed-content block.
    const onHttps =
      typeof window !== "undefined" && window.location.protocol === "https:";
    const mixedContentHint =
      onHttps && isLocalhost
        ? ` (If Chrome shows a mixed-content error, click 🔒 → Site settings → Insecure content → Allow for this site.)`
        : "";
    throw new Error(
      `Print Agent unreachable (${agentUrl}): ${err?.message ?? err}. ` +
        (isLocalhost
          ? `Make sure the agent is running: cd print-agent && node index.js${mixedContentHint}`
          : `Check that the agent is running on ${host} with AGENT_BIND=0.0.0.0 and that your firewall allows port ${port}.`),
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Agent error: ${body || res.statusText}`);
  }
}

// ─── ESC/POS command constants (Epson-compatible) ────────────────────────────
//
// Using ESC ! (0x21) family exclusively — same bytes qzPrint.ts used,
// confirmed working on Epson POS-80.

export const ESC_POS = {
  INIT: "\x1B\x40", // Initialize printer (clear buffer, reset modes)
  BOLD_ON: "\x1B\x21\x08", // ESC ! 0x08 — bold on
  NORMAL: "\x1B\x21\x00", // ESC ! 0x00 — reset all print modes
  DBL_H: "\x1B\x21\x10", // ESC ! 0x10 — double height
  DBL_HW: "\x1B\x21\x30", // ESC ! 0x30 — double height + width
  ALIGN_L: "\x1B\x61\x00", // ESC a 0 — justify left  (printer power-on default)
  ALIGN_C: "\x1B\x61\x01", // ESC a 1 — justify center (hardware-centered to paper width)
  ALIGN_R: "\x1B\x61\x02", // ESC a 2 — justify right
  FULL_CUT: "\x1D\x56\x00", // GS V 0     — full paper cut
} as const;

/**
 * Hardware ESC/POS justification command for a line's alignment.
 * Unlike alignText() (which space-pads against `charsPerLine`, so a 44-col pad
 * looks left-shoved on a 42/48-col head), this justifies to the printer's real
 * paper width — header/footer center correctly regardless of charsPerLine.
 * Remember to emit ESC_POS.ALIGN_L again before column rows / dividers.
 */
export function alignCmd(a: "left" | "center" | "right" = "center"): string {
  return a === "center"
    ? ESC_POS.ALIGN_C
    : a === "right"
      ? ESC_POS.ALIGN_R
      : ESC_POS.ALIGN_L;
}

// ─── Pure text helpers ────────────────────────────────────────────────────────

/** Replace {{TOKEN}} placeholders in a line's text */
export function resolveTokens(text: string, data: any): string {
  return text
    .replace(/\{\{SHOP_NAME\}\}/g, data.shopName || "")
    .replace(/\{\{ORG_NAME\}\}/g, data.orgName || "")
    .replace(/\{\{EVENT_NAME\}\}/g, data.eventName || "")
    .replace(/\{\{DATE\}\}/g, data.date || "")
    .replace(/\{\{COUNTER_NO\}\}/g, data.counterNo || "");
}

/** Align text within usable width, then add left margin */
export function alignText(
  text: string,
  alignment: "left" | "center" | "right" = "center",
  W: number,
  LM = 0,
): string {
  const usable = W - LM;
  const margin = " ".repeat(LM);
  if (alignment === "center") {
    const pad = Math.max(0, Math.floor((usable - text.length) / 2));
    return margin + " ".repeat(pad) + text;
  }
  if (alignment === "right") {
    const pad = Math.max(0, usable - text.length);
    return margin + " ".repeat(pad) + text;
  }
  return margin + text; // left
}

/** Two-column row: left text ... right text */
export function twoCol(left: string, right: string, W: number, LM = 0): string {
  const usable = W - LM;
  const gap = Math.max(1, usable - left.length - right.length);
  return " ".repeat(LM) + left + " ".repeat(gap) + right;
}

/** Full-width divider line */
export function divider(W: number): string {
  return "-".repeat(W);
}

/**
 * ESC/POS print mode command for a ReceiptLineConfig entry.
 * Maps the HTML-centric fontSize + bold flags to ESC ! byte values.
 * Returns '' (empty string) when no special mode is needed.
 */
export function printModeOn(line: {
  bold?: boolean;
  fontSize?: string;
}): string {
  const px = parseInt(line.fontSize || "11");
  if (px >= 14 && line.bold) return ESC_POS.DBL_HW;
  if (px >= 14) return ESC_POS.DBL_H;
  if (line.bold) return ESC_POS.BOLD_ON;
  return "";
}

// ─── Main ESC/POS receipt builder ────────────────────────────────────────────
//
// Returns a string of binary characters (one char per byte).
// The API route wraps it: Buffer.from(buildEscPos(...), 'binary')
//
// data       — receipt field values: shopName, orgName, eventName, date,
//              invoiceNo, orderNo, customerName, customerMobile, sellerDisplay,
//              currency, items[], total, paymentMode, cashAmount, onlineAmount,
//              paymentReference, change
//
// receiptCfg — the event's ReceiptEventConfig (headerLines, footerLines,
//              thermalConfig, show* flags).  Falls back to safe defaults
//              if not provided, so the builder always produces valid output.

export function buildEscPos(data: any, receiptCfg?: any): string {
  const cfg = receiptCfg || {};

  // ── Thermal layout config ─────────────────────────────────────────────────
  const tc = cfg.thermalConfig || {};
  const W: number = tc.charsPerLine ?? 44; // chars per line (44 = 80mm normal font) //32
  const LM: number = tc.leftMarginSpaces ?? 0; // left indent spaces
  const feedLines: number = tc.bottomFeedLines ?? 6; // blank lines before cut
  // Alignment for TRANSACTION INFO and PAYMENT sections — configurable per event
  const infoAlign: "left" | "center" | "right" = tc.infoAlignment ?? "left";
  const paymentAlign: "left" | "center" | "right" =
    tc.paymentAlignment ?? "left";

  // ── Currency ──────────────────────────────────────────────────────────────
  const cur = (data.currency || "Rs").replace("₹", "Rs");

  // ── Show / hide flags ─────────────────────────────────────────────────────
  const show = {
    invoiceNumber: cfg.showInvoiceNumber ?? true,
    saleOrderNumber: cfg.showSaleOrderNumber ?? false,
    dateTime: cfg.showDateTime ?? true,
    customerName: cfg.showCustomerName ?? true,
    customerMobile: cfg.showCustomerMobile ?? true,
    sellerUserId: cfg.showSellerUserId ?? false,
    counterNumber: cfg.showCounterNumber !== false, // default true
    returnDetails: cfg.showReturnDetails ?? true,
    paymentMode: cfg.showPaymentMode ?? true,
    cashBreakdown: cfg.showCashBreakdown ?? true,
    paymentReference: cfg.showPaymentReference ?? true,
    change: cfg.showChange ?? true,
  };

  const parts: string[] = [ESC_POS.INIT];

  // ── HEADER LINES (from receiptConfig.headerLines) ─────────────────────────
  // Each line is a ReceiptLineConfig: { text, bold?, fontSize?, alignment? }
  // Text supports {{SHOP_NAME}} {{ORG_NAME}} {{EVENT_NAME}} {{DATE}} tokens.

  const headerLines: any[] = cfg.headerLines ?? [
    {
      text: "{{SHOP_NAME}}",
      bold: true,
      fontSize: "14px",
      alignment: "center",
    },
    {
      text: "{{ORG_NAME}}",
      bold: false,
      fontSize: "11px",
      alignment: "center",
    },
    {
      text: "{{EVENT_NAME}}",
      bold: false,
      fontSize: "11px",
      alignment: "center",
    },
  ];

  for (const hl of headerLines) {
    const text = resolveTokens(hl.text, data).trim();
    if (!text) continue;

    const align = hl.alignment ?? "center";
    const modeCmd = printModeOn(hl);
    parts.push(alignCmd(align)); // hardware justify — centers to real paper width
    if (modeCmd) parts.push(modeCmd);
    parts.push((align === "left" ? " ".repeat(LM) : "") + text + "\n");
    if (modeCmd) parts.push(ESC_POS.NORMAL);
  }

  parts.push(ESC_POS.ALIGN_L); // reset to left so dividers / columns below are not centered
  parts.push(divider(W) + "\n");

  // ── TRANSACTION INFO ──────────────────────────────────────────────────────
  // Alignment is controlled by thermalConfig.infoAlignment (default: 'left')

  if (show.invoiceNumber && data.invoiceNo) {
    parts.push(
      alignText("Bill No : " + data.invoiceNo, infoAlign, W, LM) + "\n",
    );
  }
  // Date goes here — after invoice, before customer (NOT in header)
  if (show.dateTime && data.date) {
    parts.push(alignText("Date    : " + data.date, infoAlign, W, LM) + "\n");
  }
  if (show.saleOrderNumber && data.orderNo) {
    parts.push(alignText("Order   : " + data.orderNo, infoAlign, W, LM) + "\n");
  }
  if (show.customerName && data.customerName) {
    parts.push(
      alignText("Customer: " + data.customerName, infoAlign, W, LM) + "\n",
    );
  }
  if (show.customerMobile && data.customerMobile) {
    parts.push(
      alignText("Mobile  : " + data.customerMobile, infoAlign, W, LM) + "\n",
    );
  }
  if (show.sellerUserId && data.sellerDisplay) {
    parts.push(
      alignText("Seller  : " + data.sellerDisplay, infoAlign, W, LM) + "\n",
    );
  }
  if (show.counterNumber && data.counterNo) {
    parts.push(
      alignText("Counter : " + data.counterNo, infoAlign, W, LM) + "\n",
    );
  }

  parts.push(divider(W) + "\n");

  // ── 5-column item table header: SN. | Item | Rate | Qty | Amt ─────────────
  // Fixed column widths that sum to (W - LM).
  // snW=4  rateW=5  qtyW=4  amtW=4  itemW=remainder
  {
    const snW = 4;
    const rateW = 5;
    const qtyW = 4;
    const amtW = 4;
    const itemW = Math.max(4, W - LM - snW - rateW - qtyW - amtW);
    parts.push(
      " ".repeat(LM) +
        "SN.".padEnd(snW) +
        "Item".padEnd(itemW) +
        "Rate".padStart(rateW) +
        "Qty".padStart(qtyW) +
        "Amt".padStart(amtW) +
        "\n",
    );
  }

  parts.push(divider(W) + "\n");

  // ── ITEMS ─────────────────────────────────────────────────────────────────
  // Each item prints as two lines:
  //   Line 1:  {sNo}. {product name}
  //   Line 2:       {price} x {qty}         {line total}   (5-space indent)
  //
  // Returns use the same indent with a 3-line billed / return / net breakdown.

  let netTotal = 0;
  const items: any[] = data.items ?? [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sNo = i + 1;
    const qty = Number(item.quantity ?? 0);
    const retQty = Number(item.returnedQuantity ?? 0);
    const netQty = qty - retQty;
    const price = Number(item.sellingPrice ?? 0);
    const itTotal = netQty * price;
    netTotal += itTotal;

    const name = item.productName ?? "Product";
    const displayName = name.length > 28 ? name.slice(0, 28) + ".." : name;

    // Line 1 — serial number + product name
    parts.push(" ".repeat(LM) + `${sNo}. ` + displayName + "\n");

    if (show.returnDetails && retQty > 0) {
      // 3-line deduction format (ESC/POS cannot strikethrough on thermal paper)
      // Line 2a — original billed
      parts.push(
        twoCol(
          `     Billed: ${cur}${price.toFixed(0)} x ${qty}`,
          `${cur}${(qty * price).toFixed(0)}`,
          W,
          LM,
        ) + "\n",
      );
      // Line 2b — return deduction
      parts.push(
        twoCol(
          `     Return: ${cur}${price.toFixed(0)} x -${retQty}`,
          `-${cur}${(retQty * price).toFixed(0)}`,
          W,
          LM,
        ) + "\n",
      );
      // Line 2c — net (bold)
      parts.push(ESC_POS.BOLD_ON);
      parts.push(
        twoCol(
          `     Net: ${cur}${price.toFixed(0)} x ${netQty}`,
          `${cur}${itTotal.toFixed(0)}`,
          W,
          LM,
        ) + "\n",
      );
      parts.push(ESC_POS.NORMAL);
    } else {
      // Line 2 — rate x qty → right-aligned amount
      parts.push(
        twoCol(
          `     ${cur}${price.toFixed(0)} x ${netQty}`,
          `${cur}${itTotal.toFixed(0)}`,
          W,
          LM,
        ) + "\n",
      );
    }
  }

  const displayTotal = netTotal > 0 ? netTotal : Number(data.total ?? 0);

  // ── TOTAL ─────────────────────────────────────────────────────────────────

  parts.push(divider(W) + "\n");
  parts.push(ESC_POS.BOLD_ON);
  parts.push(twoCol("TOTAL", `${cur}${displayTotal.toFixed(0)}`, W, LM) + "\n");
  parts.push(ESC_POS.NORMAL);
  parts.push(divider(W) + "\n");

  // ── PAYMENT ───────────────────────────────────────────────────────────────
  // Alignment controlled by thermalConfig.paymentAlignment (default: 'left')

  if (show.paymentMode && data.paymentMode) {
    parts.push(
      alignText("Payment : " + data.paymentMode, paymentAlign, W, LM) + "\n",
    );
  }
  if (show.cashBreakdown && data.paymentMode === "BOTH") {
    parts.push(
      twoCol(
        "Cash",
        `${cur}${Number(data.cashAmount ?? 0).toFixed(0)}`,
        W,
        LM,
      ) + "\n",
    );
    parts.push(
      twoCol(
        "Online",
        `${cur}${Number(data.onlineAmount ?? 0).toFixed(0)}`,
        W,
        LM,
      ) + "\n",
    );
  }
  if (show.paymentReference && data.paymentReference) {
    parts.push(
      alignText("Ref: " + data.paymentReference, paymentAlign, W, LM) + "\n",
    );
  }
  if (show.change && data.change && Number(data.change) > 0) {
    parts.push(
      twoCol("Change", `${cur}${Number(data.change).toFixed(0)}`, W, LM) + "\n",
    );
  }

  parts.push(divider(W) + "\n");

  // ── FOOTER LINES (from receiptConfig.footerLines) ─────────────────────────

  const footerLines: any[] = cfg.footerLines ?? [
    { text: "THANK YOU!", bold: true, fontSize: "11px", alignment: "center" },
    { text: "Visit Again", bold: false, fontSize: "11px", alignment: "center" },
  ];

  for (const fl of footerLines) {
    const text = resolveTokens(fl.text, data).trim();
    if (!text) continue;
    const align = fl.alignment ?? "center";
    const modeCmd = printModeOn(fl);
    parts.push(alignCmd(align)); // hardware justify — centers to real paper width
    if (modeCmd) parts.push(modeCmd);
    parts.push((align === "left" ? " ".repeat(LM) : "") + text + "\n");
    if (modeCmd) parts.push(ESC_POS.NORMAL);
  }

  // ── FEED + CUT ────────────────────────────────────────────────────────────

  parts.push(ESC_POS.ALIGN_L); // reset justification before feed/cut
  parts.push("\n".repeat(Math.max(1, feedLines)));
  parts.push(ESC_POS.FULL_CUT);

  return parts.filter((p) => p !== "").join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// PRINT ORCHESTRATOR — browser-only
// Handles both thermal (ESC/POS via /api/print) and HTML browser fallback.
// Previously lived in lib/printBill.ts — consolidated here as single source.
// ─────────────────────────────────────────────────────────────────────────────

export interface PrintReceiptConfig {
  shopName: string;
  orgName: string;
  eventName?: string;
  /** Counter number printed on both main bill and receiving slip */
  counterNumber?: number;
  eventConfigPayload: ReceiptEventConfig;
}

/** Format a date string according to the chosen dateTimeFormat */
function formatDateTime(
  raw: string | undefined,
  format: ReceiptEventConfig["dateTimeFormat"],
): string {
  // Always parse with IST fallback for naive backend strings
  const hasOffset = raw
    ? /T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(raw)
    : false;
  const d = raw ? new Date(hasOffset ? raw : raw + "+05:30") : new Date();
  const IST_TZ = "Asia/Kolkata";
  const pad = (n: number) => String(n).padStart(2, "0");
  // Extract IST wall-clock parts for manual formats
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: IST_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(d)
    .reduce(
      (acc, p) => {
        acc[p.type] = p.value;
        return acc;
      },
      {} as Record<string, string>,
    );
  const date = `${parts.day}/${parts.month}/${parts.year}`;
  const time = `${parts.hour}:${parts.minute}`;
  switch (format) {
    case "dd/mm/yyyy hh:mm":
      return `${date} ${time}`;
    case "dd/mm/yyyy":
      return date;
    case "date-locale":
      return d.toLocaleDateString("en-IN", { timeZone: IST_TZ });
    case "iso":
      return d.toISOString();
    case "locale":
    default:
      return d.toLocaleString("en-IN", { timeZone: IST_TZ });
  }
}

/**
 * Normalize a user-typed CSS length so it's never invalid inside `calc()` or as a
 * plain declaration.
 *
 * The admin form's margin/padding/width fields are free-text inputs with no unit
 * enforcement (the Padding field doesn't even have a placeholder hinting at one).
 * CSS length values are only allowed to be unitless when they're exactly `0` —
 * ANY other bare number (e.g. an admin typing "15" instead of "15mm") is invalid
 * CSS. Browsers don't warn about this; they just silently drop the whole
 * declaration, which is indistinguishable from "the setting does nothing" —
 * exactly the "margin/padding not working" symptom. This assumes millimeters for
 * a bare number since that's the unit used everywhere else in receipt config
 * (paper width, content width).
 */
function toCssLength(
  value: string | undefined | null,
  fallback = "0px",
): string {
  const trimmed = (value ?? "").toString().trim();
  if (!trimmed) return fallback;
  if (trimmed === "0") return "0px";
  // Already has a recognizable CSS length/percentage unit — use as-is.
  if (/^-?\d*\.?\d+(mm|cm|in|px|pt|pc|em|rem|q|vw|vh|%)$/i.test(trimmed))
    return trimmed;
  // Bare number with no unit — assume millimeters rather than emit invalid CSS.
  if (/^-?\d*\.?\d+$/.test(trimmed)) return `${trimmed}mm`;
  // Anything else unrecognized — don't risk invalid CSS, fall back.
  return fallback;
}

/**
 * Convert a CSS length string to a whole number of pixels, for sizing a real DOM
 * spacer element rather than relying on body padding/margin. Some browser/printer-driver
 * combinations strip or ignore page-level CSS padding when actually printing — an actual
 * block element taking up layout space in the document flow is much harder for a driver
 * to silently discard than a CSS box-model property is. Defaults to 4px (the smallest
 * spacer that reliably shows on thermal-width receipts) when the value is missing/unparseable.
 */
function lengthToPx(value: string | undefined | null, fallbackPx = 4): number {
  const resolved = toCssLength(value, `${fallbackPx}px`);
  const match = /^(-?\d*\.?\d+)(mm|cm|in|px|pt|pc)$/i.exec(resolved);
  if (!match) return fallbackPx;
  const num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const pxPerUnit: Record<string, number> = {
    px: 1,
    mm: 96 / 25.4,
    cm: 96 / 2.54,
    in: 96,
    pt: 96 / 72,
    pc: 16,
  };
  return Math.max(0, Math.round(num * (pxPerUnit[unit] ?? 1)));
}

/** Build the CSS for the HTML print iframe */
function generateDynamicCSS(cfg: ReceiptEventConfig): string {
  let bottomMargin = toCssLength(cfg.htmlConfig.margins.bottom);
  if (cfg.osOverrides.enabled) {
    const os = getOS();
    if (os === "mac")
      bottomMargin = toCssLength(
        cfg.osOverrides.mac.htmlBottomMargin,
        bottomMargin,
      );
    if (os === "windows")
      bottomMargin = toCssLength(
        cfg.osOverrides.windows.htmlBottomMargin,
        bottomMargin,
      );
    if (os === "linux")
      bottomMargin = toCssLength(
        cfg.osOverrides.linux?.htmlBottomMargin,
        bottomMargin,
      );
  }
  const mTop = toCssLength(cfg.htmlConfig.margins.top);
  const mLeft = toCssLength(cfg.htmlConfig.margins.left);
  const mRight = toCssLength(cfg.htmlConfig.margins.right);
  const pad = toCssLength(cfg.htmlConfig.padding);
  const contentWidth = toCssLength(cfg.htmlConfig.contentWidth, "70mm");
  const paperWidth = toCssLength(cfg.htmlConfig.paperWidth, "80mm");
  return `
  <style>
    @media print {
      @page { margin:0; size:${paperWidth} auto; }
      body {
        box-sizing: border-box !important;
        margin: 0 !important;
        width: ${contentWidth} !important;
        padding-top: calc(${mTop} + ${pad}) !important;
        padding-left: calc(${mLeft} + ${pad}) !important;
        padding-right: calc(${mRight} + ${pad}) !important;
        padding-bottom: calc(${bottomMargin} + ${pad}) !important;
      }
    }
    body {
      box-sizing: border-box;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.3;
      width: ${contentWidth};
      margin: 0 auto;
      padding: ${pad};
      color: #000;
    }
    .center { text-align: center; }
    .right  { text-align: right; }
    .left   { text-align: left; }
    .bold   { font-weight: bold; }
    .line   { border-top: 1px dashed #000; margin: 5px 0; }
    .row    { display: flex; justify-content: space-between; align-items: baseline; }
    .total-row { font-weight: bold; font-size: 14px; margin-top: 4px; }
    .label  { font-size: 11px; }
    .small  { font-size: 10px; color: #333; }
  </style>`;
}

/** Render a ReceiptLineConfig[] block into HTML — uses the shared resolveTokens(text, data) */
function renderLinesHtml(
  lines: ReceiptLineConfig[],
  shopName: string,
  orgName: string,
  eventName: string,
  dateStr: string,
): string {
  const tokenData = { shopName, orgName, eventName, date: dateStr };
  return lines
    .map((line) => {
      const text = resolveTokens(line.text, tokenData);
      if (!text.trim()) return "";
      const align = line.alignment || "center";
      const bold = line.bold ? "font-weight:bold;" : "";
      const size = line.fontSize ? `font-size:${line.fontSize};` : "";
      return `<div style="text-align:${align};${bold}${size}">${text}</div>`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * printBill — unified print entry point.
 *
 * 1. If thermal printing is enabled, dispatches to /api/print (ESC/POS).
 * 2. Falls back to an HTML iframe browser print on failure or when thermal is off.
 *
 * Import from '@/lib/thermalPrinter' — this is the single source of truth.
 */
/**
 * Build the bill's ESC/POS bytes (same mapping as printBill) WITHOUT printing — used by the
 * Central Printer queue so a cross-device "Print" submits a fully-rendered job to the target
 * printer's station instead of printing on the local machine.
 */
export async function buildBillEscPosForCentral(
  bill: any,
  userConfig: PrintReceiptConfig,
): Promise<{
  escpos: string;
  receiptData: any;
  orderNo: string;
  invNo: string;
}> {
  const rawCfg = userConfig.eventConfigPayload;
  const cfg: ReceiptEventConfig = rawCfg ?? DEFAULT_RECEIPT_CONFIG;

  const shopName = userConfig.shopName || "";
  const orgName = userConfig.orgName || "";
  const eventName = userConfig.eventName || "";
  const counterNo = userConfig.counterNumber
    ? String(userConfig.counterNumber)
    : "";

  const orderNo = bill.salesOrderNumber || bill.orderNumber || "—";
  const invNo =
    bill.invoiceId || bill.invoiceNo || bill.billingInvoiceNumber || "—";
  const amount = Number(
    bill.totalAmount || bill.netAmount || bill.orderSubtotal || 0,
  );
  const dateStr = formatDateTime(
    bill.billingDate || bill.createdAt,
    cfg.dateTimeFormat || "locale",
  );
  const sellerDisplay =
    bill.sellerName ||
    (bill.sellerId ? `#${bill.sellerId}` : "") ||
    (bill.billedBy ? `#${bill.billedBy}` : "");

  let items: any[] = bill.items || [];
  if (items.length === 0 && orderNo !== "—")
    items = await fetchItemsCached(orderNo);

  const netTotal = items.reduce((sum: number, item: any) => {
    const netQty =
      Number(item.quantity || 0) - Number(item.returnedQuantity || 0);
    return sum + netQty * Number(item.sellingPrice || item.unitPrice || 0);
  }, 0);
  const displayTotal = items.length > 0 ? netTotal : amount;

  const receiptData = {
    shopName,
    orgName,
    eventName,
    date: dateStr,
    invoiceNo: invNo,
    orderNo,
    counterNo,
    customerName: bill.customerName || "Guest",
    customerMobile: bill.customerMobile || "",
    sellerDisplay,
    currency: cfg.currency?.thermalFallback || "Rs",
    items: items.map((i: any) => ({
      productName: i.productName || "Product",
      quantity: Number(i.quantity || 0),
      returnedQuantity: Number(i.returnedQuantity || 0),
      sellingPrice: Number(i.sellingPrice || i.unitPrice || 0),
    })),
    total: displayTotal,
    paymentMode: bill.paymentMode || bill.payment_mode || "CASH",
    cashAmount: Number(bill.cashReceived || bill.cashAmount || 0),
    onlineAmount: Number(bill.onlineAmount || 0),
    paymentReference: bill.paymentReference || "",
    change: Number(bill.change || 0),
  };

  return {
    escpos: buildEscPos(receiptData, cfg),
    receiptData,
    orderNo: String(orderNo),
    invNo: String(invNo),
  };
}

/**
 * Build the RECEIVING slip's ESC/POS bytes (same mapping as printReceiving) WITHOUT printing —
 * mirror of buildBillEscPosForCentral so the receiving slip can be submitted to the central queue
 * (jobType RECEIVING) alongside the bill, instead of always printing on the local machine.
 */
export async function buildReceivingEscPosForCentral(
  bill: any,
  userConfig: PrintReceiptConfig,
): Promise<{
  escpos: string;
  receiptData: any;
  orderNo: string;
  invNo: string;
}> {
  const cfg: ReceiptEventConfig =
    userConfig.eventConfigPayload ?? DEFAULT_RECEIPT_CONFIG;
  const rc: ReceivingReceiptConfig =
    cfg.receivingPrint ?? DEFAULT_RECEIVING_CONFIG;

  const shopName = userConfig.shopName || "";
  const orgName = userConfig.orgName || "";
  const eventName = userConfig.eventName || "";
  const counterNo = userConfig.counterNumber
    ? String(userConfig.counterNumber)
    : "";

  const orderNo = bill.salesOrderNumber || bill.orderNumber || "—";
  const invNo =
    bill.invoiceId || bill.invoiceNo || bill.billingInvoiceNumber || "—";
  const dateStr = formatDateTime(
    bill.billingDate || bill.createdAt,
    rc.dateTimeFormat ?? "locale",
  );
  const sellerDisplay =
    bill.sellerName ||
    (bill.sellerId ? `#${bill.sellerId}` : "") ||
    (bill.billedBy ? `#${bill.billedBy}` : "");

  let items: any[] = bill.items || [];
  if (items.length === 0 && orderNo !== "—")
    items = await fetchItemsCached(orderNo);

  const receiptData = {
    shopName,
    orgName,
    eventName,
    date: dateStr,
    invoiceNo: invNo,
    sellerDisplay,
    counterNo,
    paymentMode: bill.paymentMode || bill.payment_mode || "CASH",
    paymentReference: bill.paymentReference || "",
    currency: cfg.currency?.thermalFallback || "Rs",
    items: items.map((i: any) => ({
      productName: i.productName || "Product",
      productSku: i.productSku || i.sku || "",
      hsnCode: i.hsnCode || "",
      quantity: Number(i.quantity || 0),
      returnedQuantity: Number(i.returnedQuantity || 0),
      sellingPrice: Number(i.sellingPrice || i.unitPrice || 0),
    })),
  };

  return {
    escpos: buildEscPosReceiving(receiptData, rc),
    receiptData,
    orderNo: String(orderNo),
    invNo: String(invNo),
  };
}

export const printBill = async (
  bill: any,
  userConfig: PrintReceiptConfig,
): Promise<void> => {
  // Use event config if provided; individual missing sub-fields fall back via ?? at usage sites.
  const rawCfg = userConfig.eventConfigPayload;
  const cfg: ReceiptEventConfig = rawCfg ?? DEFAULT_RECEIPT_CONFIG;
  const cur = cfg.currency?.displaySymbol || "₹";

  const shopName = userConfig.shopName || "";
  const orgName = userConfig.orgName || "";
  const eventName = userConfig.eventName || "";
  const counterNo = userConfig.counterNumber
    ? String(userConfig.counterNumber)
    : "";

  const orderNo = bill.salesOrderNumber || bill.orderNumber || "—";
  const invNo =
    bill.invoiceId || bill.invoiceNo || bill.billingInvoiceNumber || "—";
  const amount = Number(
    bill.totalAmount || bill.netAmount || bill.orderSubtotal || 0,
  );
  const rawDate = bill.billingDate || bill.createdAt;
  const dateStr = formatDateTime(rawDate, cfg.dateTimeFormat || "locale");

  const sellerDisplay =
    bill.sellerName ||
    (bill.sellerId ? `#${bill.sellerId}` : "") ||
    (bill.billedBy ? `#${bill.billedBy}` : "");

  // Fetch line items if not included in bill payload (cache shared with printReceiving)
  let items: any[] = bill.items || [];
  if (items.length === 0 && orderNo !== "—") {
    items = await fetchItemsCached(orderNo);
  }

  const netTotal = items.reduce((sum: number, item: any) => {
    const netQty =
      Number(item.quantity || 0) - Number(item.returnedQuantity || 0);
    return sum + netQty * Number(item.sellingPrice || item.unitPrice || 0);
  }, 0);
  const hasReturns = items.some(
    (item: any) => Number(item.returnedQuantity || 0) > 0,
  );
  // Use netTotal when items are available (even if 0 due to full returns).
  // Only fall back to the raw bill amount when item fetch failed entirely.
  const displayTotal = items.length > 0 ? netTotal : amount;

  // ── Thermal print (ESC/POS) ───────────────────────────────────────────────
  if (isThermalEnabled()) {
    const printerCfg = loadPrinterConfig();

    // Shared receipt data object used by both paths below
    const receiptData = {
      shopName,
      orgName,
      eventName,
      date: dateStr,
      invoiceNo: invNo,
      orderNo,
      counterNo,
      customerName: bill.customerName || "Guest",
      customerMobile: bill.customerMobile || "",
      sellerDisplay,
      currency: cfg.currency?.thermalFallback || "Rs",
      items: items.map((i: any) => ({
        productName: i.productName || "Product",
        quantity: Number(i.quantity || 0),
        returnedQuantity: Number(i.returnedQuantity || 0),
        sellingPrice: Number(i.sellingPrice || i.unitPrice || 0),
      })),
      total: displayTotal,
      paymentMode: bill.paymentMode || bill.payment_mode || "CASH",
      cashAmount: Number(bill.cashReceived || bill.cashAmount || 0),
      onlineAmount: Number(bill.onlineAmount || 0),
      paymentReference: bill.paymentReference || "",
      change: Number(bill.change || 0),
    };

    /** Emit a window event so billing pages can show a toast on thermal failure */
    const emitFallback = (reason: string) => {
      try {
        window.dispatchEvent(
          new CustomEvent("thermalPrintFallback", { detail: { reason } }),
        );
      } catch {
        /* SSR / non-browser */
      }
      console.warn("[printBill] thermal failed —", reason);
    };

    if (printerCfg.connectionType === "webserial") {
      // ── Browser-native Web Serial: write ESC/POS bytes directly from browser ─
      // Works on cloud-hosted deployments — no server process needed (Chrome/Edge).
      if (!isWebSerialSupported()) {
        emitFallback(
          "Web Serial API requires Chrome or Edge 89+. Switch to Local Print Agent for cross-browser support.",
        );
      } else {
        try {
          const escStr = buildEscPos(receiptData, cfg);
          await printViaWebSerial(escStr, printerCfg.baudRate);
          return;
        } catch (err: any) {
          emitFallback(`Web Serial: ${err?.message ?? err}`);
        }
      }
    } else if (printerCfg.connectionType === "agent") {
      // ── Local Print Agent: browser POSTs to localhost:4321 on cashier machine ─
      // Works on cloud-hosted deployments — agent handles lp/PowerShell/TCP/serial.
      try {
        const escStr = buildEscPos(receiptData, cfg);
        await printViaAgent(escStr, printerCfg);
        return;
      } catch (err: any) {
        emitFallback(`Print Agent: ${err?.message ?? err}`);
      }
    } else {
      // ── Server-side /api/print: works only when app is locally hosted ─────────
      try {
        const res = await fetch("/api/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            printerConfig: printerCfg,
            data: receiptData,
            receiptConfig: cfg,
          }),
        });
        if (res.ok) return;
        const errBody = await res.text().catch(() => "");
        emitFallback(`/api/print: ${errBody || res.statusText}`);
      } catch (err: any) {
        emitFallback(`/api/print network error: ${err?.message ?? err}`);
      }
    }
  }

  // ── HTML (browser) print path ────────────────────────────────────────────
  const dynamicCSS = generateDynamicCSS(cfg);
  // A real DOM spacer at the end of the body, sized in actual px — NOT CSS padding/margin.
  // Some browser/printer-driver combinations strip page-level padding when physically
  // printing even though it shows fine in preview; an element that occupies real layout
  // height is much harder for a driver to silently discard. Floors at 4px so there's
  // always some visible gap before the cut, even if the configured margin fails to apply.
  const bottomSpacerPx = Math.max(
    4,
    lengthToPx(cfg.htmlConfig?.margins?.bottom, 0) +
      lengthToPx(cfg.htmlConfig?.padding, 0),
  );
  // Fall back to the real defaults if this event's stored config is missing headerLines/
  // footerLines (legacy/partial record) — without this, `.map` on undefined throws and the
  // print silently fails with nothing on paper. The receiving-slip path already guards this
  // the same way; the main bill didn't, which was an inconsistency worth closing.
  const headerHtml = renderLinesHtml(
    cfg.headerLines ?? DEFAULT_RECEIPT_CONFIG.headerLines,
    shopName,
    orgName,
    eventName,
    dateStr,
  );

  // Same alignment settings the ESC/POS renderer uses for these two blocks — now applied
  // to the HTML fallback too, so this config isn't thermal-only anymore.
  const infoAlign = cfg.thermalConfig?.infoAlignment ?? "left";
  const paymentAlign = cfg.thermalConfig?.paymentAlignment ?? "left";

  const infoRows: string[] = [];
  if (cfg.showInvoiceNumber)
    infoRows.push(
      `<div class="label">Bill No.: <strong>${invNo}</strong></div>`,
    );
  if (cfg.showSaleOrderNumber)
    infoRows.push(`<div class="label">Order #: ${orderNo}</div>`);
  if (cfg.showDateTime)
    infoRows.push(`<div class="label">Date: ${dateStr}</div>`);
  if (cfg.showCustomerName)
    infoRows.push(
      `<div class="label">Customer: ${bill.customerName || "Guest"}</div>`,
    );
  if (cfg.showCustomerMobile && bill.customerMobile)
    infoRows.push(`<div class="label">Mobile: ${bill.customerMobile}</div>`);
  if (cfg.showSellerUserId && sellerDisplay)
    infoRows.push(`<div class="label">Seller: ${sellerDisplay}</div>`);
  if (cfg.showCounterNumber !== false && counterNo)
    infoRows.push(`<div class="label">Counter: ${counterNo}</div>`);
  const infoHtml = `<div style="text-align:${infoAlign}">${infoRows.join("\n")}</div>`;

  const itemsHtml =
    items.length > 0
      ? items
          .map((item: any, idx: number) => {
            const sNo = idx + 1;
            const qty = Number(item.quantity || 0);
            const retQty = Number(item.returnedQuantity || 0);
            const netQty = qty - retQty;
            const price = Number(item.sellingPrice || item.unitPrice || 0);
            const showRet = cfg.showReturnDetails;
            return `
<div style="margin-bottom:6px;${retQty > 0 ? "background:#f9f9f9;padding:2px;" : ""}">
  <div class="bold" style="font-size:11px;">${sNo}. ${(item.productName || "Product").length > 30 ? (item.productName || "Product").slice(0, 30) + "..." : item.productName || "Product"}</div>
  <div class="row">
    <span class="small" style="padding-left:14px;${showRet && retQty > 0 ? "text-decoration:line-through;color:#888;" : ""}">${cur}${price.toFixed(2)} x ${qty}${showRet && retQty > 0 ? ` (Return: ${retQty})` : ""}</span>
    <span class="small" style="${showRet && retQty > 0 ? "text-decoration:line-through;color:#888;" : ""}">${cur}${(qty * price).toFixed(2)}</span>
  </div>
  ${
    showRet && retQty > 0
      ? `<div class="row bold" style="font-size:11px;"><span>Net: ${netQty} @ ${cur}${price.toFixed(2)}</span><span>${cur}${(netQty * price).toFixed(2)}</span></div>`
      : ""
  }
</div>`;
          })
          .join("")
      : '<div class="center small">No items listed</div>';

  const totalHtml = hasReturns
    ? `<div class="row small"><span>Original Total:</span><span>${cur}${amount.toFixed(2)}</span></div>
       <div class="row total-row" style="margin-top:4px;border-top:1px solid #000;padding-top:4px;"><span>FINAL TOTAL:</span><span>${cur}${displayTotal.toFixed(2)}</span></div>`
    : `<div class="row total-row"><span>TOTAL:</span><span>${cur}${displayTotal.toFixed(2)}</span></div>`;

  const payRows: string[] = [];
  if (cfg.showPaymentMode) {
    const mode = (bill.paymentMode || "CASH") as string;
    const isSplit = mode === "BOTH";
    payRows.push(
      `<div class="label">Payment Mode: <strong>${isSplit ? "Split Payment" : mode}</strong></div>`,
    );
    // showCashBreakdown was previously never checked here — the ESC/POS path gated the
    // cash/online split behind it correctly, but this HTML path always showed it for any
    // BOTH-mode payment regardless of the toggle. Now both paths agree.
    if (isSplit && cfg.showCashBreakdown) {
      if (Number(bill.cashReceived || bill.cashAmount || 0) > 0)
        payRows.push(
          `<div class="row small"><span>Cash:</span><span>${cur}${Number(bill.cashReceived || bill.cashAmount || 0).toFixed(2)}</span></div>`,
        );
      if (Number(bill.onlineAmount || 0) > 0)
        payRows.push(
          `<div class="row small"><span>Online:</span><span>${cur}${Number(bill.onlineAmount || 0).toFixed(2)}</span></div>`,
        );
    }
    if (cfg.showPaymentReference && bill.paymentReference)
      payRows.push(`<div class="small">Ref: ${bill.paymentReference}</div>`);
    if (cfg.showChange && Number(bill.change) > 0)
      payRows.push(
        `<div class="row label"><span>Change:</span><span>${cur}${Number(bill.change).toFixed(2)}</span></div>`,
      );
  }
  // Wraps the payment block in the configured alignment. Two-column ".row" lines (cash/online
  // split, change) stay flex-justified full-width either way — same as the ESC/POS twoCol()
  // helper, which also ignores paymentAlignment for two-column rows and only applies it to
  // single-line entries (Payment Mode, Ref).
  const paymentHtml = `<div style="text-align:${paymentAlign}">${payRows.join("\n")}</div>`;

  const footerHtml = renderLinesHtml(
    cfg.footerLines ?? DEFAULT_RECEIPT_CONFIG.footerLines,
    shopName,
    orgName,
    eventName,
    dateStr,
  );

  const receiptHtml = `
<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <title>Receipt - ${invNo}</title>
  ${dynamicCSS}
</head><body>

${headerHtml}
<div class="line"></div>
${infoHtml}
<div class="line"></div>
<div class="bold" style="font-size:10px;margin-bottom:4px;border-bottom:1px dashed #999;padding-bottom:2px;display:flex;">
  <span style="width:12%;">SN.</span>
  <span style="flex:1;">Item</span>
  <span style="width:22%;text-align:right;">Rate</span>
  <span style="width:14%;text-align:right;">Qty</span>
  <span style="width:20%;text-align:right;">Amt</span>
</div>
${itemsHtml}
<div class="line"></div>
${totalHtml}
<div class="line"></div>
${paymentHtml}
<div class="line"></div>
${footerHtml}
<div style="height:${bottomSpacerPx}px;"></div>

</body></html>`;

  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.write(receiptHtml);
      doc.close();
      setTimeout(() => {
        // `@page { size: <width> auto }` asks the browser to compute the page height
        // from content — but on some browsers/printer drivers the auto height is
        // calculated BEFORE body's padding-bottom is accounted for, so the configured
        // bottom margin gets silently clipped while the top margin (calculated first)
        // renders fine. Measuring the real rendered height here and pinning @page to
        // that exact size sidesteps the miscalculation entirely.
        try {
          const heightPx = doc.body?.scrollHeight || 0;
          if (heightPx > 0) {
            const heightMm = ((heightPx * 25.4) / 96).toFixed(1);
            const override = doc.createElement("style");
            override.textContent = `@media print { @page { size: ${toCssLength(cfg.htmlConfig.paperWidth, "80mm")} ${heightMm}mm; margin: 0; } }`;
            doc.head?.appendChild(override);
          }
        } catch {
          /* best-effort — falls back to the auto height if measurement fails */
        }
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 0);
    }
  } catch (error) {
    console.error("[printBill] Printing failed:", error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RECEIVING SLIP — printed immediately after the main bill when both gates pass:
//   1. event.receiptConfig.receivingPrint.enabled = true
//   2. shop.receivingPrintEnabled = true
//
// Receiving layout:
//   headerLines[]   (same tokens as main bill)
//   ── divider ──
//   Bill No / Date / Seller   (no customer info)
//   ── divider ──
//   SN. | Item | SKU | Rate | Qty | Amt
//   ── divider ──
//   TOTAL
//   ── divider ──
//   footerLines[]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build ESC/POS string for the receiving slip.
 * Uses ReceivingReceiptConfig (from receiptConfig.receivingPrint).
 */
function buildEscPosReceiving(data: any, rc: any): string {
  // ── Thermal layout config ─────────────────────────────────────────────────
  const tc = rc.thermalConfig || {};
  const W: number = tc.charsPerLine ?? 44; //32
  const LM: number = tc.leftMarginSpaces ?? 0;
  const feedLines: number = tc.bottomFeedLines ?? 6;
  const infoAlign: "left" | "center" | "right" = tc.infoAlignment ?? "left";

  // ── Currency ──────────────────────────────────────────────────────────────
  const cur = (data.currency || "Rs").replace("₹", "Rs");

  const parts: string[] = [ESC_POS.INIT];

  // ── HEADER ────────────────────────────────────────────────────────────────
  const headerLines: any[] =
    rc.headerLines ?? DEFAULT_RECEIVING_CONFIG.headerLines;
  for (const hl of headerLines) {
    const text = resolveTokens(hl.text, data).trim();
    if (!text) continue;
    const align = hl.alignment ?? "center";
    const modeCmd = printModeOn(hl);
    parts.push(alignCmd(align)); // hardware justify — centers to real paper width
    if (modeCmd) parts.push(modeCmd);
    parts.push((align === "left" ? " ".repeat(LM) : "") + text + "\n");
    if (modeCmd) parts.push(ESC_POS.NORMAL);
  }
  parts.push(ESC_POS.ALIGN_L); // reset to left for info / item columns below
  parts.push(divider(W) + "\n");

  // ── TRANSACTION INFO (Bill No, Date, Seller, Counter — no customer) ──────
  if (rc.showInvoiceNumber !== false && data.invoiceNo) {
    parts.push(
      alignText("Bill No : " + data.invoiceNo, infoAlign, W, LM) + "\n",
    );
  }
  if (rc.showDateTime !== false && data.date) {
    parts.push(alignText("Date    : " + data.date, infoAlign, W, LM) + "\n");
  }
  if (rc.showSellerUserId && data.sellerDisplay) {
    parts.push(
      alignText("Seller  : " + data.sellerDisplay, infoAlign, W, LM) + "\n",
    );
  }
  if (rc.showCounterNumber !== false && data.counterNo) {
    parts.push(
      alignText("Counter : " + data.counterNo, infoAlign, W, LM) + "\n",
    );
  }
  if (rc.showPaymentMode !== false && data.paymentMode) {
    parts.push(
      alignText("Payment : " + data.paymentMode, infoAlign, W, LM) + "\n",
    );
  }
  // Reference only prints when the order actually has one — i.e. ONLINE or BOTH,
  // never CASH (mirrors the same condition used on the main bill).
  if (rc.showPaymentReference !== false && data.paymentReference) {
    parts.push(
      alignText("Ref     : " + data.paymentReference, infoAlign, W, LM) + "\n",
    );
  }
  parts.push(divider(W) + "\n");

  // ── ITEM TABLE HEADER: SN. | Item | SKU | Rate | Qty | Amt ──────────────────
  // 6-column header label row. The SKU value itself still prints inline on
  // line 2 with the item (not strictly aligned under this column — same loose
  // header-as-label convention the Rate/Qty/Amt columns already use here).
  const snW = 4; // "1.  "
  const skuW = 8; // "SKU1234 " left-aligned
  const rateW = 5; // "Rs100" right-aligned
  const qtyW = 4; // "  5" right-aligned
  const amtW = 6; // "Rs1000" right-aligned
  const itemW = Math.max(4, W - LM - snW - skuW - rateW - qtyW - amtW);
  parts.push(
    " ".repeat(LM) +
      "SN.".padEnd(snW) +
      "Item".padEnd(itemW) +
      "SKU".padEnd(skuW) +
      "Rate".padStart(rateW) +
      "Qty".padStart(qtyW) +
      "Amt".padStart(amtW) +
      "\n",
  );
  parts.push(divider(W) + "\n");

  // ── ITEMS ─────────────────────────────────────────────────────────────────
  // Line 1: {sNo}. {product name}
  // Line 2: 5-space indent + SKU:{code} + Rate x Qty  then right-aligned line Amt
  const items: any[] = data.items ?? [];
  let netTotal = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const sNo = i + 1;
    const qty = Number(item.quantity ?? 0) - Number(item.returnedQuantity ?? 0);
    const price = Number(item.sellingPrice ?? item.unitPrice ?? 0);
    const itTotal = qty * price;
    netTotal += itTotal;
    const sku = (item.productSku || "").toString().trim();
    const name = item.productName ?? "Product";
    const displayName = name.length > 26 ? name.slice(0, 24) + ".." : name;

    // Line 1 — serial + name
    parts.push(" ".repeat(LM) + `${sNo}. ` + displayName + "\n");

    // Line 2 — SKU (if present) + Rate x Qty left, line Amt right
    const codeLabel = sku ? `SKU:${sku}  ` : "";
    const leftPart = `     ${codeLabel}${cur}${price.toFixed(0)} x ${qty}`;
    const rightPart = `${cur}${itTotal.toFixed(0)}`;
    parts.push(twoCol(leftPart, rightPart, W, LM) + "\n");
  }

  const displayTotal = netTotal > 0 ? netTotal : Number(data.total ?? 0);

  // ── TOTAL AMOUNT ─────────────────────────────────────────────────────────
  parts.push(divider(W) + "\n");
  parts.push(ESC_POS.BOLD_ON);
  parts.push(twoCol("TOTAL", `${cur}${displayTotal.toFixed(0)}`, W, LM) + "\n");
  parts.push(ESC_POS.NORMAL);
  parts.push(divider(W) + "\n");

  // ── FOOTER ────────────────────────────────────────────────────────────────
  const footerLines: any[] =
    rc.footerLines ?? DEFAULT_RECEIVING_CONFIG.footerLines;
  for (const fl of footerLines) {
    const text = resolveTokens(fl.text, data).trim();
    if (!text) continue;
    const align = fl.alignment ?? "center";
    const modeCmd = printModeOn(fl);
    parts.push(alignCmd(align)); // hardware justify — centers to real paper width
    if (modeCmd) parts.push(modeCmd);
    parts.push((align === "left" ? " ".repeat(LM) : "") + text + "\n");
    if (modeCmd) parts.push(ESC_POS.NORMAL);
  }

  parts.push(ESC_POS.ALIGN_L); // reset justification before feed/cut
  parts.push("\n".repeat(Math.max(1, feedLines)));
  parts.push(ESC_POS.FULL_CUT);

  return parts.filter((p) => p !== "").join("");
}

/** Generate CSS for the receiving slip HTML iframe */
function generateReceivingCSS(rc: ReceivingReceiptConfig): string {
  // Same unit-safety normalization as generateDynamicCSS — see toCssLength() for why.
  const mTop = toCssLength(rc.htmlConfig.margins.top);
  const mLeft = toCssLength(rc.htmlConfig.margins.left);
  const mRight = toCssLength(rc.htmlConfig.margins.right);
  const mBottom = toCssLength(rc.htmlConfig.margins.bottom);
  const pad = toCssLength(rc.htmlConfig.padding);
  const contentWidth = toCssLength(rc.htmlConfig.contentWidth, "70mm");
  const paperWidth = toCssLength(rc.htmlConfig.paperWidth, "80mm");
  return `
  <style>
    @media print {
      @page { margin:0; size:${paperWidth} auto; }
      body {
        box-sizing: border-box !important;
        margin: 0 !important;
        width: ${contentWidth} !important;
        padding-top: calc(${mTop} + ${pad}) !important;
        padding-left: calc(${mLeft} + ${pad}) !important;
        padding-right: calc(${mRight} + ${pad}) !important;
        padding-bottom: calc(${mBottom} + ${pad}) !important;
      }
    }
    body {
      box-sizing: border-box;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.3;
      width: ${contentWidth};
      margin: 0 auto;
      padding: ${pad};
      color: #000;
    }
    .center { text-align: center; }
    .right  { text-align: right; }
    .bold   { font-weight: bold; }
    .line   { border-top: 1px dashed #000; margin: 5px 0; }
    .row    { display: flex; justify-content: space-between; align-items: baseline; }
    .small  { font-size: 10px; color: #333; }
    .label  { font-size: 11px; }
  </style>`;
}

/**
 * printReceiving — prints the receiving slip immediately after the main bill.
 *
 * Called only when:
 *   event.receiptConfig.receivingPrint.enabled = true  AND
 *   shop.receivingPrintEnabled = true
 *
 * No confirmation dialog — fires automatically back-to-back after printBill.
 */
export const printReceiving = async (
  bill: any,
  userConfig: PrintReceiptConfig,
): Promise<void> => {
  const rawCfg = userConfig.eventConfigPayload;
  const cfg: ReceiptEventConfig = rawCfg ?? DEFAULT_RECEIPT_CONFIG;
  const rc: ReceivingReceiptConfig =
    cfg.receivingPrint ?? DEFAULT_RECEIVING_CONFIG;

  // If receiving print is disabled, skip
  if (!rc.enabled) {
    console.warn("[printReceiving] Receiving print disabled in config.");
    return;
  }

  const shopName = userConfig.shopName || "";
  const orgName = userConfig.orgName || "";
  const eventName = userConfig.eventName || "";
  const counterNo = userConfig.counterNumber
    ? String(userConfig.counterNumber)
    : "";
  const cur = cfg.currency?.displaySymbol || "₹";

  const orderNo = bill.salesOrderNumber || bill.orderNumber || "—";
  const invNo =
    bill.invoiceId || bill.invoiceNo || bill.billingInvoiceNumber || "—";
  const rawDate = bill.billingDate || bill.createdAt;
  const dateStr = formatDateTime(rawDate, rc.dateTimeFormat ?? "locale");
  const sellerDisplay =
    bill.sellerName ||
    (bill.sellerId ? `#${bill.sellerId}` : "") ||
    (bill.billedBy ? `#${bill.billedBy}` : "");

  // Fetch line items if not already on the bill (cache shared with printBill)
  let items: any[] = bill.items || [];
  if (items.length === 0 && orderNo !== "—") {
    items = await fetchItemsCached(orderNo);
  }

  // Fallback total when items are unavailable/all-returned — same source fields printBill uses.
  const billAmount = Number(
    bill.totalAmount || bill.netAmount || bill.orderSubtotal || 0,
  );

  // ── Thermal print (ESC/POS) ───────────────────────────────────────────────
  if (isThermalEnabled()) {
    const printerCfg = loadPrinterConfig();

    const receiptData = {
      shopName,
      orgName,
      eventName,
      date: dateStr,
      invoiceNo: invNo,
      sellerDisplay,
      counterNo,
      paymentMode: bill.paymentMode || bill.payment_mode || "CASH",
      paymentReference: bill.paymentReference || "",
      currency: cfg.currency?.thermalFallback || "Rs",
      items: items.map((i: any) => ({
        productName: i.productName || "Product",
        productSku: i.productSku || i.sku || "",
        quantity: Number(i.quantity || 0),
        returnedQuantity: Number(i.returnedQuantity || 0),
        sellingPrice: Number(i.sellingPrice || i.unitPrice || 0),
      })),
      total: billAmount,
    };

    // Build the receiving-specific ESC/POS once — used by both paths
    const escPos = buildEscPosReceiving(receiptData, rc);

    /** Emit a window event so billing pages can show a toast on thermal failure */
    const emitFallback = (reason: string) => {
      try {
        window.dispatchEvent(
          new CustomEvent("thermalPrintFallback", { detail: { reason } }),
        );
      } catch {
        /* SSR / non-browser */
      }
      console.warn("[printReceiving] thermal failed —", reason);
    };

    if (printerCfg.connectionType === "webserial") {
      // ── Browser-native Web Serial ─────────────────────────────────────────
      if (!isWebSerialSupported()) {
        emitFallback(
          "Web Serial API requires Chrome or Edge 89+. Switch to Local Print Agent for cross-browser support.",
        );
      } else {
        try {
          await printViaWebSerial(escPos, printerCfg.baudRate);
          return;
        } catch (err: any) {
          emitFallback(`Web Serial: ${err?.message ?? err}`);
        }
      }
    } else if (printerCfg.connectionType === "agent") {
      // ── Local Print Agent ─────────────────────────────────────────────────
      try {
        await printViaAgent(escPos, printerCfg);
        return;
      } catch (err: any) {
        emitFallback(`Print Agent: ${err?.message ?? err}`);
      }
    } else {
      // ── auto/cups/windows: skip server-side print for receiving slip ───────
      // The server-side /api/print path (lp/PowerShell) is unreliable in Docker
      // and cloud environments, and a second browser dialog opened immediately
      // after the receipt dialog is often blocked by the browser.
      // Fall through to the HTML iframe path below — same as receipt behaviour.
      emitFallback(
        "auto/cups/windows — receiving slip using HTML browser print",
      );
    }
  }

  // ── HTML (browser) print path ────────────────────────────────────────────
  // Delay so the receiving dialog opens AFTER the receipt dialog is dismissed,
  // preventing browsers from blocking the second print() call. Lowered from 1200ms
  // to 500ms by request — this one is riskier to shorten than the pre-print() delays
  // above (it's standing in for "the operator dismissed the first dialog," not just
  // "layout finished"), so if the receiving slip starts getting silently dropped or
  // its dialog suppressed, raise this back up first before touching anything else.
  await new Promise<void>((resolve) => setTimeout(resolve, 500));

  const dynamicCSS = generateReceivingCSS(rc);
  // See printBill's identical spacer for why this is a real DOM element, not CSS padding.
  const bottomSpacerPx = Math.max(
    4,
    lengthToPx(rc.htmlConfig?.margins?.bottom, 0) +
      lengthToPx(rc.htmlConfig?.padding, 0),
  );
  const headerHtml = renderLinesHtml(
    rc.headerLines ?? DEFAULT_RECEIVING_CONFIG.headerLines,
    shopName,
    orgName,
    eventName,
    dateStr,
  );

  // Same alignment the ESC/POS receiving-slip builder uses (rc.thermalConfig.infoAlignment) —
  // now applied to the HTML fallback too.
  const infoAlign = rc.thermalConfig?.infoAlignment ?? "left";

  const infoRows: string[] = [];
  if (rc.showInvoiceNumber !== false)
    infoRows.push(
      `<div class="label">Bill No: <strong>${invNo}</strong></div>`,
    );
  if (rc.showDateTime !== false)
    infoRows.push(`<div class="label">Date: ${dateStr}</div>`);
  if (rc.showSellerUserId && sellerDisplay)
    infoRows.push(`<div class="label">Seller: ${sellerDisplay}</div>`);
  if (rc.showCounterNumber !== false && counterNo)
    infoRows.push(`<div class="label">Counter: ${counterNo}</div>`);
  const receivingPaymentMode = bill.paymentMode || bill.payment_mode || "";
  if (rc.showPaymentMode !== false && receivingPaymentMode)
    infoRows.push(
      `<div class="label">Payment: <strong>${receivingPaymentMode}</strong></div>`,
    );
  // Reference only shown when the order actually has one (ONLINE / BOTH), never CASH.
  if (rc.showPaymentReference !== false && bill.paymentReference)
    infoRows.push(`<div class="label">Ref: ${bill.paymentReference}</div>`);

  // Item rows — div-based layout matching main bill (SKU + Rate x Qty left, line Amt right)
  let receivingNetTotal = 0;
  const itemsHtml =
    items.length > 0
      ? items
          .map((item: any, idx: number) => {
            const qty =
              Number(item.quantity || 0) - Number(item.returnedQuantity || 0);
            const price = Number(item.sellingPrice || item.unitPrice || 0);
            const itTotal = qty * price;
            receivingNetTotal += itTotal;
            const sku = (item.productSku || item.sku || "").toString().trim();
            const codeLabel = sku ? `SKU:${sku}` : "";
            const name =
              (item.productName || "Product").length > 30
                ? (item.productName || "Product").slice(0, 30) + "..."
                : item.productName || "Product";
            return `
<div style="margin-bottom:6px;">
  <div class="bold" style="font-size:11px;">${idx + 1}. ${name}</div>
  <div class="row">
    <span class="small">${codeLabel ? `${codeLabel}  ` : ""}${cur}${price.toFixed(0)} x ${qty}</span>
    <span class="small">${cur}${itTotal.toFixed(0)}</span>
  </div>
</div>`;
          })
          .join("")
      : '<div class="small" style="text-align:center">No items</div>';

  const receivingDisplayTotal =
    receivingNetTotal > 0 ? receivingNetTotal : billAmount;

  const receivingHtml = `
<!DOCTYPE html><html><head>
  <meta charset="utf-8">
  <title>Receiving - ${invNo}</title>
  ${dynamicCSS}
</head><body>
${headerHtml}
<div class="line"></div>
<div style="text-align:${infoAlign}">${infoRows.join("\n")}</div>
<div class="line"></div>
<div class="bold" style="font-size:10px;margin-bottom:4px;border-bottom:1px dashed #999;padding-bottom:2px;display:flex;">
  <span style="width:8%;">SN.</span>
  <span style="flex:1;">Item</span>
  <span style="width:18%;">SKU</span>
  <span style="width:20%;text-align:right;">Rate</span>
  <span style="width:12%;text-align:right;">Qty</span>
  <span style="width:18%;text-align:right;">Amt</span>
</div>
${itemsHtml}
<div class="line"></div>
<div class="row bold" style="font-size:13px;border-top:1px solid #000;padding-top:4px;"><span>TOTAL:</span><span>${cur}${receivingDisplayTotal.toFixed(2)}</span></div>
<div class="line"></div>
${renderLinesHtml(rc.footerLines ?? DEFAULT_RECEIVING_CONFIG.footerLines, shopName, orgName, eventName, dateStr)}
<div style="height:${bottomSpacerPx}px;"></div>
</body></html>`;

  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.write(receivingHtml);
      doc.close();
      setTimeout(() => {
        // See printBill's identical fix for why — @page size:auto can clip the bottom
        // padding on some browsers; pinning the measured height avoids that.
        try {
          const heightPx = doc.body?.scrollHeight || 0;
          if (heightPx > 0) {
            const heightMm = ((heightPx * 25.4) / 96).toFixed(1);
            const override = doc.createElement("style");
            override.textContent = `@media print { @page { size: ${toCssLength(rc.htmlConfig.paperWidth, "80mm")} ${heightMm}mm; margin: 0; } }`;
            doc.head?.appendChild(override);
          }
        } catch {
          /* best-effort */
        }
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 0);
    }
  } catch (error) {
    console.error("[printReceiving] Printing failed:", error);
  }
};
