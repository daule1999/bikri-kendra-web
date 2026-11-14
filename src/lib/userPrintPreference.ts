/**
 * userPrintPreference.ts — per-user, per-shop opt-out for the receiving-slip auto-print.
 *
 * Layered on top of the two existing gates in printService.ts:
 *   - event-level:  config.receivingPrint.enabled
 *   - shop-level:   shop.receivingPrintEnabled
 *
 * This is a THIRD gate, scoped to the individual operator + the shop they're currently
 * working at. Storage is client-side only (localStorage) — by request, this is not a
 * backend/database setting. It follows the same localStorage pattern as
 * THERMAL_ENABLED_KEY / THERMAL_CONFIG_KEY in thermalPrinter.ts.
 *
 * Because it's scoped per user AND per shop, the same operator can have different
 * preferences at different shops (e.g. wants receiving slips at Shop A, not at Shop B).
 *
 * Tri-state semantics: `null` means "no preference set" (defer to event/shop gates,
 * i.e. behave as if this gate doesn't exist). Only an explicit `false` should suppress
 * printing; an explicit `true` is the same as having no preference (still gated by the
 * other two switches) but is stored so the UI can show the toggle's current state.
 */

const USER_RECEIVING_PRINT_PREF_PREFIX = "user_receiving_print_pref";

function storageKey(username: string, shopId: string | number): string {
  return `${USER_RECEIVING_PRINT_PREF_PREFIX}:${username}:${shopId}`;
}

/**
 * Returns:
 *   true   → operator explicitly wants receiving slips at this shop
 *   false  → operator explicitly opted out at this shop
 *   null   → no preference stored (defer to event/shop-level gates)
 */
export function getUserReceivingPrintPreference(
  username: string | null | undefined,
  shopId: string | number | null | undefined
): boolean | null {
  if (typeof window === "undefined") return null;
  if (!username || shopId === null || shopId === undefined || shopId === "") return null;

  const raw = localStorage.getItem(storageKey(username, shopId));
  if (raw === null) return null;
  return raw === "true";
}

export function setUserReceivingPrintPreference(
  username: string | null | undefined,
  shopId: string | number | null | undefined,
  enabled: boolean
): void {
  if (typeof window === "undefined") return;
  if (!username || shopId === null || shopId === undefined || shopId === "") return;

  localStorage.setItem(storageKey(username, shopId), String(enabled));
}

export function clearUserReceivingPrintPreference(
  username: string | null | undefined,
  shopId: string | number | null | undefined
): void {
  if (typeof window === "undefined") return;
  if (!username || shopId === null || shopId === undefined || shopId === "") return;

  localStorage.removeItem(storageKey(username, shopId));
}
