import * as XLSX from 'xlsx';
import type { ParsedCategory, ParsedFile } from '../types';

export const FIXED_HEADERS = [
  'sku',
  'name',
  'description',
  'mrp',
  'selling_price',
  'discount',
  'min_threshold',
  'is_active',
  'stock_qty',
];
const SHOP_START = FIXED_HEADERS.length; // shop columns begin right after stock_qty

const lc = (s: any) => String(s ?? '').trim().toLowerCase();
const toNum = (v: any): number | null => {
  if (v === '' || v == null) return null;
  return typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
};
const toBool = (v: any): boolean | null => {
  if (v === '' || v == null) return true;
  if (typeof v === 'boolean') return v;
  const s = lc(v);
  if (s === '') return true;
  if (['true', 'yes', 'y', '1'].includes(s)) return true;
  if (['false', 'no', 'n', '0'].includes(s)) return false;
  return null;
};

export function downloadSample(categories: { name: string; description?: string }[]) {
  const wb = XLSX.utils.book_new();
  const info = [
    ['Master upload - instructions'],
    [''],
    ['One sheet per category. The sheet name is the category name.'],
    ['Row 1: category_name / category_description (the full name here is used if the sheet name was shortened to 31 characters).'],
    ['Row 2: counter number of each shop, above the shop name (shop columns start after stock_qty).'],
    ['Row 3: headers. Fixed columns first, then one column per shop (the header is the shop name).'],
    ['Row 4 onward: one product per row. The cell under a shop column is the quantity to issue to that shop.'],
    ['stock_qty = total quantity received into main stock for the active event (before issuing to shops).'],
    ['Sum of the shop quantities must not exceed stock_qty.'],
    ['SKU and product name must each be unique in the whole file and in the system.'],
    ['is_active: yes/no (blank = yes). discount blank = 0. min_threshold blank = 10.'],
    ['DELETE the EXAMPLE-n-001 rows (and the example shops if not needed) before uploading, or they will be created.'],
    ['Shop name + counter number must be unique in the whole file. Use a different counter number for every shop.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(info), 'Instructions');

  const cats = categories.length ? categories : [{ name: 'Sample Category', description: 'Example' }];
  const used = new Set<string>(['instructions']);
  cats.forEach((c, idx) => {
    let sheet = c.name.replace(/[\[\]:*?/\\]/g, '-').slice(0, 31) || 'Category';
    let n = 2;
    while (used.has(sheet.toLowerCase())) sheet = `${sheet.slice(0, 28)}-${n++}`;
    used.add(sheet.toLowerCase());
    const counters: any[] = new Array(SHOP_START).fill('');
    counters[SHOP_START - 1] = 'counter_number ->';
    // shop name + counter, SKU and product name must be unique across the whole file, so each sheet gets its own
    const shopA = `${c.name} Shop A`;
    const shopB = `${c.name} Shop B`;
    counters.push(idx * 2 + 1, idx * 2 + 2);
    const aoa: any[][] = [
      ['category_name', c.name, 'category_description', c.description || ''],
      counters,
      [...FIXED_HEADERS, shopA, shopB],
      [`EXAMPLE-${idx + 1}-001`, `Example product ${idx + 1}`, 'Optional description', 100, 90, 10, 10, 'yes', 50, 20, 30],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheet);
  });
  XLSX.writeFile(wb, 'master_upload_sample.xlsx');
}

export function parseWorkbook(buf: ArrayBuffer): { data: ParsedFile | null; errors: string[] } {
  const errors: string[] = [];
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    return { data: null, errors: ['The file could not be read as an Excel workbook.'] };
  }

  const cats: ParsedCategory[] = [];
  const seenCat = new Set<string>();
  const seenSku = new Map<string, string>();
  const seenName = new Map<string, string>();
  const seenShop = new Map<string, string>();

  for (const sheetName of wb.SheetNames) {
    if (lc(sheetName) === 'instructions') continue;
    const at = (m: string) => errors.push(`Sheet "${sheetName}": ${m}`);
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: true });
    const hdr = rows[2] || [];

    let headerOk = true;
    FIXED_HEADERS.forEach((h, i) => {
      if (lc(hdr[i]) !== h) {
        at(`row 3, column ${i + 1} must be "${h}"`);
        headerOk = false;
      }
    });
    if (!headerOk) continue;

    const catName = String(rows[0]?.[1] || sheetName).trim();
    if (!catName) {
      at('category name is empty');
      continue;
    }
    if (seenCat.has(lc(catName))) {
      at(`category "${catName}" appears in more than one sheet`);
      continue;
    }
    seenCat.add(lc(catName));
    const cat: ParsedCategory = {
      name: catName,
      description: String(rows[0]?.[3] ?? '').trim(),
      sheet: sheetName,
      shops: [],
      products: [],
    };

    for (let c = SHOP_START; c < hdr.length; c++) {
      const shopName = String(hdr[c] ?? '').trim();
      if (!shopName) continue;
      const counter = toNum(rows[1]?.[c]);
      if (counter == null || Number.isNaN(counter) || !Number.isInteger(counter) || counter < 1) {
        at(`shop "${shopName}": counter number (row 2) must be a whole number of at least 1`);
        continue;
      }
      const sk = `${lc(shopName)}|${counter}`;
      if (seenShop.has(sk)) {
        at(`shop "${shopName}" with counter ${counter} is already used in sheet "${seenShop.get(sk)}"`);
        continue;
      }
      seenShop.set(sk, sheetName);
      cat.shops.push({ name: shopName, counter, col: c });
    }

    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((v) => v === '' || v == null)) continue;
      const rn = r + 1;
      const rowErr = (m: string) => at(`row ${rn}: ${m}`);
      let bad = false;
      const fail = (m: string) => {
        rowErr(m);
        bad = true;
      };

      const sku = String(row[0] ?? '').trim();
      const name = String(row[1] ?? '').trim();
      if (!sku) fail('sku is required');
      else if (sku.length > 100) fail('sku is longer than 100 characters');
      if (!name) fail('name is required');
      else if (name.length > 255) fail('name is longer than 255 characters');

      const mrp = toNum(row[3]);
      const sp = toNum(row[4]);
      const disc = toNum(row[5]);
      const minT = toNum(row[6]);
      const stock = toNum(row[8]);
      if (mrp == null || Number.isNaN(mrp) || mrp <= 0) fail('mrp must be a number above 0');
      if (sp == null || Number.isNaN(sp) || sp <= 0) fail('selling_price must be a number above 0');
      if (disc != null && (Number.isNaN(disc) || disc < 0)) fail('discount must be 0 or more');
      if (minT != null && (Number.isNaN(minT) || !Number.isInteger(minT) || minT < 0)) fail('min_threshold must be a whole number, 0 or more');
      if (stock != null && (Number.isNaN(stock) || !Number.isInteger(stock) || stock < 0)) fail('stock_qty must be a whole number, 0 or more');
      const active = toBool(row[7]);
      if (active == null) fail('is_active must be yes or no');

      if (sku) {
        const k = lc(sku);
        if (seenSku.has(k)) fail(`sku "${sku}" is already used in ${seenSku.get(k)}`);
        else seenSku.set(k, `sheet "${sheetName}" row ${rn}`);
      }
      if (name) {
        const k = lc(name);
        if (seenName.has(k)) fail(`name "${name}" is already used in ${seenName.get(k)}`);
        else seenName.set(k, `sheet "${sheetName}" row ${rn}`);
      }

      const issues: Record<string, number> = {};
      let issueSum = 0;
      for (const shop of cat.shops) {
        const q = toNum(row[shop.col]);
        if (q == null) continue;
        if (Number.isNaN(q) || !Number.isInteger(q) || q < 0) {
          fail(`quantity for shop "${shop.name}" must be a whole number, 0 or more`);
          continue;
        }
        if (q > 0) {
          issues[String(shop.col)] = q;
          issueSum += q;
        }
      }
      if (!bad && issueSum > (stock ?? 0)) fail(`shop quantities total ${issueSum}, more than stock_qty ${stock ?? 0}`);
      if (bad) continue;

      cat.products.push({
        row: rn,
        sku,
        name,
        description: String(row[2] ?? '').trim(),
        mrp: mrp as number,
        sellingPrice: sp as number,
        discount: disc ?? 0,
        minThreshold: minT ?? 10,
        isActive: active as boolean,
        stockQty: stock ?? 0,
        issues,
      });
    }
    cats.push(cat);
  }

  if (cats.length === 0 && errors.length === 0) errors.push('No category sheets found.');
  return { data: errors.length ? null : { categories: cats }, errors };
}
