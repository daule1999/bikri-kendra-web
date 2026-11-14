/**
 * generateUUID — returns a RFC-4122 v4 UUID string.
 *
 * Prefers the native `crypto.randomUUID()` API (available in all modern
 * browsers and Node ≥ 15).  Falls back to a manual implementation that
 * combines `crypto.getRandomValues` (all browsers / Node ≥ 15) with a
 * timestamp seed so collisions are negligible even under network isolation
 * (e.g. LAN-only kiosk with no internet clock sync).
 */
export function generateUUID(): string {
  // Native path — fastest, cryptographically strong
  if (
    typeof crypto !== "undefined" &&
    typeof (crypto as Crypto).randomUUID === "function"
  ) {
    return (crypto as Crypto).randomUUID();
  }

  // Fallback: manual v4 UUID via getRandomValues
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version bits (v4) and variant bits (RFC 4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  // Last-resort: timestamp + Math.random (non-crypto, collision-resistant for
  // our single-tab, single-user use case)
  const now = Date.now();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (now + Math.random() * 16) % 16 | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}
