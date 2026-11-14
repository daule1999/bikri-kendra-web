import React from 'react';
import { isAndroidDevice, isSmsEnabledForCurrentUser } from '@/lib/smsUtils';

interface PaymentSectionProps {
    saleData: any;
    setSaleData: React.Dispatch<React.SetStateAction<any>>;
    paymentExpanded: boolean;
    setPaymentExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    calculateTotal: () => string;
    calculateChange: () => string;
    isPaymentValid: boolean;
    isSubmitting: boolean;
    hasNoValidItems: boolean;
    onPay: () => void;
    onPayAndPrint: () => void;
    onPayAndSms: () => void;
    onPreviewClick: () => void;
    isMobile: boolean;
    onPrintKeyDown?: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
    onCashReceivedKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onOnlineRefKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onBothOnlineRefKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const Icon = {
    // Double chevron — points UP by default (payment panel collapsed, tap to pull it
    // open upward — standard bottom-sheet handle convention), rotates 180° to point DOWN
    // when `collapsed` is true (i.e. panel expanded, tap to push it back down/closed).
    // Same double-chevron style as the app sidebar's collapse toggle, just rotated for a
    // vertical (up/down) affordance instead of horizontal.
    Chevron: ({ collapsed }: { collapsed: boolean }) => (
        <svg className={`w-3 h-3 transition-transform duration-300 ${!collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4.5 5.25l7.5 7.5 7.5-7.5m-15 6l7.5 7.5 7.5-7.5" />
        </svg>
    )
};

/* ── Inline SVG icons ─────────────────────────────────────────── */
const EyeIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
);

const CheckIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
);

const PrintIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
    </svg>
);

const SmsIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.208 0-2.360-.214-3.410-.603L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

const SpinnerIcon = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

/* ── Floating-label input wrapper ─────────────────────────────── */
function FloatInput({
    label, required, children
}: { label: string; required?: boolean; children: React.ReactNode }) {
    return (
        <div className="relative w-full transition-all duration-200 bg-transparent rounded-xl border border-slate-200 hover:border-slate-400 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15">
            <span className="absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-500 pointer-events-none select-none z-10">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {children}
        </div>
    );
}

function FloatInputWarning({
    label, required, hasWarning, children
}: { label: string; required?: boolean; hasWarning: boolean; children: React.ReactNode }) {
    return (
        <div className={`relative w-full transition-all duration-200 bg-transparent rounded-xl border hover:border-slate-400
            ${hasWarning
                ? 'border-amber-300 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20'
                : 'border-slate-200 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/15'
            }`}>
            <span className={`absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 pointer-events-none select-none z-10
                ${hasWarning ? 'text-amber-500' : 'text-slate-500'}`}>
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {children}
        </div>
    );
}

const inputCls = "w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300";
const readonlyCls = "w-full px-4 py-2.5 rounded-xl text-sm font-bold text-slate-400 bg-transparent border-0 focus:outline-none cursor-not-allowed select-none";

export function PaymentSection({
    saleData, setSaleData, paymentExpanded, setPaymentExpanded, calculateTotal, calculateChange,
    isPaymentValid, isSubmitting, hasNoValidItems, onPay, onPayAndPrint, onPayAndSms,
    onPreviewClick, isMobile,
    onPrintKeyDown, onCashReceivedKeyDown, onOnlineRefKeyDown, onBothOnlineRefKeyDown,
}: PaymentSectionProps) {
    // Android-only for now — the sms: link format used isn't verified on iOS yet,
    // and there's no SMS app to hand off to on desktop/web. Additionally gated to
    // usernames containing "daule" while the SMS flow is being trialled.
    const showSmsAction = isAndroidDevice() && isSmsEnabledForCurrentUser();

    const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        const target = e.target;
        setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 300);
    };

    const handleModeKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, mode: 'CASH' | 'ONLINE' | 'BOTH') => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setSaleData((prev: any) => ({
                ...prev,
                paymentMode: mode,
                ...(mode === 'ONLINE' ? { onlineAmount: calculateTotal() } : {}),
                ...(mode === 'CASH' ? { cashReceived: calculateTotal() } : {}),
            }));
            setPaymentExpanded(true);
            setTimeout(() => {
                const firstPayInput = document.querySelector<HTMLInputElement>('input[data-payment-first="true"]');
                if (firstPayInput) firstPayInput.focus();
            }, 80);
        }
        if (e.key === 'Tab' && !e.shiftKey && mode === 'BOTH') {
            e.preventDefault();
            setPaymentExpanded(true);
            setTimeout(() => {
                const firstPayInput = document.querySelector<HTMLInputElement>('input[data-payment-first="true"]');
                if (firstPayInput) firstPayInput.focus();
            }, 30);
        }
    };

    const modes = ['CASH', 'ONLINE', 'BOTH'] as const;
    // Overselling past counter stock is intentionally allowed (server-side capped by
    // warehouse reserve) — hasStockOverdraft no longer blocks checkout.
    const isActionDisabled = !isPaymentValid || hasNoValidItems;
    const isSubmitDisabled = isActionDisabled || isSubmitting;

    return (
        // Half width while collapsed, full width once expanded (sm+ only — stays full width
        // on mobile so the collapsed bar is still easy to tap). Hugs the right edge via
        // ml-auto so it lines up under the floating toggle tab and the right-aligned Total.
        // Collapsed also gets a little breathing room (pb/pr) so the rounded card below
        // reads as a floating pill rather than touching the screen edges; expanded drops
        // that padding and goes back to the flush, edge-to-edge sticky-footer look.
        <div className={`sticky bottom-0 z-30 ml-auto transition-all duration-300 ease-in-out ${paymentExpanded ? 'w-full' : 'w-full sm:w-1/2 pb-3 pr-1'
            }`}>

            {/* Floating collapse/expand tab — pinned to the top-right EDGE of the panel,
                poking half outside its top border, same corner-tab pattern as the app
                sidebar's collapse toggle (components/layout/Sidebar.tsx). Lives outside the
                inner overflow-y-auto box below so it never gets clipped by that scroll box. */}
            <button
                type="button"
                tabIndex={-1}
                onClick={() => setPaymentExpanded(!paymentExpanded)}
                title={paymentExpanded ? 'Minimise payment panel' : 'Show payment mode & fields'}
                className="absolute -top-4 right-3 z-40 w-8 h-8 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:scale-110 transition-all"
            >
                <Icon.Chevron collapsed={paymentExpanded} />
            </button>

            {/* Expanded keeps the original flush, edge-to-edge sticky-footer styling exactly
                as before (border-t + soft top shadow, square corners). Collapsed switches to
                a modern floating rounded card — full border, elevated shadow, rounded-2xl —
                and both states animate smoothly between each other via transition-all. */}
            <div className={`bg-white p-3 sm:p-3 max-h-[75vh] overflow-y-auto overflow-x-hidden transition-all duration-300 ease-in-out ${paymentExpanded
                ? 'border-t border-slate-100 sm:border-t shadow-[0_-6px_20px_rgba(0,0,0,0.06)] rounded-none'
                : 'border border-slate-200 shadow-xl rounded-2xl'
                }`}>

                {/* Total — ALWAYS VISIBLE (mobile + desktop), right-aligned. The expand/collapse
                toggle now lives in the floating corner tab above, not in this row.
                Nested `sticky top-0` here (relative to the overflow-y-auto box above) keeps
                this pinned to the TOP of the panel even when the expanded content below is
                tall enough to need its own internal scroll — otherwise, since the outer box
                is anchored by its bottom edge, a tall expanded panel pushes this topmost row
                above the visible viewport and it disappears. */}
                <div className="flex items-center justify-end -mx-3 px-3 pt-1 pb-0 sticky top-0 z-10 bg-white">
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</p>
                        <p className="text-xl sm:text-2xl font-black text-sky-700">₹{calculateTotal()}</p>
                    </div>
                </div>

                {/* ── Maximised-only content: payment mode selector + mode-specific fields ── */}
                {paymentExpanded && (
                    <div className="space-y-3 pb-2 animate-fade-in">

                        {/* Payment mode segmented control */}
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Mode</p>
                            {/* Segmented control */}
                            {/* overflow-hidden removed — it clips box-shadow focus rings on child buttons */}
                            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
                                {modes.map((mode, i) => (
                                    <button
                                        key={mode}
                                        type="button"
                                        tabIndex={51 + i}
                                        onClick={() => {
                                            setSaleData((prev: any) => ({
                                                ...prev,
                                                paymentMode: mode,
                                                ...(mode === 'ONLINE' ? { onlineAmount: calculateTotal() } : {}),
                                                // Pre-fill cash received with total so the cashier rarely
                                                // needs to type anything (90 % of sales are exact cash)
                                                ...(mode === 'CASH' ? { cashReceived: calculateTotal() } : {}),
                                            }));
                                            setPaymentExpanded(true);
                                        }}
                                        onKeyDown={(e) => handleModeKeyDown(e, mode)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all duration-150
                                    focus:outline-none focus:ring-2 focus:ring-sky-500
                                    ${saleData.paymentMode === mode
                                                ? 'bg-white text-sky-700 shadow-sm border border-sky-200'
                                                : 'text-slate-500 hover:text-slate-700 border border-transparent'
                                            }`}
                                    >
                                        {mode}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Payment input fields ── */}
                        <div className="space-y-3">

                            {/* CASH */}
                            {saleData.paymentMode === 'CASH' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <FloatInput label="Cash Received">
                                        <input
                                            type="number" step="0.01" min="0"
                                            value={saleData.cashReceived}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val !== '' && parseFloat(val) < 0) return;
                                                setSaleData((prev: any) => ({ ...prev, cashReceived: val }));
                                                setPaymentExpanded(true);
                                            }}
                                            onFocus={handleInputFocus}
                                            onKeyDown={onCashReceivedKeyDown}
                                            className={inputCls}
                                            placeholder="0.00"
                                            tabIndex={54}
                                            data-payment-first="true"
                                        />
                                    </FloatInput>
                                    <div className="relative w-full rounded-xl border border-sky-100 bg-sky-50/60">
                                        <span className="absolute left-3 px-1 bg-sky-50 uppercase tracking-wider font-bold text-[10px] -top-2.5 text-sky-500 pointer-events-none select-none z-10">
                                            Change
                                        </span>
                                        <div className="w-full px-4 py-2.5 text-sm font-black text-sky-700">
                                            ₹{calculateChange()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ONLINE */}
                            {saleData.paymentMode === 'ONLINE' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="relative w-full rounded-xl border border-slate-100 bg-slate-50/80">
                                        <span className="absolute left-3 px-1 bg-slate-50 uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-400 pointer-events-none select-none z-10">
                                            Online Amount
                                        </span>
                                        <input
                                            type="number"
                                            value={calculateTotal()}
                                            className={readonlyCls}
                                            tabIndex={-1}
                                            readOnly
                                        />
                                    </div>
                                    <FloatInputWarning label="Reference (UTR/ID)" required hasWarning={!saleData.paymentReference?.trim()}>
                                        <input
                                            type="text"
                                            value={saleData.paymentReference}
                                            onChange={(e) => {
                                                setSaleData((prev: any) => ({ ...prev, paymentReference: e.target.value }));
                                                setPaymentExpanded(true);
                                            }}
                                            onFocus={handleInputFocus}
                                            onKeyDown={onOnlineRefKeyDown}
                                            className={inputCls}
                                            placeholder="e.g. UTR / Transaction ID"
                                            tabIndex={54}
                                            data-payment-first="true"
                                            required
                                        />
                                    </FloatInputWarning>
                                </div>
                            )}

                            {/* BOTH */}
                            {saleData.paymentMode === 'BOTH' && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <FloatInput label="Cash Amount">
                                            <input
                                                type="number" step="0.01" min="0"
                                                value={saleData.cashAmount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== '' && parseFloat(val) < 0) return;
                                                    setSaleData((prev: any) => ({ ...prev, cashAmount: val }));
                                                    setPaymentExpanded(true);
                                                }}
                                                onFocus={handleInputFocus}
                                                className={inputCls}
                                                placeholder="0.00"
                                                tabIndex={54}
                                                data-payment-first="true"
                                            />
                                        </FloatInput>
                                        <FloatInput label="Online Amount">
                                            <input
                                                type="number" step="0.01" min="0"
                                                value={saleData.onlineAmount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== '' && parseFloat(val) < 0) return;
                                                    setSaleData((prev: any) => ({ ...prev, onlineAmount: val }));
                                                    setPaymentExpanded(true);
                                                }}
                                                onFocus={handleInputFocus}
                                                className={inputCls}
                                                placeholder="0.00"
                                                tabIndex={55}
                                            />
                                        </FloatInput>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FloatInputWarning label="Online Ref" required hasWarning={!saleData.paymentReference?.trim()}>
                                            <input
                                                type="text"
                                                value={saleData.paymentReference}
                                                onChange={(e) => {
                                                    setSaleData((prev: any) => ({ ...prev, paymentReference: e.target.value }));
                                                    setPaymentExpanded(true);
                                                }}
                                                onFocus={handleInputFocus}
                                                onKeyDown={onBothOnlineRefKeyDown}
                                                className={inputCls}
                                                placeholder="UTR / Transaction ID"
                                                tabIndex={56}
                                                required
                                            />
                                        </FloatInputWarning>
                                        <div className="relative w-full rounded-xl border border-sky-100 bg-sky-50/60">
                                            <span className="absolute left-3 px-1 bg-sky-50 uppercase tracking-wider font-bold text-[10px] -top-2.5 text-sky-500 pointer-events-none select-none z-10">
                                                Change
                                            </span>
                                            <div className="w-full px-4 py-2.5 text-sm font-black text-sky-700">
                                                ₹{calculateChange()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Action Buttons — ALWAYS VISIBLE (Preview/Checkout/Print), even minimised.
                Send SMS only shows when maximised (and Android) since it's a secondary action.
                Also nested `sticky bottom-0` (same reasoning as the Total header above) so
                these stay pinned to the bottom of the panel even if the mode selector + fields
                in between need to scroll internally on a shorter screen.
                flex-wrap instead of a fixed grid-cols-N so this still lays out cleanly whether
                there are 3 buttons or 4 — a hardcoded column count would leave a lopsided last
                row on whichever device/state doesn't get the SMS button. */}
                <div className="flex flex-wrap gap-2 sm:justify-end sm:gap-3 -mx-3 px-3 pt-1 pb-1 sticky bottom-0 z-10 bg-white">

                    {/* Preview */}
                    <button
                        type="button"
                        disabled={isActionDisabled}
                        onClick={onPreviewClick}
                        tabIndex={60}
                        data-action="preview"
                        title="Alt+P to preview"
                        className="flex-1 sm:flex-none min-w-[5.5rem] flex items-center justify-center gap-1.5 px-3 sm:px-5 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs sm:text-sm font-bold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                        <EyeIcon />
                        <span>Preview</span>
                    </button>

                    {/* Checkout */}
                    <button
                        type="button"
                        disabled={isSubmitDisabled}
                        onClick={onPay}
                        tabIndex={61}
                        data-action="checkout"
                        title="Ctrl+S to submit"
                        className="flex-1 sm:flex-none min-w-[5.5rem] flex items-center justify-center gap-1.5 px-3 sm:px-6 h-10 rounded-xl bg-sky-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-sky-700 active:scale-95 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                        {isSubmitting ? <SpinnerIcon /> : <CheckIcon />}
                        <span>Checkout</span>
                    </button>

                    {/* Print — also triggered by Alt+Shift+Enter */}
                    <button
                        type="button"
                        disabled={isSubmitDisabled}
                        onClick={onPayAndPrint}
                        onKeyDown={onPrintKeyDown}
                        tabIndex={62}
                        data-action="print"
                        title="Pay & Print (Alt+Shift+Enter)"
                        className="flex-1 sm:flex-none min-w-[5.5rem] flex items-center justify-center gap-1.5 px-3 sm:px-5 h-10 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    >
                        {isSubmitting ? <SpinnerIcon /> : <PrintIcon />}
                        <span>Print</span>
                        <span className="hidden sm:inline text-[10px] opacity-60 font-normal ml-0.5">⌥⇧↵</span>
                    </button>

                    {/* Pay & SMS — Android only, and only when the panel is maximised */}
                    {paymentExpanded && showSmsAction && (
                        <button
                            type="button"
                            disabled={isSubmitDisabled}
                            onClick={onPayAndSms}
                            tabIndex={63}
                            data-action="sms"
                            title="Pay & Send SMS"
                            className="flex-1 sm:flex-none min-w-[5.5rem] flex items-center justify-center gap-1.5 px-3 sm:px-5 h-10 rounded-xl bg-violet-600 text-white text-xs sm:text-sm font-bold shadow-md hover:bg-violet-700 active:scale-95 transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                            {isSubmitting ? <SpinnerIcon /> : <SmsIcon />}
                            <span>SMS</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
