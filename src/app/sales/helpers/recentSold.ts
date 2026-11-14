// "Recent" products in the sale-tab product search.
//
// Counts = units this user has sold in this shop (per event), most-sold first.
// Source of truth for display: localStorage (instant). Backup/sync: the server
// (Redis) via /api/sales/retail/recent-counts. Return/cancel send negative changes.
// If nothing is stored locally or on the server, it is rebuilt once from the
// user's own bills using the existing billing APIs.
import { apiClient } from '@/lib/api';

export const RECENT_LIMIT = 10;
export type RecentCounts = Record<string, number>;

const listeners = new Set<() => void>();
export const subscribeRecent = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const notify = () => listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } });

const ls = (): Storage | null => { try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; } };
export const currentUsername = () => (ls()?.getItem('username') || '').toLowerCase();
const currentEventId = () => ls()?.getItem('active_event_id') || '';

const scope = (shopId: string | number) => `${currentEventId()}_${shopId}_${currentUsername()}`;
const kCounts = (s: string) => `recent_counts_c_${s}`;
const kPending = (s: string) => `recent_counts_p_${s}`;
const kRebuilt = (s: string) => `recent_counts_b_${s}`;

const readJson = <T,>(key: string, fallback: T): T => {
  try { const v = ls()?.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const writeJson = (key: string, value: unknown) => { try { ls()?.setItem(key, JSON.stringify(value)); } catch { /* quota */ } };

const applyTo = (base: RecentCounts, changes: RecentCounts): RecentCounts => {
  const out = { ...base };
  for (const [id, q] of Object.entries(changes)) {
    const n = (out[id] ?? 0) + q;
    if (n > 0) out[id] = n; else delete out[id];
  }
  return out;
};

export const loadLocalCounts = (shopId: string | number): RecentCounts => readJson(kCounts(scope(shopId)), {});

let flushing = false;
async function flushPending(shopId: string | number) {
  if (flushing) return;
  flushing = true;
  try {
    const s = scope(shopId);
    const pending = readJson<RecentCounts>(kPending(s), {});
    const entries = Object.entries(pending).filter(([, q]) => q !== 0);
    if (entries.length === 0) return;
    const body = { shopId: Number(shopId), changes: entries.map(([productId, qty]) => ({ productId: Number(productId), qty })) };
    const res = await apiClient.post('/sales/retail/recent-counts', body);
    if (res.ok || res.status === 400) {
      // 400 = server rejects it for good (e.g. unknown product): drop, do not retry forever.
      try { ls()?.removeItem(kPending(s)); } catch { /* ignore */ }
    }
  } catch { /* offline: keep pending, retry on next call */ } finally { flushing = false; }
}

/** Apply a sale (+) or return/cancel (-) to the local counts right away and sync in the background. */
export async function recordRecent(shopId: string | number | undefined | null, changes: RecentCounts) {
  if (!shopId || shopId === 'ALL' || Object.keys(changes).length === 0) return;
  const s = scope(shopId);
  writeJson(kCounts(s), applyTo(readJson<RecentCounts>(kCounts(s), {}), changes));
  writeJson(kPending(s), applyTo2(readJson<RecentCounts>(kPending(s), {}), changes));
  notify();
  await flushPending(shopId);
}
// pending keeps zero/negative values too (a "-3" must still reach the server)
const applyTo2 = (base: RecentCounts, changes: RecentCounts): RecentCounts => {
  const out = { ...base };
  for (const [id, q] of Object.entries(changes)) { const n = (out[id] ?? 0) + q; if (n === 0) delete out[id]; else out[id] = n; }
  return out;
};

/** Send unsent changes, then take the server's totals (plus anything still unsent) as the local copy. */
export async function refreshRecent(shopId: string | number): Promise<void> {
  if (!shopId || shopId === 'ALL') return;
  await flushPending(shopId);
  try {
    const res = await apiClient.get(`/sales/retail/recent-counts?shopId=${shopId}`);
    if (!res.ok) return;
    const data = await res.json();
    const server: RecentCounts = {};
    for (const [id, q] of Object.entries<any>(data?.counts ?? {})) if (Number(q) > 0) server[id] = Number(q);
    const s = scope(shopId);
    const pending = readJson<RecentCounts>(kPending(s), {});
    writeJson(kCounts(s), applyTo(server, pending));
    notify();
  } catch { /* keep local */ }
}

/** One-time rebuild from this user's own bills when no counts exist anywhere. */
export async function rebuildRecentIfEmpty(shopId: string | number): Promise<void> {
  if (!shopId || shopId === 'ALL') return;
  const s = scope(shopId);
  if (Object.keys(loadLocalCounts(shopId)).length > 0) return;
  if (ls()?.getItem(kRebuilt(s))) return;
  try {
    const user = currentUsername();
    const res = await apiClient.get('/billing/invoices');
    if (!res.ok) return;
    const raw = await res.json();
    const list: any[] = Array.isArray(raw) ? raw : (raw.data || []);
    const mine = list
      .filter((b) => String(b.sellerName || '').toLowerCase() === user
        && String(b.shopId ?? '') === String(shopId)
        && ['PAID', 'PARTIALLY_RETURNED'].includes(String(b.status)))
      .slice(0, 300);
    const totals: RecentCounts = {};
    for (let i = 0; i < mine.length; i += 5) {
      await Promise.all(mine.slice(i, i + 5).map(async (b) => {
        const orderNo = b.salesOrderNumber || b.orderNumber;
        if (!orderNo) return;
        const r = await apiClient.get(`/billing/invoices/order/${orderNo}/items`).catch(() => null);
        if (!r?.ok) return;
        const d = await r.json();
        for (const it of (Array.isArray(d) ? d : (d.data || []))) {
          const net = (it.quantity ?? 0) - (it.returnedQuantity ?? 0);
          if (it.productId != null && net > 0) totals[String(it.productId)] = (totals[String(it.productId)] ?? 0) + net;
        }
      }));
    }
    try { ls()?.setItem(kRebuilt(s), '1'); } catch { /* ignore */ }
    if (Object.keys(totals).length === 0) return;
    writeJson(kCounts(s), totals);
    notify();
    await apiClient.put('/sales/retail/recent-counts', { shopId: Number(shopId), counts: totals });
  } catch { /* try again next visit */ }
}
