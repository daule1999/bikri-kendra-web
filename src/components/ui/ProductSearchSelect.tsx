'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';
import { matchByNameSku } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';

export interface ProductSearchOption {
    id: number | string;
    name: string;
    sku?: string;
    /** Optional live quantity to show alongside name/sku in the dropdown (e.g. current MAIN
     * inventory stock), so the picker doubles as an at-a-glance stock check while choosing. */
    liveQty?: number;
    /** Optional MRP / selling price to show alongside name/sku in the dropdown. */
    mrp?: number;
    sellingPrice?: number;
}

interface ProductSearchSelectProps {
    products: ProductSearchOption[];
    value: string | number;
    onChange: (productId: string) => void;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    className?: string;
    /** Which side the dropdown panel opens on — 'up' for forms anchored near the bottom
     * of the viewport where a downward panel would run off-screen. */
    dropDirection?: 'down' | 'up';
    /** Optional helper text shown under the field, e.g. category-scoping hints. */
    hint?: ReactNode;
    emptyMessage?: string;
}

/**
 * Shared searchable product picker: a text input that filters `products` as you type and
 * shows matches in a dropdown panel. Used anywhere the project needs to pick a single
 * product from a (potentially long) list — issue forms, stock movement forms, and the
 * movement history filters — so the behavior (including auto-opening the dropdown on
 * focus) is identical everywhere instead of being hand-rolled per form.
 */
export function ProductSearchSelect({
    products,
    value,
    onChange,
    placeholder = 'Search products...',
    disabled = false,
    required = false,
    className = '',
    dropDirection = 'down',
    hint,
    emptyMessage = 'No products found',
}: ProductSearchSelectProps) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);

    // Keep the visible text in sync with the selected value (e.g. parent resets it after
    // submit, or the category filter changes) — but only while the user isn't actively
    // typing, so we don't fight their keystrokes mid-search.
    useEffect(() => {
        if (!isOpen) {
            const selected = products.find((p) => String(p.id) === String(value));
            setSearch(selected ? `${selected.name}${selected.sku ? ' - ' + selected.sku : ''}` : '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, products]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = matchByNameSku(search, products, { limit: Infinity });

    const selectProduct = (product: ProductSearchOption) => {
        onChange(String(product.id));
        setSearch(`${product.name}${product.sku ? ' - ' + product.sku : ''}`);
        setIsOpen(false);
        setHighlighted(-1);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlighted((i) => (i < filtered.length - 1 ? i + 1 : 0));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlighted((i) => (i > 0 ? i - 1 : filtered.length - 1));
                break;
            case 'Enter':
                e.preventDefault();
                if (highlighted >= 0 && filtered[highlighted]) selectProduct(filtered[highlighted]);
                break;
            case 'Escape':
                setIsOpen(false);
                setHighlighted(-1);
                break;
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <input
                type="text"
                value={search}
                disabled={disabled}
                placeholder={placeholder}
                required={required}
                onFocus={() => !disabled && setIsOpen(true)}
                onClick={() => !disabled && setIsOpen(true)}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setIsOpen(true);
                    setHighlighted(-1);
                    if (e.target.value === '') onChange('');
                }}
                onKeyDown={handleKeyDown}
                className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {!disabled && search && (
                <button
                    type="button"
                    onClick={() => {
                        setSearch('');
                        onChange('');
                        setIsOpen(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                    title="Clear search"
                    aria-label="Clear search"
                >
                    <CancelIcon />
                </button>
            )}
            {hint && <p className="mt-1 text-xs text-indigo-500 font-medium pl-1">{hint}</p>}
            {isOpen && !disabled && (
                <div
                    onMouseDown={(e) => e.preventDefault()}
                    className={`absolute z-50 w-full bg-white border border-gray-200 rounded-xl max-h-48 overflow-y-auto ${dropDirection === 'up'
                            ? 'bottom-full mb-2 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.1)]'
                            : 'mt-1 shadow-xl'
                        }`}
                >
                    {filtered.length === 0 ? (
                        <div className="p-3 text-sm text-gray-400 text-center">{emptyMessage}</div>
                    ) : (
                        filtered.map((product, idx) => (
                            <div
                                key={product.id}
                                onClick={() => selectProduct(product)}
                                className={`p-3 cursor-pointer text-sm border-b border-gray-50 last:border-0 transition-colors flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1.5 sm:gap-2 ${highlighted === idx
                                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                                        : 'hover:bg-indigo-50 text-gray-700 hover:text-indigo-700'
                                    }`}
                            >
                                <span className="min-w-0 sm:truncate">{product.name}</span>
                                <span className="flex flex-wrap items-center gap-1.5 sm:gap-2 sm:shrink-0">
                                    {product.sku && <span className="text-xs text-gray-400 font-mono">{product.sku}</span>}
                                    {(product.mrp !== undefined || product.sellingPrice !== undefined) && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border bg-indigo-50 text-indigo-600 border-indigo-200 whitespace-nowrap">
                                            {product.sellingPrice !== undefined && `SP ₹${product.sellingPrice}`}
                                            {product.sellingPrice !== undefined && product.mrp !== undefined && ' / '}
                                            {product.mrp !== undefined && `MRP ₹${product.mrp}`}
                                        </span>
                                    )}
                                    {product.liveQty !== undefined && (
                                        <span
                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${product.liveQty > 0
                                                    ? 'bg-green-50 text-green-600 border-green-200'
                                                    : 'bg-red-50 text-red-600 border-red-200'
                                                }`}
                                        >
                                            Qty: {product.liveQty}
                                        </span>
                                    )}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
