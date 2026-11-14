import type { Live, ParsedFile, PlanRow, StepPlan } from '../types';

const lc = (s: any) => String(s ?? '').trim().toLowerCase();
const close = (a: any, b: any) => Math.abs(Number(a ?? 0) - Number(b ?? 0)) < 0.005;

function finish(rows: PlanRow[]): StepPlan {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const n = count('NEW');
  const x = count('CONFLICT');
  return { rows, newCount: n, conflictCount: x, existsCount: count('EXISTS'), complete: n === 0 && x === 0 };
}

export const STOCK_REASON = 'Master upload';

/**
 * Rows this wizard wrote a moment ago. The stock list the API serves is cached (~30 s) and is not refreshed
 * after a stock-in, so for a short while we trust our own record instead of re-reading stale numbers.
 */
export type DoneMap = Record<string, number>;
export const RECENT_MS = 5 * 60 * 1000;
const recent = (done: DoneMap | undefined, key: string) => !!done && key in done && Date.now() - done[key] < RECENT_MS;
const JUST_NOW = 'Added a moment ago (stock list can lag up to 30 s)';

function catByName(live: Live, name: string) {
  return live.categories.find((c) => lc(c.name) === lc(name));
}
function productBySku(live: Live, sku: string) {
  return live.products.find((p) => lc(p.sku) === lc(sku));
}
function shopByNameCounter(live: Live, name: string, counter: number) {
  return live.shops.find((s) => lc(s.shopName) === lc(name) && Number(s.counterNumber) === Number(counter));
}

export function planCategories(file: ParsedFile, live: Live): StepPlan {
  const rows: PlanRow[] = file.categories.map((c) => {
    const found = catByName(live, c.name);
    if (found) {
      const diff = lc(found.description) !== lc(c.description);
      return {
        key: `cat|${lc(c.name)}`,
        category: c.name,
        cells: [c.name, c.description],
        status: 'EXISTS',
        note: diff ? 'Exists already; description differs and is kept as is' : undefined,
      };
    }
    return {
      key: `cat|${lc(c.name)}`,
      category: c.name,
      cells: [c.name, c.description],
      status: 'NEW',
      payload: { name: c.name, description: c.description },
    };
  });
  return finish(rows);
}

export function planShops(file: ParsedFile, live: Live): StepPlan {
  const rows: PlanRow[] = [];
  for (const c of file.categories) {
    const liveCat = catByName(live, c.name);
    for (const s of c.shops) {
      const found = shopByNameCounter(live, s.name, s.counter);
      const base = { key: `shop|${lc(s.name)}|${s.counter}`, category: c.name, cells: [s.name, s.counter, c.name] };
      if (found) {
        if (liveCat && Number(found.categoryId) === Number(liveCat.id)) rows.push({ ...base, status: 'EXISTS' });
        else rows.push({ ...base, status: 'CONFLICT', note: 'A shop with this name and counter exists under a different category' });
      } else {
        rows.push({
          ...base,
          status: 'NEW',
          note: liveCat ? undefined : 'Waiting for the category',
          payload: liveCat
            ? { shopName: s.name, categoryId: liveCat.id, categoryName: c.name, counterNumber: s.counter }
            : null,
        });
      }
    }
  }
  return finish(rows);
}

export function planProducts(file: ParsedFile, live: Live): StepPlan {
  const rows: PlanRow[] = [];
  for (const c of file.categories) {
    const liveCat = catByName(live, c.name);
    for (const p of c.products) {
      const base = {
        key: `prod|${lc(p.sku)}`,
        category: c.name,
        cells: [p.sku, p.name, p.mrp, p.sellingPrice, p.discount, p.minThreshold],
      };
      const found = productBySku(live, p.sku);
      if (found) {
        const diffs: string[] = [];
        if (lc(found.name) !== lc(p.name)) diffs.push(`name is "${found.name}"`);
        if (!liveCat || Number(found.categoryId) !== Number(liveCat.id)) diffs.push('category differs');
        if (!close(found.mrp, p.mrp)) diffs.push(`MRP is ${found.mrp}`);
        if (!close(found.sellingPrice, p.sellingPrice)) diffs.push(`selling price is ${found.sellingPrice}`);
        if (!close(found.discount, p.discount)) diffs.push(`discount is ${found.discount ?? 0}`);
        if (found.minThreshold != null && Number(found.minThreshold) !== Number(p.minThreshold)) {
          diffs.push(`min threshold is ${found.minThreshold}`);
        }
        rows.push(
          diffs.length
            ? { ...base, status: 'CONFLICT', note: `SKU exists but ${diffs.join(', ')}` }
            : { ...base, status: 'EXISTS' }
        );
        continue;
      }
      const nameClash = live.products.find((x) => lc(x.name) === lc(p.name));
      if (nameClash) {
        rows.push({ ...base, status: 'CONFLICT', note: `Name already used by SKU ${nameClash.sku}` });
        continue;
      }
      rows.push({
        ...base,
        status: 'NEW',
        note: liveCat ? undefined : 'Waiting for the category',
        payload: liveCat
          ? {
              name: p.name,
              categoryId: liveCat.id,
              sku: p.sku,
              description: p.description,
              mrp: p.mrp,
              sellingPrice: p.sellingPrice,
              discount: p.discount,
              minThreshold: p.minThreshold,
              isActive: p.isActive,
            }
          : null,
      });
    }
  }
  return finish(rows);
}

/** Total quantity ever received for a product = main stock now + everything issued to counters. */
function receivedSoFar(live: Live, productId: number) {
  const main = live.stocks
    .filter((s) => Number(s.productId) === productId && (s.location == null || String(s.location).toUpperCase() === 'MAIN'))
    .reduce((a, s) => a + Number(s.quantity ?? 0), 0);
  const issued = live.issues
    .filter((i) => Number(i.productId) === productId)
    .reduce((a, i) => a + Number(i.initialQuantity ?? 0), 0);
  return main + issued;
}

export function planStock(file: ParsedFile, live: Live, done?: DoneMap): StepPlan {
  const rows: PlanRow[] = [];
  for (const c of file.categories) {
    for (const p of c.products) {
      const found = productBySku(live, p.sku);
      const received = found ? receivedSoFar(live, Number(found.id)) : 0;
      const delta = p.stockQty - received;
      const base = { key: `stock|${lc(p.sku)}`, category: c.name, cells: [p.sku, p.name, p.stockQty, received, Math.max(delta, 0)] };
      if (recent(done, base.key)) rows.push({ ...base, status: 'EXISTS', note: JUST_NOW });
      else if (delta === 0) rows.push({ ...base, status: 'EXISTS' });
      else if (delta < 0) {
        rows.push({ ...base, status: 'CONFLICT', note: `Already received ${received}, more than the file's ${p.stockQty}` });
      } else {
        rows.push({
          ...base,
          status: 'NEW',
          note: found ? undefined : 'Waiting for the product',
          payload: found ? { productId: found.id, movementType: 'IN', quantity: delta, reason: STOCK_REASON } : null,
        });
      }
    }
  }
  return finish(rows);
}

export function planIssues(file: ParsedFile, live: Live, done?: DoneMap): StepPlan {
  const rows: PlanRow[] = [];
  for (const c of file.categories) {
    for (const p of c.products) {
      const prod = productBySku(live, p.sku);
      for (const s of c.shops) {
        const q = p.issues[String(s.col)] ?? 0;
        if (q <= 0) continue;
        const shop = shopByNameCounter(live, s.name, s.counter);
        const issued =
          prod && shop
            ? live.issues
                .filter((i) => Number(i.productId) === Number(prod.id) && Number(i.shopId) === Number(shop.id))
                .reduce((a, i) => a + Number(i.initialQuantity ?? 0), 0)
            : 0;
        const delta = q - issued;
        const base = {
          key: `issue|${lc(p.sku)}|${lc(s.name)}|${s.counter}`,
          category: c.name,
          cells: [p.sku, p.name, `${s.name} (#${s.counter})`, q, issued, Math.max(delta, 0)],
        };
        if (recent(done, base.key)) rows.push({ ...base, status: 'EXISTS', note: JUST_NOW });
        else if (delta === 0) rows.push({ ...base, status: 'EXISTS' });
        else if (delta < 0) rows.push({ ...base, status: 'CONFLICT', note: `Already issued ${issued}, more than the file's ${q}` });
        else {
          const ready = prod && shop;
          rows.push({
            ...base,
            status: 'NEW',
            note: ready ? undefined : 'Waiting for the product / shop',
            groupId: shop ? Number(shop.id) : undefined,
            payload: ready ? { productId: prod.id, shopId: shop.id, quantity: delta } : null,
          });
        }
      }
    }
  }
  return finish(rows);
}

export function buildPlans(file: ParsedFile, live: Live, done?: DoneMap): StepPlan[] {
  return [
    planCategories(file, live),
    planShops(file, live),
    planProducts(file, live),
    planStock(file, live, done),
    planIssues(file, live, done),
  ];
}
