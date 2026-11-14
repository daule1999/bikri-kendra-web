import { Shop } from '@/hooks/useShop';

export interface ShopInfo {
  /** The shop's display name — used as {{SHOP_NAME}} token on receipts */
  shopName: string;
  /** The shop's organisation / category name — used as {{ORG_NAME}} token on receipts */
  orgName: string;
  /** The shop's counter number — printed on both main bill and receiving slip */
  counterNumber?: number;
}

/**
 * Resolve receipt identity (shopName + orgName) from a shopId and the loaded
 * shops list.
 *
 * shopName  = shop.shopName      (direct field)
 * orgName   = shop.categoryName  (backend JOIN from categories table)
 *
 * Both fields fall back to '' if the shop is not found — printBill handles
 * empty strings gracefully (the token simply renders blank).
 *
 * @param shopId     - bill.shopId or selectedShop?.id
 * @param allShops   - from useShop().assignedShops (already in memory)
 */
export function resolveShopInfo(
  shopId: number | string | null | undefined,
  allShops: Shop[],
): ShopInfo {
  if (!shopId) return { shopName: '', orgName: '' };
  const shop = allShops.find(s => String(s.id) === String(shopId));
  return {
    shopName:      shop?.shopName    || '',
    orgName:       shop?.categoryName || '',
    counterNumber: shop?.counterNumber,
  };
}
