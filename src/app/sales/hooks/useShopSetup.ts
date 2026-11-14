import { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';

interface ShopSetupProps {
    saleData: any;
    setSaleData: React.Dispatch<React.SetStateAction<any>>;
    assignedShops: any[];
    shopsLoading: boolean;
    isAdmin: boolean;
    setShopProducts: React.Dispatch<React.SetStateAction<any[]>>;
    setErrorMessage: React.Dispatch<React.SetStateAction<string>>;
    setErrorRedirect: React.Dispatch<React.SetStateAction<boolean>>;
    setShowErrorModal: React.Dispatch<React.SetStateAction<boolean>>;
    refreshShops: () => Promise<void>;
    /**
     * Unified catalog refresh — replaces the previous fetchProducts + fetchShopProducts pair.
     * Calls GET /api/sales/retail/catalog/{shopId} which resolves products, stocks, and
     * next invoice number in a single backend request.
     */
    refreshCatalog: () => Promise<void>;
    eventId: string | null;
    setIsShopLocked: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useShopSetup({
    saleData, setSaleData, assignedShops, shopsLoading, isAdmin, setShopProducts,
    setErrorMessage, setErrorRedirect, setShowErrorModal, refreshShops, refreshCatalog, eventId, setIsShopLocked
}: ShopSetupProps) {
    const searchParams = useSearchParams();
    const queryShopId = searchParams.get('shopId');
    const lastFetchedShopIdRef = useRef<string | null>(null);
    const hasInitializedRef = useRef<boolean>(false);
    const [shopShiftMap, setShopShiftMap] = useState<Record<string, boolean>>({});
    const shopIds = useMemo(() => (assignedShops?.map((shop) => shop.id.toString()) ?? []), [assignedShops]);

    const checkActiveShiftsBulk = useCallback(async (shopIds: string[]): Promise<Record<string, boolean>> => {
        if (!shopIds || shopIds.length === 0) return {};
        try {
            const idsParam = shopIds.join(',');
            // Use local API proxy path mapping to shifts controller
            const response = await apiClient.get(`/shifts/active/bulk?shopIds=${idsParam}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to fetch bulk shift data: ${response.status} ${errorText}`);
            }
            const json = await response.json();
            const map: Record<string, boolean> = {};
            (Array.isArray(json) ? json : []).forEach((item: any) => {
                if (item && item.shopId != null) {
                    map[item.shopId.toString()] = !!item.open;
                }
            });
            return map;
        } catch (e) {
            return {};
        }
    }, []);

    const fetchShopProducts = useCallback(async (shopId: string) => {
        if (!shopId) { setShopProducts([]); return; }
        logger.info('SALES_PAGE', 'Fetching counter items map', { shopId });
        try {
            if (shopId === 'ALL') {
                const eligibleShopIds = assignedShops.map(shop => shop.id);
                if (eligibleShopIds.length === 0) return;
                const res = await apiClient.get(`/sales/retail/stocks/shops?shopIds=${eligibleShopIds.join(",")}`);
                if (res.ok) {
                    const results = await res.json();
                    const consolidatedMap: Record<string, any> = {};
                    (Array.isArray(results) ? results : []).forEach((p: any) => {
                        const key = p.id?.toString() || p.sku || p.name;
                        if (!key) return;
                        if (consolidatedMap[key]) {
                            consolidatedMap[key].shopStock += (p.shopStock || 0);
                        } else {
                            consolidatedMap[key] = { ...p };
                        }
                    });
                    const consolidatedList = Object.values(consolidatedMap);
                    // Zero/negative-stock products are kept (not filtered out) so the Catalog tab
                    // can show them in its "Out of Stock" section and the Sale tab can still sell
                    // them (oversell is now allowed, capped at the backend by warehouse reserve).
                    setShopProducts(consolidatedList);
                }
                return;
            }
            const res = await apiClient.get(`/sales/retail/stocks/${shopId}`);
            if (res.ok) {
                const data = await res.json();
                const productsList = Array.isArray(data) ? data : [];
                setShopProducts(productsList);
            }
        } catch (error) {
            logger.error('SALES_PAGE', 'Exception synced on counter stocks collection processing', error);
        }
    }, []);

    useEffect(() => {
        if (!eventId) return;
        const initializeGlobalContext = async () => {
            logger.info('SALES_PAGE', 'Initializing baseline context variables');
            lastFetchedShopIdRef.current = null;
            // refreshShops is lightweight (shop list only). refreshCatalog requires a shopId,
            // so it fires later in the shop-change effect once a shopId is selected.
            await refreshShops();
        };
        initializeGlobalContext();
    }, [eventId]);

    useEffect(() => {
        if (shopsLoading || !assignedShops || assignedShops.length === 0) return;
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        const setupUserAssignments = async () => {
            // Check shift status for all assigned shops (bulk)
            const bulkMap = await checkActiveShiftsBulk(shopIds);
            setShopShiftMap(bulkMap);
            const shiftsStatus = shopIds.map((id) => ({ shopId: id, open: !!bulkMap[id] }));
            const firstOpenShop = shiftsStatus.find(s => s.open);

            let targetShop = queryShopId && assignedShops.some(s => s.id.toString() === queryShopId)
                ? queryShopId
                : null;

            if (targetShop) {
                const queryShopStatus = shiftsStatus.find(s => s.shopId === targetShop);
                // If requested shop shift is closed but another shop has an open shift, redirect to the first open shop
                if ((!queryShopStatus || !queryShopStatus.open) && firstOpenShop) {
                    targetShop = firstOpenShop.shopId;
                }
            } else if (firstOpenShop) {
                targetShop = firstOpenShop.shopId;
            } else {
                targetShop = assignedShops[0]?.id.toString();
            }

            if (isAdmin) {
                setIsShopLocked(false);
                if (!saleData.shopId && targetShop) {
                    setSaleData((prev: any) => ({ ...prev, shopId: targetShop }));
                }
                return;
            }
            if (assignedShops.length === 1) {
                const singleAssignment = assignedShops[0];
                setIsShopLocked(true);
                setSaleData((prev: any) => {
                    if (prev.shopId === singleAssignment.id.toString()) return prev;
                    return { ...prev, shopId: singleAssignment.id.toString() };
                });
            } else if (assignedShops.length > 1) {
                setIsShopLocked(false);
                if (!saleData.shopId && targetShop) {
                    setSaleData((prev: any) => ({ ...prev, shopId: targetShop }));
                }
            }
        };
        setupUserAssignments();
    }, [shopIds, shopsLoading, isAdmin, setSaleData, setIsShopLocked, queryShopId]);

    useEffect(() => {
        const currentShopId = saleData.shopId;
        if (!currentShopId) {
            setShopProducts([]);
            return;
        }
        if (lastFetchedShopIdRef.current === currentShopId) return;
        lastFetchedShopIdRef.current = currentShopId;

        const syncCounterInventoryContext = async () => {
            const isOpen = shopShiftMap[currentShopId] ?? false;
            // Use the unified catalog endpoint — fetches products, stocks, and next
            // invoice number in a single round-trip (Option B).
            await refreshCatalog();
            if (currentShopId !== 'ALL' && !isOpen) {
                setErrorMessage('No active shift session is open for this shop counter. You must open a shift session before processing sales.');
                setErrorRedirect(true);
                setShowErrorModal(true);
            }
        };

        syncCounterInventoryContext();
    }, [saleData.shopId]);

    const refreshShopProducts = async (shopId: string) => {
        await fetchShopProducts(shopId);
    };

    return { refreshShopProducts };
}