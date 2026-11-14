/**
 * Builds an `sms:` URI that opens the device's default SMS app with the message
 * body (and, if known, the recipient number) pre-filled. The user still has to
 * hit Send themselves — browsers can't silently send SMS — this just saves them
 * from typing the bill details manually.
 *
 * Android-first: uses `sms:<number>?body=<text>` (the Android-standard separator).
 * iOS uses `&` instead of `?` before body when a number is present; that variant
 * is intentionally not handled yet — verify Android works first, then extend.
 */
export function buildSmsLink(
  mobile: string | null | undefined,
  message: string,
): string {
  const body = encodeURIComponent(message);
  const number = (mobile || "").trim();
  // No number on file — open the SMS app with the body filled in and let the
  // user pick/type a recipient themselves.
  if (!number) {
    return `sms:?body=${body}`;
  }
  return `sms:${number}?body=${body}`;
}

/** Builds the short bill-summary text sent via SMS after checkout. */
export function buildBillSmsMessage(bill: any, shopName?: string): string {
  const invoiceNo =
    bill?.billingInvoiceNumber ||
    bill?.invoiceNo ||
    bill?.invoiceId ||
    bill?.orderNumber ||
    "";
  const amount = bill?.amount ?? bill?.orderSubtotal ?? 0;
  const lines = [
    shopName ? `${shopName} - Bill Confirmation` : "Bill Confirmation",
    invoiceNo ? `Bill No: ${invoiceNo}` : null,
    `Amount: ₹${Number(amount).toFixed(2)}`,
    "|| Jai Sadguru Deo ||",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Navigates to the sms: link, handing off to the device's default SMS app. */
export function openSmsApp(
  mobile: string | null | undefined,
  message: string,
): void {
  window.location.href = buildSmsLink(mobile, message);
}

/**
 * True only on an actual Android device's browser. Used to gate the "Send SMS"
 * button — it's Android-only for now (see buildSmsLink's doc comment): the
 * `sms:` URI format used here is Android-specific, iOS needs a different
 * separator and hasn't been verified yet, and desktop/web has no SMS app to
 * hand off to at all.
 */
/**
 * SMS is currently restricted to a specific operator while the flow is being
 * trialled: only usernames containing "daule" see the button. Everyone else
 * gets the normal Print/Checkout actions with no SMS option.
 *
 * Reads the same localStorage key as lib/auth.ts getUser(). Returns false during
 * SSR and if storage is unavailable, so the button fails closed (hidden).
 */
export function isSmsEnabledForCurrentUser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const username = localStorage.getItem("username") || "";
    return username.toLowerCase().includes("daule");
  } catch {
    return false;
  }
}

export function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}
