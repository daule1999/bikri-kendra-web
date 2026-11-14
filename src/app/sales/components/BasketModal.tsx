'use client';

import React, { useState } from 'react';
import { PriceTag } from '../helpers/priceDisplay';

interface BasketItem {
    product: any;
    qty: number;
}

interface BasketModalProps {
    show: boolean;
    basketItems: Record<string, BasketItem>;
    onClose: () => void;
    onCheckout: () => void;
    onAdd: (product: any) => void;
    onRemove: (productId: string) => void;
    hasSaleItems?: boolean; // true when Sale tab already has valid items
}

const CloseIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const CartIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const EmptyCartIcon = () => (
    <svg className="w-14 h-14 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const MinusIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
);

const PlusIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
);

const TrashIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
);

const ArrowRightIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
    </svg>
);

export function BasketModal({ show, basketItems, onClose, onCheckout, onAdd, onRemove, hasSaleItems = false }: BasketModalProps) {
    const [confirmOverwrite, setConfirmOverwrite] = useState(false);

    if (!show) return null;

    const items = Object.values(basketItems);
    const totalItems = items.reduce((sum, b) => sum + b.qty, 0);
    const totalAmount = items.reduce((sum, b) => sum + b.qty * (b.product.sellingPrice || 0), 0);

    const handleCheckoutClick = () => {
        if (hasSaleItems) {
            setConfirmOverwrite(true);
        } else {
            onCheckout();
        }
    };

    const handleConfirmCheckout = () => {
        setConfirmOverwrite(false);
        onCheckout();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label="Shopping basket"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal panel */}
            <div className="relative w-full sm:max-w-lg mx-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh] sm:max-h-[80vh] overflow-hidden animate-slide-up">

                {/* Header */}
                <div
                    className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}
                >
                    <div className="flex items-center gap-3 text-white">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <CartIcon />
                        </div>
                        <div>
                            <h2 className="text-base font-bold leading-tight">Your Basket</h2>
                            <p className="text-[11px] text-sky-200 font-medium">
                                {totalItems === 0 ? 'No items added' : `${totalItems} item${totalItems > 1 ? 's' : ''} · ₹${totalAmount.toFixed(2)}`}
                            </p>
                        </div>
                    </div>
                    <button
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/30 text-white transition-colors"
                        onClick={() => { setConfirmOverwrite(false); onClose(); }}
                    >
                        <CloseIcon />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-center">
                            <EmptyCartIcon />
                            <p className="text-sm font-bold text-slate-500 mt-4">Basket is empty</p>
                            <p className="text-xs text-slate-400 mt-1">Add products from the catalog to get started</p>
                        </div>
                    ) : (
                        items.map(({ product, qty }) => {
                            const lineTotal = qty * (product.sellingPrice || 0);
                            const isAtStock = qty >= (product.shopStock || 0);
                            return (
                                <div
                                    key={product.id}
                                    className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 group hover:border-sky-200 hover:bg-sky-50/40 transition-all duration-150"
                                >
                                    {/* Product info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate leading-snug">
                                            {product.name}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {product.sku && (
                                                <span className="text-[10px] font-mono text-slate-400">{product.sku}</span>
                                            )}
                                            <PriceTag mrp={product.mrp} sellingPrice={product.sellingPrice} size="sm" priceClassName="font-semibold" />
                                        </div>
                                    </div>

                                    {/* Qty controls */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => onRemove(product.id.toString())}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-all duration-150 active:scale-90"
                                            title={qty === 1 ? 'Remove from basket' : 'Decrease quantity'}
                                        >
                                            {qty === 1 ? <TrashIcon /> : <MinusIcon />}
                                        </button>
                                        <span className="w-7 text-center text-sm font-black text-slate-800 tabular-nums">
                                            {qty}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onAdd(product)}
                                            disabled={isAtStock}
                                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-sky-600 hover:bg-sky-700 text-white disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-150 active:scale-90"
                                            title={isAtStock ? `Max stock: ${product.shopStock}` : 'Increase quantity'}
                                        >
                                            <PlusIcon />
                                        </button>
                                    </div>

                                    {/* Line total */}
                                    <div className="text-right shrink-0 min-w-[56px]">
                                        <p className="text-sm font-black text-slate-800">₹{lineTotal.toFixed(2)}</p>
                                        {isAtStock && (
                                            <p className="text-[9px] text-amber-600 font-semibold">Max stock</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                    <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
                        {/* Summary row */}
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total</p>
                                <p className="text-xl font-black text-slate-900">₹{totalAmount.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] font-semibold text-slate-500">{totalItems} item{totalItems > 1 ? 's' : ''}</p>
                                <p className="text-xs text-slate-400">across {items.length} product{items.length > 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Overwrite confirmation panel */}
                        {confirmOverwrite ? (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                                <p className="text-xs font-bold text-amber-800 mb-0.5">Replace existing sale items?</p>
                                <p className="text-[11px] text-amber-700 mb-3">
                                    The Sale tab already has items. Checking out will replace them with your basket.
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setConfirmOverwrite(false)}
                                        className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmCheckout}
                                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all active:scale-95"
                                        style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}
                                    >
                                        Yes, Replace & Checkout
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Checkout button */}
                                <button
                                    type="button"
                                    onClick={handleCheckoutClick}
                                    className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm text-white transition-all duration-150 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
                                    style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)' }}
                                >
                                    Proceed to Checkout
                                    <ArrowRightIcon />
                                </button>
                                <p className="text-center text-[10px] text-slate-400 mt-2">
                                    You'll complete payment on the Sale tab
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @keyframes slide-up {
                    from { transform: translateY(24px); opacity: 0; }
                    to   { transform: translateY(0);    opacity: 1; }
                }
                .animate-slide-up { animation: slide-up 0.22s ease-out both; }
            `}</style>
        </div>
    );
}
