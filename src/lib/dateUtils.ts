/**
 * IST Date Utility
 *
 * After the backend IST migration (JVM=IST + Jackson custom serialiser),
 * all datetime strings from the API arrive as:
 *   "2026-06-20T10:16:50.000+05:30"  ← explicit IST offset
 *
 * For backward compat (cached responses, in-flight before full deploy),
 * strings without an offset are treated as IST wall clock:
 *   "2026-06-20T10:16:50"  → treated as IST
 *
 * All display helpers pin timeZone: 'Asia/Kolkata' explicitly so the output
 * is correct on any browser OS timezone (India-facing app).
 */

const IST_TZ = 'Asia/Kolkata';

/**
 * Parse a backend datetime string into a JS Date.
 * Handles "+05:30" explicit offset strings AND naive strings (assumed IST).
 */
export function parseBackendIST(s?: string | null): Date {
  if (!s) return new Date(NaN);
  // Has explicit offset: Z or ±HH:MM after the time component → parse directly
  const hasOffset = /T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(s);
  if (hasOffset) return new Date(s);
  // No offset → treat as IST wall clock (JVM is IST after the migration)
  return new Date(s + '+05:30');
}

/**
 * "20 Jun 2026"
 */
export function formatISTDate(s?: string | null): string {
  const d = parseBackendIST(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: IST_TZ,
  });
}

/**
 * "10:16 AM"
 */
export function formatISTTime(s?: string | null): string {
  const d = parseBackendIST(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TZ,
  });
}

/**
 * "20 Jun 2026, 10:16 AM"
 */
export function formatISTDateTime(s?: string | null): string {
  const d = parseBackendIST(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: IST_TZ,
  });
}

/**
 * "Jun 20" — compact form for tables / history lists
 */
export function formatISTShortDate(s?: string | null): string {
  const d = parseBackendIST(s);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: IST_TZ,
  });
}

/**
 * Convert a date-picker value (YYYY-MM-DD or ISO string) into a raw midnight
 * ISO string for sending event start/end dates to the backend DATETIME column.
 * No Z, no offset — backend stores raw midnight.
 *
 * "2026-01-10" → "2026-01-10T00:00:00"
 */
export function toEventDateISO(dateStr: string): string {
  return `${dateStr.split('T')[0]}T00:00:00`;
}
