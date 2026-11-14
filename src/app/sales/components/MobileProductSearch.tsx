import React from 'react';
import { CancelIcon } from '@/components/ui/Icons';
import { PriceTag } from '../helpers/priceDisplay';

interface MobileProductSearchProps {
    mobileSearchOpen: number | null;
    mobileSearchQuery: string;
    setMobileSearchQuery: (val: string) => void;
    closeMobileSearch: () => void;
    getFilteredProducts: (idx: number) => any[];
    handleProductSearch: (idx: number, val: string) => void;
    handleProductSelect: (idx: number, productId: string) => void;
    setMobileSearchOpen: (val: number | null) => void;
    mobileSearchInputRef: React.RefObject<HTMLInputElement>;
    isMobile: boolean
}

export function MobileProductSearch({
    mobileSearchOpen, mobileSearchQuery, setMobileSearchQuery, closeMobileSearch,
    getFilteredProducts, handleProductSearch, handleProductSelect, setMobileSearchOpen: setOpen, isMobile,
    mobileSearchInputRef
}: MobileProductSearchProps) {
    if (mobileSearchOpen === null) return null;

    return (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end sm:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={closeMobileSearch} />
            <div className="relative bg-white rounded-t-3xl h-[80vh] flex flex-col shadow-2xl animate-fade-in-up border-t border-slate-200">
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
                </div>
                <div className="p-4 border-b border-slate-100">
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            ref={mobileSearchInputRef}
                            type="text"
                            autoFocus
                            onFocus={(e) => e.currentTarget.select()}
                            value={mobileSearchQuery}
                            onChange={(e) => {
                                const val = e.target.value;
                                setMobileSearchQuery(val);
                                handleProductSearch(mobileSearchOpen, val);
                            }}
                            placeholder="Search product name or SKU..."
                            className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                        />
                        {mobileSearchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMobileSearchQuery('');
                                    handleProductSearch(mobileSearchOpen, '');
                                    mobileSearchInputRef.current?.focus();
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-full hover:bg-slate-200"
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                <CancelIcon />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {getFilteredProducts(mobileSearchOpen).length > 0 ? (
                        getFilteredProducts(mobileSearchOpen).map((product: any, pi: number, arr: any[]) => (
                            <React.Fragment key={product.id}>
                            {product._section === 'recent' && pi === 0 && (
                                <div className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Recent · most sold by you</div>
                            )}
                            {product._section === 'all' && arr[pi - 1]?._section === 'recent' && (
                                <div className="px-2 pt-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">All products</div>
                            )}
                            <button
                                type="button"
                                disabled={!!product._outOfStock}
                                onClick={() => {
                                    handleProductSelect(mobileSearchOpen, product.id.toString());
                                    setOpen(null);
                                }}
                                className={`w-full text-left px-4 py-3 mb-2 bg-white rounded-2xl border border-slate-150 active:bg-sky-50 transition-colors flex flex-col justify-between ${product._outOfStock ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                <div className="flex justify-between items-center w-full">
                                    <span className="font-bold text-slate-800 text-sm sm:text-base">{product.name}</span>
                                    {product.sku && <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{product.sku}</span>}
                                </div>
                                <div className="flex justify-between items-center w-full mt-1.5 border-t border-slate-50 pt-1.5">
                                    <PriceTag mrp={product.mrp} sellingPrice={product.sellingPrice} size="sm" priceClassName="sm:text-sm font-extrabold" />
                                    {product.shopStock !== undefined && (
                                        <span className={`text-[10px] font-bold ${product.shopStock > 5 ? 'text-green-600' : 'text-red-500'}`}>
                                            {product._outOfStock ? 'Out of stock' : `Stock: ${product.shopStock}`}
                                        </span>
                                    )}
                                </div>
                                {product._soldCount > 0 && <div className="text-[10px] font-bold text-sky-600 mt-1">Sold {product._soldCount}</div>}
                            </button>
                            </React.Fragment>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                            <span className="text-4xl">📦</span>
                            <p className="font-medium text-slate-500">No products found</p>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                    <button
                        type="button"
                        onClick={closeMobileSearch}
                        className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl active:bg-slate-100"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}