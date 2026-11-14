import type { RouteHandler } from '../types';
import { json, passThrough, readJson, unwrap } from './http';

type Backend = Parameters<RouteHandler>[0]['backend'];

const mismatch = (product: any, productId: unknown, shop: any, shopId: unknown, suffix: string) => {
  const productCategory = product?.categoryName ?? `category ${product?.categoryId}`;
  const shopCategory = shop?.categoryName ?? `category ${shop?.categoryId}`;
  return `Cannot issue product "${product?.name ?? productId}" (${productCategory}) to shop "${shop?.shopName ?? shopId}" (${shopCategory}). ${suffix}`;
};

/** Product and shop must share a category (ported validation). null = OK or not checkable. */
async function validateCategories(backend: Backend, shopId: number, productIds: number[], suffix: string): Promise<string | null> {
  const [shopRes, ...productRes] = await Promise.all([
    backend(`/api/sales-svc/shops/${shopId}`),
    ...productIds.map((pid) => backend(`/api/inventory-svc/products/${pid}`)),
  ]);
  if (!shopRes.ok) return `Shop ${shopId} not found`;
  const shop = unwrap(await shopRes.json());
  if (shop?.categoryId == null) return null;
  for (let i = 0; i < productIds.length; i++) {
    if (!productRes[i].ok) return `Product ${productIds[i]} not found`;
    const product = unwrap(await productRes[i].json());
    if (product?.categoryId != null && product.categoryId !== shop.categoryId) {
      return mismatch(product, productIds[i], shop, shopId, suffix);
    }
  }
  return null;
}

/** POST /api/inventory/sales — single issue, with category check. */
export const issueToShop: RouteHandler = async ({ request, backend }) => {
  const body = await readJson<any>(request);
  if (!body) return json(400, { success: false, message: 'Invalid JSON body' });
  const hasContext = request.headers.get('authorization') && request.headers.get('x-event-id');
  if (body.productId != null && body.shopId != null && hasContext) {
    const error = await validateCategories(backend, Number(body.shopId), [Number(body.productId)], 'Product and shop must belong to the same category.');
    if (error) return json(400, { success: false, message: error });
  }
  return passThrough(await backend('/api/inventory-svc/sales', { method: 'POST', body }));
};

/** POST /api/inventory/sales/bulk — bulk issue to ONE shop, with category check. */
export const bulkIssueToShop: RouteHandler = async ({ request, backend }) => {
  const body = await readJson<Array<{ productId: number; shopId: number }>>(request);
  if (!body) return json(400, { success: false, message: 'Invalid JSON body' });
  const hasContext = request.headers.get('authorization') && request.headers.get('x-event-id');
  if (Array.isArray(body) && body.length > 0 && hasContext) {
    const shopIds = [...new Set(body.map((i) => i.shopId).filter(Boolean))];
    if (shopIds.length > 1) return json(400, { success: false, message: `Bulk issue must target a single shop. Found multiple shopIds: ${shopIds.join(', ')}` });
    if (shopIds.length === 1) {
      const productIds = [...new Set(body.map((i) => i.productId).filter(Boolean))];
      const error = await validateCategories(backend, shopIds[0], productIds, "All products must match the shop's category.");
      if (error) return json(400, { success: false, message: error });
    }
  }
  return passThrough(await backend('/api/inventory-svc/sales/bulk', { method: 'POST', body }));
};
