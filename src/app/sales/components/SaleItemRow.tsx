import { PriceTag, hasDiscount } from '../helpers/priceDisplay';
import React, { useEffect, useRef } from 'react';

import { CancelIcon } from '@/components/ui/Icons';

interface SaleItemRowProps {
    item: any;
    index: number;
    saleData: any;
    shopProducts: any[];
    isDropdownOpen: boolean;
    productSearch: string;
    selectedIdx: number;
    onSearchChange: (idx: number, val: string, el?: HTMLInputElement | null) => void;
    onSelect: (idx: number, productId: string) => void;
    onRemove: (idx: number) => void;
    onUpdate: (idx: number, field: string, val: string) => void;
    onKeyDown: (idx: number, e: React.KeyboardEvent) => void;
    onQuantityKeyDown: (idx: number, e: React.KeyboardEvent) => void;
    onBackspace: (e: React.KeyboardEvent, field: string, idx?: number) => void;
    onDeleteRow: (idx: number, e: React.KeyboardEvent) => void;
    getFilteredProducts: (idx: number) => any[];
    setMobileSearchOpen: (idx: number) => void;
    setMobileSearchQuery: (val: string) => void;
    setShowProductDropdowns: (updater: (prev: boolean[]) => boolean[]) => void;
    setProductSearches: (updater: (prev: string[]) => string[]) => void;
    updateDropdownDirection: (idx: number, el?: HTMLInputElement | null) => void;
    isMobile: boolean;
    onProductRowShiftTab?: (index: number, e: React.KeyboardEvent) => void;
    qtyIsPristine: boolean;
    onQuantityFirstFocus: () => void;
}

const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" strokeLinecap="round" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
);

const TrashIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

export function SaleItemRow({
    item, index, saleData, shopProducts, isDropdownOpen, productSearch, selectedIdx,
    onSearchChange, onSelect, onRemove, onUpdate, onKeyDown, onQuantityKeyDown,
    onBackspace, onDeleteRow, getFilteredProducts, setMobileSearchOpen, setMobileSearchQuery,
    setShowProductDropdowns, setProductSearches, updateDropdownDirection, isMobile,
    onProductRowShiftTab, qtyIsPristine, onQuantityFirstFocus,
}: SaleItemRowProps) {
    // Scroll highlighted dropdown item into view when ArrowUp/Down navigates
    const dropdownContainerRef = useRef<HTMLDivElement>(null);
    const justSelectedRef = useRef(false);
    useEffect(() => {
        if (!isDropdownOpen || selectedIdx < 0 || !dropdownContainerRef.current) return;
        const el = dropdownContainerRef.current.querySelector<HTMLDivElement>(
            `[data-option-index="${selectedIdx}"]`
        );
        if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [selectedIdx, isDropdownOpen]);

    const handleMinus = () => {
        const currentVal = parseInt(item.quantity) || 1;
        const newVal = Math.max(1, currentVal - 1);
        onUpdate(index, 'quantity', newVal.toString());
        // The +/- buttons are a deliberate quantity change too — don't let a later
        // click into the text field wipe out the value they just set.
        if (qtyIsPristine) onQuantityFirstFocus();
    };

    const handlePlus = () => {
        // No longer capped at stockLimit — overselling past counter stock is allowed
        // (the backend caps the actual deficit against warehouse reserve at checkout).
        const currentVal = parseInt(item.quantity) || 0;
        const newVal = currentVal + 1;
        onUpdate(index, 'quantity', newVal.toString());
        if (qtyIsPristine) onQuantityFirstFocus();
    };

    const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const valStr = e.target.value;
        if (valStr === '') { onUpdate(index, 'quantity', ''); return; }
        let valNum = parseInt(valStr);
        if (isNaN(valNum)) return;
        if (valNum < 1) valNum = 1;
        onUpdate(index, 'quantity', valNum.toString());
    };

    const handleManualBlur = () => {
        const currentVal = parseInt(item.quantity);
        if (isNaN(currentVal) || currentVal < 1) onUpdate(index, 'quantity', '1');
    };

    return (
        <div
            className={`relative rounded-2xl mb-3 bg-white border transition-all duration-200
                ${isDropdownOpen
                    ? 'z-[100] border-sky-400 shadow-lg ring-2 ring-sky-500/10'
                    : 'z-0 border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }
                ${(!saleData.shopId || saleData.shopId === 'ALL') ? 'opacity-50 pointer-events-none' : ''}
            `}
        >
            {/* Row number strip */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-0">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-sky-100 text-sky-700 text-[10px] font-black shrink-0">
                    {index + 1}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item</span>
                {item?.productId && (() => {
                    const sp = shopProducts.find((p: any) => p.id.toString() === item.productId);
                    return sp ? (
                        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full
                            ${sp.shopStock > 5 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            Stock: {sp.shopStock}
                        </span>
                    ) : null;
                })()}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end p-4 pt-2">
                {/* Product Search column */}
                <div className="flex-1 min-w-0">
                    {/* Floating-label style product search */}
                    <div className={`relative w-full transition-all duration-200 bg-transparent rounded-xl border
                        ${isDropdownOpen
                            ? 'border-sky-500 ring-2 ring-sky-500/15'
                            : 'border-slate-200 hover:border-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15'
                        }`}
                    >
                        <span className="absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-500 pointer-events-none select-none z-10">
                            Product
                        </span>
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <SearchIcon />
                        </span>
                        <input
                            type="text"
                            value={productSearch || ''}
                            onChange={(e) => onSearchChange(index, e.target.value, e.currentTarget)}
                            onFocus={(e) => {
                                if (window.innerWidth < 640) {
                                    setProductSearches(prev => { const copy = [...prev]; copy[index] = ''; return copy; });
                                    setMobileSearchQuery('');
                                    setMobileSearchOpen(index);
                                    e.currentTarget.blur();
                                } else {
                                    // Don't blank the text just because the field received focus (e.g. Tab
                                    // or Shift+Tab landing here while reviewing/editing a row that already
                                    // has a product). That caused a visible flash — name disappears, full
                                    // dropdown pops open, then 200ms later on blur it silently reappears —
                                    // which looked like the row had glitched. Select the existing text
                                    // instead: typing still replaces it immediately, but nothing is lost or
                                    // flickers just from passing through the field.
                                    e.currentTarget.select();
                                    updateDropdownDirection(index, e.currentTarget);
                                    setShowProductDropdowns(prev => { const copy = [...prev]; copy[index] = true; return copy; });
                                }
                            }}
                            onBlur={() => {
                                if (window.innerWidth < 640) return;
                                setTimeout(() => {
                                    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
                                    setShowProductDropdowns(prev => { const copy = [...prev]; copy[index] = false; return copy; });
                                    setProductSearches(prev => { const copy = [...prev]; copy[index] = item.productName || ''; return copy; });
                                }, 200);
                            }}
                            onKeyDown={(e) => {
                                if (onProductRowShiftTab) onProductRowShiftTab(index, e);
                                if (!e.defaultPrevented) onKeyDown(index, e);
                                onBackspace(e, 'product', index);
                                onDeleteRow(index, e);
                            }}
                            placeholder="Search and select product..."
                            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-0 bg-transparent border-0"
                            data-item-index={index}
                            tabIndex={10 + index * 3}
                            required
                        />
                        {productSearch && (
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    // preventDefault keeps focus on the input (no blur fires from this
                                    // click) — so, unlike the dropdown-option mousedown below, there is no
                                    // real blur race to guard against here. Do NOT set justSelectedRef here:
                                    // since this click never actually blurs the input, the flag would never
                                    // get consumed by it and would instead be wrongly consumed by the *next*
                                    // real blur (tabbing/clicking away after clearing), causing that blur's
                                    // cleanup (closing the dropdown, restoring the text) to be silently
                                    // skipped — leaving the dropdown stuck open.
                                    e.preventDefault();
                                }}
                                onClick={(e) => {
                                    const inputEl = e.currentTarget.parentElement?.querySelector<HTMLInputElement>(`input[data-item-index="${index}"]`);
                                    // Route through onSearchChange (not just local setProductSearches) so the
                                    // underlying selected product/productId is cleared too — otherwise the
                                    // field looks empty but the row still counts as a valid item at checkout.
                                    onSearchChange(index, '', inputEl);
                                    inputEl?.focus();
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100 z-10"
                                title="Clear search"
                                aria-label="Clear search"
                            >
                                <CancelIcon />
                            </button>
                        )}
                        {isDropdownOpen && (
                            <div ref={dropdownContainerRef} className="absolute z-[200] left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl py-1 max-h-48 overflow-y-auto">
                                {getFilteredProducts(index).length > 0 ? (
                                    getFilteredProducts(index).map((product: any, productIndex: number, arr: any[]) => (
                                        <React.Fragment key={product.id}>
                                        {product._section === 'recent' && productIndex === 0 && (
                                            <div data-testid="recent-header" className="px-3 pt-1.5 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Recent · most sold by you</div>
                                        )}
                                        {product._section === 'all' && arr[productIndex - 1]?._section === 'recent' && (
                                            <div data-testid="all-header" className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wide text-slate-400 border-t border-slate-100">All products</div>
                                        )}
                                        <div
                                            data-option-index={productIndex}
                                            data-testid={product._section === 'recent' ? 'recent-option' : 'all-option'}
                                            aria-disabled={product._outOfStock ? true : undefined}
                                            onMouseDown={(e) => { e.preventDefault(); if (product._outOfStock) return; justSelectedRef.current = true; onSelect(index, product.id.toString()); }}
                                            className={`px-3 py-2.5 transition-colors duration-100 border-b border-slate-50 last:border-0
                                                ${product._outOfStock ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
                                                ${selectedIdx === productIndex
                                                    ? 'bg-sky-50 text-sky-700'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs sm:text-sm font-semibold">{product.name}</span>
                                                {product.sku && (
                                                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                        {product.sku}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex justify-between items-center mt-0.5">
                                                <PriceTag mrp={product.mrp} sellingPrice={product.sellingPrice} size="sm" />
                                                {product.shopStock !== undefined && (
                                                    <span className={`text-[10px] font-bold ${product.shopStock > 5 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {product._outOfStock ? 'Out of stock' : `${product.shopStock} in stock`}
                                                    </span>
                                                )}
                                            </div>
                                            {product._soldCount > 0 && (
                                                <div className="text-[10px] font-bold text-sky-600 mt-0.5">Sold {product._soldCount}</div>
                                            )}
                                        </div>
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <div className="p-4 text-center">
                                        <p className="text-xs text-slate-500 font-semibold">
                                            {productSearch ? 'No products match' : 'No products available'}
                                        </p>
                                        {saleData.shopId && shopProducts.length === 0 && (
                                            <p className="text-[10px] text-orange-500 mt-1">No stock issued to this shop yet.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quantity + Price + Remove */}
                <div className="flex items-end gap-3 shrink-0">
                    {/* Quantity */}
                    <div className="w-full sm:w-32">
                        <div className="relative w-full transition-all duration-200 bg-transparent rounded-xl border border-slate-200 hover:border-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15">
                            <span className="absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-500 pointer-events-none select-none z-10">
                                Qty
                            </span>
                            <div className="flex items-center">
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    disabled={!item.productId || (parseInt(item.quantity) || 1) <= 1}
                                    onClick={handleMinus}
                                    className="w-8 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-25 border-r border-slate-200 font-bold select-none text-lg rounded-l-xl"
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    value={item.quantity}
                                    onChange={handleManualChange}
                                    onFocus={() => {
                                        if (qtyIsPristine) {
                                            onUpdate(index, 'quantity', '');
                                            onQuantityFirstFocus();
                                        }
                                    }}
                                    onMouseUp={(e) => {
                                        if (qtyIsPristine) e.preventDefault();
                                    }}
                                    onBlur={handleManualBlur}
                                    onKeyDown={(e) => {
                                        onQuantityKeyDown(index, e);
                                        onBackspace(e, 'quantity', index);
                                        onDeleteRow(index, e);
                                    }}
                                    className="w-full text-center py-2 focus:outline-none focus:ring-0 text-xs sm:text-sm font-bold text-slate-800 bg-transparent border-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="Qty"
                                    data-quantity-index={index}
                                    tabIndex={11 + index * 3}
                                    required
                                />
                                <button
                                    type="button"
                                    tabIndex={-1}
                                    // Stock-limit cap removed — overselling is allowed (backend caps
                                    // the real deficit against warehouse reserve).
                                    disabled={!item.productId}
                                    onClick={handlePlus}
                                    className="w-8 h-9 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-25 border-l border-slate-200 font-bold select-none text-lg rounded-r-xl"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Price (read-only) */}
                    <div className="w-full sm:w-28">
                        <div className="relative w-full transition-all duration-200 rounded-xl border border-slate-100 bg-slate-50/80">
                            <span className="absolute left-3 px-1 bg-slate-50 uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-400 pointer-events-none select-none z-10">
                                Price
                            </span>
                            {hasDiscount(item.mrp, item.sellingPrice) && (
                                <span className="absolute right-3 top-1 text-[9px] text-red-500 font-bold line-through decoration-1 decoration-red-300 pointer-events-none select-none z-10">
                                    ₹{item.mrp}
                                </span>
                            )}
                            <input
                                type="number"
                                step="0.01"
                                value={item.sellingPrice}
                                onKeyDown={(e) => onDeleteRow(index, e)}
                                className="w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-400 bg-transparent border-0 focus:outline-none cursor-not-allowed select-none"
                                tabIndex={-1}
                                readOnly
                            />
                        </div>
                    </div>

                    {/* Remove button */}
                    <div className="pb-0.5">
                        <button
                            type="button"
                            onClick={() => onRemove(index)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-400 focus:text-red-500 focus:bg-red-50 focus:border-red-300"
                            tabIndex={12 + index * 3}
                            title="Remove item (Tab to reach, Enter/Click to delete)"
                        >
                            <TrashIcon />
                        </button>
                    </div>
                </div>
            </div>

            {/* Low-stock warning — rendered OUTSIDE the items-end input row on purpose.
                It used to live inside the Qty column only, which made that column taller
                than Product/Price/Remove and pushed them down to stay bottom-aligned —
                visually the Qty input looked like it "jumped up". Living here, below the
                whole row, it can never affect the row's own alignment. */}
            {item.productId && (() => {
                const p = shopProducts.find((sp: any) => sp.id.toString() === item.productId);
                const stock = p ? (p.shopStock || 0) : 0;
                const totalQty = saleData.items
                    .filter((i: any) => i.productId === item.productId)
                    .reduce((sum: number, i: any) => sum + (parseInt(i.quantity) || 0), 0);
                if (totalQty <= stock) return null;
                return (
                    <p className="text-[10px] text-red-500 font-semibold px-4 pb-3 -mt-2 text-right">
                        {totalQty} selected, only {stock} in stock
                    </p>
                );
            })()}
        </div>
    );
}
