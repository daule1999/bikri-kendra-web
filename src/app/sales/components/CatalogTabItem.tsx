import React from 'react';
import { PriceTag } from '../helpers/priceDisplay';

const PlusIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const MinusIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
);

interface CatalogTabItemProps {
    product: any;
    qty: number;              // current qty in basket (0 = not added)
    onAdd: (product: any) => void;
    onRemove: (productId: string) => void;
}

const CatalogTabItems = ({ product, qty, onAdd, onRemove }: CatalogTabItemProps) => {
    const inBasket = qty > 0;
    const atMaxStock = qty >= (product.shopStock || 0);
    const stockCount = product.shopStock || 0;
    const isLowStock = stockCount > 0 && stockCount <= 5;

    return (
        <div
            className={`relative bg-white border rounded-2xl p-3 flex flex-col justify-between gap-2 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5
                ${inBasket
                    ? 'border-sky-400 shadow-sm shadow-sky-100 ring-1 ring-sky-300/40'
                    : 'border-slate-200 hover:border-sky-300'
                }`}
        >
            {/* In-basket badge */}
            {inBasket && (
                <span className="absolute -top-2 -right-2 min-w-[22px] h-[22px] flex items-center justify-center px-1.5 rounded-full bg-sky-600 text-white text-[10px] font-black shadow-md border-2 border-white z-10">
                    {qty}
                </span>
            )}

            {/* Product info */}
            <div className="flex justify-between items-start gap-1.5">
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate leading-snug group-hover:text-sky-700 transition-colors">
                        {product.name}
                    </p>
                    {product.sku && (
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5 truncate">{product.sku}</p>
                    )}
                </div>

                {/* Stock badge */}
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-tight
                    ${stockCount <= 0
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : isLowStock
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                    {stockCount <= 0 ? 'Out of stock' : `${stockCount} left`}
                </span>
            </div>

            {/* Price row + controls */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <div>
                    <PriceTag mrp={product.mrp} sellingPrice={product.sellingPrice} size="md" priceClassName="text-sky-700 font-black" />
                </div>

                {stockCount <= 0 ? (
                    <span className="text-[10px] font-semibold text-slate-400 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
                        Unavailable
                    </span>
                ) : inBasket ? (
                    /* Qty stepper */
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onRemove(product.id.toString())}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-all duration-150 active:scale-90 focus:outline-none focus:ring-2 focus:ring-red-300"
                            title={qty === 1 ? 'Remove from basket' : 'Decrease'}
                        >
                            <MinusIcon />
                        </button>
                        <span className="w-6 text-center text-xs font-black text-slate-800 tabular-nums">{qty}</span>
                        <button
                            type="button"
                            onClick={() => onAdd(product)}
                            disabled={atMaxStock}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-150 active:scale-90 focus:outline-none focus:ring-2 focus:ring-sky-400"
                            title={atMaxStock ? `Max stock: ${product.shopStock}` : 'Add one more'}
                        >
                            <PlusIcon />
                        </button>
                    </div>
                ) : (
                    /* First add button */
                    <button
                        type="button"
                        onClick={() => onAdd(product)}
                        className="flex items-center gap-1 text-[10px] font-bold text-sky-600 bg-sky-50 hover:bg-sky-600 hover:text-white px-2.5 py-1.5 rounded-lg transition-all duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-400 border border-sky-200 hover:border-sky-600"
                    >
                        <PlusIcon /> Add
                    </button>
                )}
            </div>
        </div>
    );
};

export default CatalogTabItems;
