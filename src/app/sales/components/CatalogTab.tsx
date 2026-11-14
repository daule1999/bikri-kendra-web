import { MuiSelect } from '@/components/ui/MuiSelect';
import { CancelIcon } from '@/components/ui/Icons';
import React, { useEffect, useMemo, useState } from 'react';
import CatalogTabItems from './CatalogTabItem';
import { matchProducts } from '../helpers/productMatch';

interface BasketItem {
    product: any;
    qty: number;
}

interface CatalogTabProps {
    shopId: string;
    shopProducts: any[];
    assignedShops: any[];
    isAdmin: boolean;
    onShopChange: (shopId: string) => void;
    isMobile: boolean;
    isFullscreen?: boolean;
    // Basket props
    basketItems: Record<string, BasketItem>;
    onAddToBasket: (product: any) => void;
    onRemoveFromBasket: (productId: string) => void;
}

const BoxIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
);

const StoreEmptyIcon = () => (
    <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const WarningIcon = () => (
    <svg className="w-10 h-10 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

export function CatalogTab({
    shopId, shopProducts, assignedShops, isAdmin, onShopChange, isMobile, isFullscreen,
    basketItems, onAddToBasket, onRemoveFromBasket
}: CatalogTabProps) {
    const selectOptions = [
        ...(isAdmin || assignedShops.length > 1 ? [{ value: 'ALL', label: 'All Shops / All Counters' }] : []),
        ...assignedShops.map(shop => ({
            value: shop.id.toString(),
            label: `${shop.shopName} - Counter ${shop.counterNumber}`,
        })),
    ];

    const totalBasketItems = Object.values(basketItems).reduce((sum, b) => sum + b.qty, 0);
    const [catalogSearch, setCatalogSearch] = useState('');

    // CatalogTab is not remounted when the shop changes (no key prop tied to
    // shopId in page.tsx), so a stale search term would otherwise silently
    // keep hiding products after switching shops/counters.
    useEffect(() => {
        setCatalogSearch('');
    }, [shopId]);

    const filteredProducts = useMemo(
        () => matchProducts(catalogSearch, shopProducts, { limit: Infinity }),
        [catalogSearch, shopProducts],
    );
    const isSearching = catalogSearch.trim().length > 0;

    // shopProducts is no longer pre-filtered to positive stock (see useShopCatalog.ts) —
    // split here so sold-out items get their own section instead of disappearing.
    const inStockProducts = useMemo(
        () => filteredProducts.filter((p: any) => (p.shopStock || 0) > 0),
        [filteredProducts],
    );
    const outOfStockProducts = useMemo(
        () => filteredProducts.filter((p: any) => (p.shopStock || 0) <= 0),
        [filteredProducts],
    );

    return (
        <div className={`flex flex-col pr-1 ${isFullscreen ? 'pb-4' : 'pb-24 sm:pb-0'}`}>

            {/* Header bar */}
            <div className="flex items-center justify-between px-1 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                        <BoxIcon />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-slate-800">Counter Catalog</h4>
                        <p className="text-[10px] text-slate-400">Add items to basket, then checkout</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {totalBasketItems > 0 && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                            🛒 {totalBasketItems} in basket
                        </span>
                    )}
                    <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full">
                        {isSearching ? `${filteredProducts.length} of ${shopProducts.length} products` : `${shopProducts.length} products`}
                    </span>
                </div>
            </div>

            {/* Shop selector */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-4 shrink-0 relative z-20 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <p className="text-xs font-semibold text-slate-700 mb-0.5">Select Counter / Shop</p>
                        <p className="text-[10px] text-slate-400 max-w-xs">
                            {(() => {
                                const username = typeof window !== 'undefined' ? localStorage.getItem('username') : '';
                                const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
                                const isUserAdmin = isAdmin || userRole === 'ADMIN' || username === 'admin' || username?.endsWith('_admin');
                                if (isUserAdmin) return 'Admin — browse any shop or all counters.';
                                return 'Browse stock at your assigned counter(s).';
                            })()}
                        </p>
                    </div>
                    <div className="w-full sm:w-72">
                        <MuiSelect
                            label="Counter / Shop"
                            value={shopId || ''}
                            onChange={onShopChange}
                            options={selectOptions}
                            disabled={assignedShops.length === 0}
                            size="small"
                        />
                    </div>
                </div>
            </div>

            {/* Search bar */}
            <div className="relative w-full mb-3 shrink-0 bg-white rounded-xl border border-slate-200 hover:border-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15 transition-all duration-200">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <SearchIcon />
                </span>
                <input
                    type="text"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Search products by name or SKU..."
                    className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-0 bg-transparent border-0"
                />
                {catalogSearch && (
                    <button
                        type="button"
                        onClick={() => setCatalogSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                        title="Clear search"
                        aria-label="Clear search"
                    >
                        <CancelIcon />
                    </button>
                )}
            </div>

            {/* Content states */}
            {!shopId ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white border border-dashed border-slate-200 rounded-2xl">
                    <StoreEmptyIcon />
                    <p className="text-sm font-semibold text-slate-500 mt-3">No shop selected</p>
                    <p className="text-xs text-slate-400 mt-1">Select a shop above to view available stock</p>
                </div>
            ) : shopProducts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white border border-dashed border-amber-200 rounded-2xl">
                    <WarningIcon />
                    <p className="text-sm font-bold text-slate-600 mt-3">No stock available</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[240px]">
                        {shopId === 'ALL'
                            ? 'No stock across any shops. Issue stock from the Inventory panel.'
                            : 'No stock at this counter. Issue stock from the Inventory panel.'}
                    </p>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-10 bg-white border border-dashed border-slate-200 rounded-2xl">
                    <span className="text-slate-300"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
                    <p className="text-sm font-bold text-slate-600 mt-3">No products match &quot;{catalogSearch}&quot;</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[240px]">Try a different name or SKU.</p>
                    <button
                        type="button"
                        onClick={() => setCatalogSearch('')}
                        className="mt-3 text-xs font-bold text-sky-600 hover:text-sky-700 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 transition-colors duration-150"
                    >
                        Clear search
                    </button>
                </div>
            ) : (
                <>
                    {inStockProducts.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 pb-4">
                            {inStockProducts.map((product) => (
                                <CatalogTabItems
                                    key={product.id}
                                    product={product}
                                    qty={basketItems[product.id.toString()]?.qty || 0}
                                    onAdd={onAddToBasket}
                                    onRemove={onRemoveFromBasket}
                                />
                            ))}
                        </div>
                    )}

                    {outOfStockProducts.length > 0 && (
                        <div className="mt-1">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Out of Stock</span>
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                    {outOfStockProducts.length}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 pb-4 opacity-80">
                                {outOfStockProducts.map((product) => (
                                    <CatalogTabItems
                                        key={product.id}
                                        product={product}
                                        qty={basketItems[product.id.toString()]?.qty || 0}
                                        onAdd={onAddToBasket}
                                        onRemove={onRemoveFromBasket}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
