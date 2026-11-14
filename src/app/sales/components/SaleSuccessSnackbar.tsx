import React, { useEffect, useState } from 'react';

interface SaleSuccessSnackbarProps {
    visible: boolean;
    message: string;
    onViewReceipt: () => void;
    onDismiss: () => void;
}

const CheckIcon = () => (
    <svg className="w-5 h-5 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

/**
 * Lightweight, auto-dismissing confirmation for "Pay & Print" — printing already
 * happened as part of that action, so a full modal asking the cashier to
 * acknowledge it again is redundant. Fades out on its own after 5s; the "View"
 * button lets them open the full receipt/success modal on demand (e.g. to reprint).
 *
 * The plain "Checkout" (pay-only, no print) flow does NOT use this — it still
 * always shows the full FeedbackModals success modal, since nothing has happened
 * yet that the cashier needs no further confirmation of.
 */
export function SaleSuccessSnackbar({ visible, message, onViewReceipt, onDismiss }: SaleSuccessSnackbarProps) {
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (!visible) { setClosing(false); return; }
        setClosing(false);
        // Start the fade slightly before removal so the opacity transition is visible
        // rather than the snackbar just vanishing at the 5s mark.
        const fadeTimer = setTimeout(() => setClosing(true), 4700);
        const removeTimer = setTimeout(() => onDismiss(), 5000);
        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(removeTimer);
        };
    }, [visible, onDismiss]);

    if (!visible) return null;

    return (
        <div
            className={`fixed top-6 right-6 z-50 transition-opacity duration-300 ${closing ? 'opacity-0' : 'opacity-100 animate-fade-in-up'}`}
        >
            <div className="flex items-center gap-3 bg-emerald-600 shadow-xl rounded-xl pl-4 pr-3 py-3 max-w-xs">
                <CheckIcon />
                <p className="text-sm font-semibold text-white flex-1 leading-snug">{message}</p>
                <button
                    type="button"
                    onClick={onViewReceipt}
                    className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-white/70"
                >
                    View
                </button>
            </div>
        </div>
    );
}
