// app/sales/hooks/useShopCatalog.ts
import { useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';

interface UseShopCatalogParams {
  /** Current shop identifier. Must be a numeric shop ID (not 'ALL'). */
  shopId: string;
  /** Setter for the global product list (all inventory products, for type-ahead search). */
  setProducts: (products: any[]) => void;
  /** Setter for shop-specific counter stocks (includes zero/negative-stock items — not filtered). */
  setShopProducts: (stocks: any[]) => void;
  /** Setter for the next preview invoice number. */
  setNextInvoiceNumber: (n: string) => void;
}

/**
 * Hook that fetches the unified shop catalog in a single HTTP call.
 *
 * Calls `GET /api/sales/retail/catalog/{shopId}` which proxies to the backend endpoint
 * `GET /api/sales-svc/retail/shop/{shopId}/catalog`. The backend resolves products,
 * stocks, and the next invoice number concurrently via `Mono.zip`.
 *
 * The returned `refreshCatalog` function is safe to call at any time — it is a
 * read-only operation that does NOT advance the invoice sequence counter.
 */
export function useShopCatalog({
  shopId,
  setProducts,
  setShopProducts,
  setNextInvoiceNumber,
}: UseShopCatalogParams) {
  const refreshCatalog = useCallback(async () => {
    if (!shopId || shopId === 'ALL') {
      return;
    }

    logger.info('CATALOG', 'Fetching unified shop catalog', { shopId });

    try {
      const resp = await apiClient.get(`/sales/retail/catalog/${shopId}`);

      if (!resp.ok) {
        logger.warn('CATALOG', 'Catalog fetch returned non-OK status', { status: resp.status, shopId });
        return;
      }

      const data = await resp.json();

      // Zero/negative-stock products are intentionally kept (not filtered) — the Catalog
      // tab shows them in a separate "Out of Stock" section, and the Sale tab allows
      // selling them (oversell, capped server-side by warehouse reserve).
      if (Array.isArray(data.stocks)) {
        setShopProducts(data.stocks);
      }

      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }

      if (typeof data.nextInvoiceNumber === 'string') {
        setNextInvoiceNumber(data.nextInvoiceNumber);
      }

      logger.info('CATALOG', 'Catalog refreshed successfully', {
        shopId,
        products: data.products?.length ?? 0,
        stocks: data.stocks?.length ?? 0,
        nextInvoice: data.nextInvoiceNumber,
      });
    } catch (error) {
      logger.error('CATALOG', 'Failed to fetch unified shop catalog', { shopId, error });
    }
  }, [shopId, setProducts, setShopProducts, setNextInvoiceNumber]);

  return { refreshCatalog };
}
