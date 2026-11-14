/**
 * QZ Tray connection + raw-print helpers.
 *
 * QZ Tray must be installed and running on the workstation (https://qz.io/download/).
 * This module connects to the local QZ websocket, lists printers, and sends pre-built
 * ESC/POS bytes straight to a named printer (raw, no driver re-render).
 *
 * NOTE: receipt rendering lives in `lib/thermalPrinter.ts` (buildEscPos / buildEscPosReceiving).
 *
 * ── No-popup signed mode ─────────────────────────────────────────────────────
 * Set these two env vars (both NEXT_PUBLIC_ so Next.js ships them to the browser):
 *   NEXT_PUBLIC_QZ_CERT        — PEM certificate text  (from qz-setup-macos.sh)
 *   NEXT_PUBLIC_QZ_PRIVATE_KEY — PEM private key text  (from qz-setup-macos.sh)
 *
 * The setup script writes the cert to ~/.qz/allowed.dat so QZ Tray pre-trusts it,
 * and writes these env vars to EventManagement/.env.local automatically.
 * When both are set, connectQZ() uses signed mode — no popup on any connect or print.
 * When either is missing, it falls back to unsigned mode (popup appears).
 */
const QZ_CDN = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
const PRINTER_KEY = 'qz_printer_name';

declare global { interface Window { qz: any; } }

// Both must be NEXT_PUBLIC_ — they are used inside the browser for signing.
// The private key signs QZ Tray's per-connect challenge client-side only and never
// leaves the browser. For an internal localhost tool this is an acceptable trade-off.
const QZ_CERT        = process.env.NEXT_PUBLIC_QZ_CERT        ?? '';
const QZ_PRIVATE_KEY = process.env.NEXT_PUBLIC_QZ_PRIVATE_KEY ?? '';

let loadPromise: Promise<void> | null = null;

function loadQZScript(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('Not in browser');
    if (window.qz) return resolve();
    const script = document.createElement('script');
    script.src = QZ_CDN;
    script.onload = () => resolve();
    script.onerror = () => reject('Failed to load qz-tray script');
    document.head.appendChild(script);
  });
  return loadPromise;
}

export async function connectQZ(): Promise<void> {
  await loadQZScript();
  const qz = window.qz;
  if (!qz.websocket.isActive()) {
    if (QZ_CERT && QZ_PRIVATE_KEY) {
      // ── Signed mode: cert is pre-trusted in allowed.dat → zero popups ─────
      qz.security.setCertificatePromise((resolve: any) => resolve(QZ_CERT));
      qz.security.setSignatureAlgorithm('SHA512');
      qz.security.setSignaturePromise((toSign: any) => (resolve: any, reject: any) => {
        (async () => {
          try {
            const pemBody = QZ_PRIVATE_KEY
              .replace(/-----[^-]+-----/g, '')
              .replace(/\s+/g, '');
            const keyBuf = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
            const cryptoKey = await crypto.subtle.importKey(
              'pkcs8', keyBuf.buffer,
              { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' },
              false, ['sign'],
            );
            const sig = await crypto.subtle.sign(
              'RSASSA-PKCS1-v1_5', cryptoKey,
              new TextEncoder().encode(toSign),
            );
            resolve(btoa(String.fromCharCode(...new Uint8Array(sig))));
          } catch (err) {
            console.error('[qz] signing error:', err);
            reject(err);
          }
        })();
      });
      console.log('[qz] connecting in SIGNED mode (no popup)');
    } else {
      // ── Unsigned fallback: popup will appear ───────────────────────────────
      // Fix: run qz-setup-macos.sh then restart the Next.js dev server.
      console.warn('[qz] NEXT_PUBLIC_QZ_CERT or NEXT_PUBLIC_QZ_PRIVATE_KEY missing — connecting unsigned (popup will appear). Run qz-setup-macos.sh to fix.');
      qz.security.setCertificatePromise((_resolve: any) => _resolve());
      qz.security.setSignatureAlgorithm('SHA512');
      qz.security.setSignaturePromise((_toSign: any) => (_resolve: any) => _resolve());
    }
    // keepAlive: 86400 keeps the WebSocket alive across idle periods so reconnects
    // (and any resulting popups) are avoided during a long shift.
    await qz.websocket.connect({ retries: 3, delay: 1, keepAlive: 86400 });
    console.log('[qz] WebSocket connected');
  }
}

export async function getQZPrinters(): Promise<string[]> {
  await connectQZ();
  return await window.qz.printers.find();
}

export function getSavedPrinter(): string { return localStorage.getItem(PRINTER_KEY) || ''; }
export function savePrinter(name: string): void { localStorage.setItem(PRINTER_KEY, name); }

// ─── Station Mode helpers (Central Printer Module) ─────────────────────────────

/**
 * Send already-built ESC/POS bytes straight to a named printer — no dialog, no re-render.
 * Used by the local print path (thermalPrinter.ts) to send ESC/POS bytes to a QZ-connected printer.
 *
 * `forceRaw: true` is the QZ equivalent of `lp -o raw` — it bypasses the CUPS driver/filter so
 * ESC/POS control codes (e.g. ESC a = justify) reach the printer intact.
 */
export async function qzPrintRaw(escpos: string, printerName: string): Promise<void> {
  await connectQZ();
  if (!printerName) throw new Error('qzPrintRaw: printerName required');
  const config = window.qz.configs.create(printerName, { forceRaw: true });
  await window.qz.print(config, [{ type: 'raw', format: 'command', data: escpos }]);
}

/** True if the QZ Tray websocket is currently connected (for the "QZ: connected" banner). */
export function isQZConnected(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.qz?.websocket?.isActive?.();
  } catch {
    return false;
  }
}

/** Decode a base64 ESC/POS payload (from the queue) into the binary string qz.print expects. */
export function decodeEscposBase64(b64: string): string {
  return typeof atob === 'function' ? atob(b64) : b64;
}
