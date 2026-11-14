import { apiClient } from '@/lib/api';
import type { StepPlan } from '../types';

export interface RunFailure {
  row: string;
  message: string;
}

async function send(url: string, body: any): Promise<string | null> {
  try {
    const r = await apiClient.post(url, body);
    if (r.ok) return null;
    let msg = `HTTP ${r.status}`;
    try {
      const j = await r.json();
      msg = j?.message || j?.error || (typeof j === 'string' ? j : msg);
    } catch {
      /* keep status text */
    }
    return msg;
  } catch (e: any) {
    return e?.message || 'Network error';
  }
}

/**
 * Runs `fn` over items with limited concurrency. On the first failure no new item is started
 * (in-flight ones finish). Nothing is rolled back.
 */
async function pool<T>(
  items: T[],
  size: number,
  fn: (t: T) => Promise<string | null>,
  label: (t: T) => string,
  onDone: () => void
): Promise<RunFailure | null> {
  let next = 0;
  let failure: RunFailure | null = null;
  const worker = async () => {
    while (!failure) {
      const idx = next++;
      if (idx >= items.length) return;
      const item = items[idx];
      const err = await fn(item);
      if (err) {
        if (!failure) failure = { row: label(item), message: err };
        return;
      }
      onDone();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, worker));
  return failure;
}

const ENDPOINTS = ['/categories', '/shops', '/products', '/inventory/stock-movements'];
const CONCURRENCY = [1, 1, 5, 5];

export async function runStep(
  step: number,
  plan: StepPlan,
  sellerUser: string,
  onProgress: (done: number, total: number) => void,
  onRowDone: (key: string) => void
): Promise<RunFailure | null> {
  const todo = plan.rows.filter((r) => r.status === 'NEW');
  const total = todo.length;
  let done = 0;
  const tick = () => onProgress(++done, total);
  onProgress(0, total);

  const missing = todo.find((r) => !r.payload);
  if (missing) return { row: missing.cells[0] + '', message: 'A required earlier item does not exist yet.' };

  if (step < 4) {
    return pool(
      todo,
      CONCURRENCY[step],
      async (r) => {
        const err = await send(ENDPOINTS[step], r.payload);
        if (!err) onRowDone(r.key);
        return err;
      },
      (r) => String(r.cells[0]),
      tick
    );
  }

  // Issue: the bulk API accepts one shop per call
  const groups = new Map<number, typeof todo>();
  todo.forEach((r) => groups.set(r.groupId as number, [...(groups.get(r.groupId as number) ?? []), r]));
  const list = Array.from(groups.entries());
  let issued = 0;
  for (const [shopId, rows] of list) {
    const body = rows.map((r) => ({ productId: r.payload.productId, sellerUser, shopId, quantity: r.payload.quantity }));
    const err = await send('/inventory/sales/bulk', body);
    if (err) return { row: `${rows[0].cells[2]}`, message: err };
    rows.forEach((r) => onRowDone(r.key));
    issued += rows.length;
    onProgress(issued, total);
  }
  return null;
}
