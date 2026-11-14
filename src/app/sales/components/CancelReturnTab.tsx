import React from 'react';
import { apiClient } from '@/lib/api';
import { recordRecent, currentUsername } from '../helpers/recentSold';
import { PriceTag } from '../helpers/priceDisplay';

const SearchIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <circle cx="11" cy="11" r="8" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
    </svg>
);

const SpinnerIcon = () => (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
);

const CheckCircleIcon = () => (
    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const BanIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.93 4.93l14.14 14.14" />
    </svg>
);

const ReturnIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
);

/* Floating-label wrapper */
function FloatInput({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="relative w-full transition-all duration-200 rounded-xl border border-slate-200 hover:border-slate-400 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-400/15">
            <span className="absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-500 pointer-events-none select-none z-10">
                {label}
            </span>
            {children}
        </div>
    );
}

const inputCls = "w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300";

export function CancelReturnTab({
    cancelOrderNo, setCancelOrderNo,
    cancelInvoiceNo, setCancelInvoiceNo,
    cancelLookupResult, setCancelLookupResult,
    cancelLookupLoading, setCancelLookupLoading,
    cancelLookupError, setCancelLookupError,
    cancelAction, setCancelAction,
    cancelReason, setCancelReason,
    cancelSubmitting, setCancelSubmitting,
    cancelSuccess, setCancelSuccess,
    returnQtys, setReturnQtys,
    triggerAutoLookup, setTriggerAutoLookup,
    isFullscreen
}: any) {
    // Bug C fix: auto-select RETURN when a PARTIALLY_RETURNED order is looked up.
    // Cancel is not allowed on partially-returned orders (would double-refund returned items).
    // setCancelAction is a stable useState setter from the parent — safe to include in deps.
    // Orders with any online payment component (ONLINE/UPI/CARD/BOTH...) cannot be cancelled —
    // that money is not in the drawer. The backend rejects it too; use Return instead.
    const paymentInfo = cancelLookupResult?.paymentDetails;
    const paidOnline =
        Number(paymentInfo?.onlineAmount ?? 0) > 0 &&
        (paymentInfo?.paymentStatus ?? 'SUCCESS') === 'SUCCESS';

    // Return rules (the backend enforces the same rules):
    //  1. Orders paid online cannot be cancelled.
    //  2. Orders paid online: refunds come out of cash, so the refund must not exceed the net cash
    //     paid (cash paid minus earlier refunds).
    //  3. Any order: at most (total items - 1) can be returned; returning all = cancel.
    const cashPaid = Number(paymentInfo?.cashAmount ?? 0);
    const returnItemsList: any[] = cancelLookupResult?.items || [];
    const returnRefundTotal = returnItemsList.reduce((sum: number, item: any, idx: number) => {
        const qty = returnQtys?.[idx.toString()] ?? 0;
        return sum + qty * (item.unitPrice ?? item.sellingPrice ?? 0);
    }, 0);
    // Earlier refunds on this order = returned qty x unit price (billing items keep the original qty).
    const alreadyRefunded = returnItemsList.reduce(
        (sum: number, item: any) => sum + (item.returnedQuantity ?? 0) * (item.unitPrice ?? item.sellingPrice ?? 0), 0);
    const netCashAvailable = Math.max(0, cashPaid - alreadyRefunded);
    // A return must leave at least one unit: max returnable = total remaining - 1.
    // Returning everything is a cancellation.
    const totalRemainingQty = returnItemsList.reduce(
        (sum: number, item: any) => sum + Math.max(0, (item.quantity ?? 0) - (item.returnedQuantity ?? 0)), 0);
    const maxTotalReturn = Math.max(0, totalRemainingQty - 1);
    const totalSelectedQty = returnItemsList.reduce(
        (sum: number, _item: any, idx: number) => sum + (returnQtys?.[idx.toString()] ?? 0), 0);
    let returnBlockedReason = '';
    if (cancelAction === 'RETURN') {
        if (totalSelectedQty > maxTotalReturn) {
            returnBlockedReason = 'All items cannot be returned. Cancel the order instead.';
        } else if (paidOnline && returnRefundTotal > netCashAvailable) {
            returnBlockedReason = `Refund (₹${returnRefundTotal.toFixed(2)}) cannot exceed the net cash paid (₹${netCashAvailable.toFixed(2)}). Online payments are not refunded.`;
        }
    }

    React.useEffect(() => {
        if (cancelLookupResult?.status === 'PARTIALLY_RETURNED' || paidOnline) {
            setCancelAction('RETURN');
        }
    }, [cancelLookupResult?.status, paidOnline, setCancelAction]);

    const handleLookup = async () => {
        setCancelLookupLoading(true);
        setCancelLookupError('');
        setCancelLookupResult(null);
        setCancelSuccess('');
        try {
            const query = cancelOrderNo || cancelInvoiceNo;
            // FIX: use /search endpoint so backend filters in SQL (not the list endpoint
            // which ignores params and returns all invoices for the event).
            const res = await apiClient.get(`/billing/invoices/search?searchTerm=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                // Search endpoint returns a filtered array; guard against wrapped responses.
                const list = Array.isArray(data) ? data : (data.data || []);
                // Match the exact record: order number takes priority, invoice number as fallback.
                const match = list.find((b: any) =>
                    (cancelOrderNo && (b.salesOrderNumber === cancelOrderNo || b.orderNumber === cancelOrderNo)) ||
                    (cancelInvoiceNo && (b.invoiceNo === cancelInvoiceNo || b.invoiceId === cancelInvoiceNo))
                );
                if (match) {
                    const orderNo = match.salesOrderNumber || match.orderNumber;
                    if (orderNo) {
                        // FIX: fetch items and payment in parallel — both services cold-start
                        // simultaneously instead of sequentially stacking the delays.
                        const [itemsRes, paymentRes] = await Promise.all([
                            apiClient.get(`/billing/invoices/order/${orderNo}/items`).catch(err => { console.error('Error fetching items:', err); return null; }),
                            apiClient.get(`/sales/retail/${orderNo}/payment`).catch(err => { console.error('Error fetching payment:', err); return null; }),
                        ]);
                        if (itemsRes?.ok) {
                            const itemsData = await itemsRes.json();
                            match.items = Array.isArray(itemsData) ? itemsData : (itemsData.data || itemsData || []);
                        }
                        if (paymentRes?.ok) {
                            match.paymentDetails = await paymentRes.json();
                        }
                    }
                    setCancelLookupResult(match);
                    const items: any[] = match.items || [];
                    const defaultQtys: Record<string, number> = {};
                    items.forEach((it: any, idx: number) => {
                        defaultQtys[idx.toString()] = 0;
                    });
                    setReturnQtys(defaultQtys);
                } else {
                    setCancelLookupError('No matching bill found. Check the order or invoice number.');
                }
            } else {
                setCancelLookupError('Failed to fetch bill. Please try again.');
            }
        } catch {
            setCancelLookupError('Network error. Please try again.');
        } finally {
            setCancelLookupLoading(false);
        }
    };

    // Deep-link auto-lookup: when arriving from Billing page's Edit action, the
    // parent's URL Query Interceptor pre-fills cancelOrderNo/cancelInvoiceNo and
    // flips triggerAutoLookup — fire the lookup here instead of waiting for the
    // user to click "Look Up Bill" themselves, then reset the flag so it doesn't
    // re-fire on unrelated re-renders.
    React.useEffect(() => {
        if (triggerAutoLookup) {
            handleLookup();
            setTriggerAutoLookup(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [triggerAutoLookup]);

    const handleSubmit = async () => {
        if (returnBlockedReason) {
            setCancelLookupError(returnBlockedReason);
            return;
        }
        if (cancelAction === 'CANCEL' && paidOnline) {
            setCancelLookupError('Cannot cancel an order paid online. Use Return instead.');
            return;
        }
        setCancelSubmitting(true);
        setCancelSuccess('');
        try {
            const orderNo = cancelLookupResult.salesOrderNumber || cancelLookupResult.orderNumber;
            let endpoint: string;
            let body: any = null;
            if (cancelAction === 'CANCEL') {
                endpoint = `/sales/retail/${orderNo}/cancel?reason=${encodeURIComponent(cancelReason)}`;
                body = {};
            } else {
                endpoint = `/sales/retail/${orderNo}/return`;
                const returnItems = (cancelLookupResult.items || []).reduce((acc: any[], item: any, idx: number) => {
                    const qty = returnQtys[idx.toString()] ?? 0;
                    if (qty > 0) acc.push({ productId: item.productId, quantity: qty });
                    return acc;
                }, []);
                body = { reason: cancelReason, items: returnItems };
            }
            const res = await apiClient.put(endpoint, body);
            if (res.ok) {
                // Take the units off MY "Recent" counts (only for bills I sold myself).
                try {
                    const bill = cancelLookupResult;
                    if (bill.shopId != null && String(bill.sellerName || '').toLowerCase() === currentUsername()) {
                        const removed: Record<string, number> = {};
                        (bill.items || []).forEach((it: any, idx: number) => {
                            const q = cancelAction === 'CANCEL'
                                ? Math.max(0, (it.quantity ?? 0) - (it.returnedQuantity ?? 0))
                                : (returnQtys[idx.toString()] ?? 0);
                            if (it.productId != null && q > 0) removed[String(it.productId)] = (removed[String(it.productId)] ?? 0) - q;
                        });
                        void recordRecent(bill.shopId, removed);
                    }
                } catch { /* never block the cancel/return */ }
                // Bug D fix: compare return qty against REMAINING (not total) qty per item.
                // An item is partially returned if the user returned fewer than the remaining qty.
                const isPartial = cancelAction === 'RETURN' &&
                    (cancelLookupResult.items || []).some((it: any, idx: number) => {
                        const remaining = Math.max(0, (it.quantity ?? 0) - (it.returnedQuantity ?? 0));
                        return (returnQtys[idx.toString()] ?? 0) < remaining;
                    });
                const finalStatus = cancelAction === 'CANCEL'
                    ? 'CANCELLED'
                    : isPartial ? 'PARTIALLY_RETURNED'
                    : 'RETURNED';
                setCancelSuccess(
                    cancelAction === 'CANCEL' ? 'Order successfully cancelled.'
                        : isPartial ? 'Partial return processed successfully.'
                            : 'Full return processed successfully.'
                );
                setCancelLookupResult((prev: any) => ({
                    ...prev,
                    status: finalStatus,
                    // Update returnedQuantity on each item so remaining qty recalculates correctly
                    // for any further returns in the same session (Bug D fix).
                    items: cancelAction === 'RETURN'
                        ? (prev.items || []).map((item: any, idx: number) => ({
                            ...item,
                            returnedQuantity: (item.returnedQuantity ?? 0) + (returnQtys[idx.toString()] ?? 0)
                          }))
                        : prev.items
                }));
                setCancelReason('');
            } else {
                const err = await res.json().catch(() => ({}));
                setCancelLookupError(err.message || `Failed to ${cancelAction.toLowerCase()} order.`);
            }
        } catch (err) {
            console.error('Submission error:', err);
            setCancelLookupError('Network error. Please try again.');
        } finally {
            setCancelSubmitting(false);
        }
    };

    const statusColors: Record<string, string> = {
        PAID: 'bg-green-100 text-green-700 border-green-200',
        CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
        CANCELLED: 'bg-red-50 text-red-700 border-red-200',
        RETURNED: 'bg-orange-50 text-orange-700 border-orange-200',
        PARTIALLY_RETURNED: 'bg-amber-50 text-amber-700 border-amber-200',
    };

    return (
        <div className={`flex flex-col pr-1 ${isFullscreen ? 'pb-4' : 'pb-24 sm:pb-0'}`}>
            <div className="space-y-4">

                {/* Header */}
                <div className="flex items-center gap-2 px-1">
                    <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                        <ReturnIcon />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Cancel / Return Order</h3>
                        <p className="text-[10px] text-slate-400">Look up a bill to cancel or return</p>
                    </div>
                </div>

                {/* Search card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Look up an existing bill</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FloatInput label="Sales Order Number">
                            <input
                                type="text"
                                value={cancelOrderNo}
                                onChange={(e) => { setCancelOrderNo(e.target.value); setCancelLookupResult(null); setCancelLookupError(''); }}
                                placeholder="SO-01KQ0..."
                                className={inputCls}
                            />
                        </FloatInput>
                        <FloatInput label="Invoice Number">
                            <input
                                type="text"
                                value={cancelInvoiceNo}
                                onChange={(e) => { setCancelInvoiceNo(e.target.value); setCancelLookupResult(null); setCancelLookupError(''); }}
                                placeholder="UUID or invoice #"
                                className={inputCls}
                            />
                        </FloatInput>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={(!cancelOrderNo && !cancelInvoiceNo) || cancelLookupLoading}
                            onClick={handleLookup}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                        >
                            {cancelLookupLoading ? <SpinnerIcon /> : <SearchIcon />}
                            Look Up Bill
                        </button>
                        {cancelLookupError && (
                            <p className="text-xs text-red-600 font-semibold">{cancelLookupError}</p>
                        )}
                    </div>
                </div>

                {/* Result card */}
                {cancelLookupResult && (
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-10">

                        {/* Order metadata */}
                        <div className="p-4 border-b border-slate-100 space-y-3">

                            {/* Order # and Invoice # each on their own line */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 shrink-0">Order #</span>
                                    <span className="text-xs font-bold font-mono text-sky-700 break-all">{cancelLookupResult.salesOrderNumber || cancelLookupResult.orderNumber || '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20 shrink-0">Invoice #</span>
                                    <span className="text-xs font-semibold font-mono text-slate-700 break-all">{cancelLookupResult.invoiceNo || cancelLookupResult.invoiceId || '—'}</span>
                                </div>
                            </div>

                            {/* Secondary fields in grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-50">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Customer</p>
                                    <p className="text-xs font-semibold text-slate-700">{cancelLookupResult.customerName || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Mobile</p>
                                    <p className="text-xs font-semibold text-slate-700">{cancelLookupResult.customerMobile || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${statusColors[cancelLookupResult.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                        {cancelLookupResult.status || '—'}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Net Amount</p>
                                    <div className="flex items-center gap-1.5">
                                        <p className="font-bold text-sky-700 text-sm">
                                            ₹{((cancelLookupResult.items || []).reduce((sum: number, item: any) => {
                                                const remQty = Math.max(0, (item.quantity ?? 0) - (item.returnedQuantity ?? 0));
                                                const unitPrice = item.unitPrice ?? item.sellingPrice ?? item.mrp ?? 0;
                                                return sum + (remQty * unitPrice);
                                            }, 0)).toFixed(2)}
                                        </p>
                                        {((cancelLookupResult.items || []).reduce((sum: number, item: any) => {
                                            const remQty = Math.max(0, (item.quantity ?? 0) - (item.returnedQuantity ?? 0));
                                            const unitPrice = item.unitPrice ?? item.sellingPrice ?? item.mrp ?? 0;
                                            return sum + (remQty * unitPrice);
                                        }, 0)) < (cancelLookupResult.netAmount ?? cancelLookupResult.totalAmount ?? 0) && (
                                            <span className="text-xs text-slate-400 line-through">
                                                ₹{(cancelLookupResult.netAmount ?? cancelLookupResult.totalAmount ?? 0).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Items table */}
                        <div className="p-4 border-b border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    {cancelAction === 'RETURN' ? 'Select Return Quantities' : 'Items in Order'}
                                </p>
                                {cancelAction === 'RETURN' && (
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        At most {maxTotalReturn} of {totalRemainingQty} items can be returned. To return everything, cancel the order.
                                    </p>
                                )}
                                </div>
                                {cancelAction === 'RETURN' && (
                                    <div className="flex gap-2">
                                        <button type="button"
                                            onClick={() => {
                                                const all: Record<string, number> = {};
                                                let budget = maxTotalReturn;
                                                (cancelLookupResult.items || []).forEach((it: any, idx: number) => {
                                                    const rem = Math.max(0, (it.quantity ?? 0) - (it.returnedQuantity ?? 0));
                                                    const take = Math.min(rem, budget);
                                                    all[idx.toString()] = take;
                                                    budget -= take;
                                                });
                                                setReturnQtys(all);
                                            }}
                                            className="text-[10px] px-2.5 py-1 rounded-lg border border-sky-200 text-sky-600 hover:bg-sky-50 font-bold transition-all">
                                            Select All
                                        </button>
                                        <button type="button"
                                            onClick={() => {
                                                const none: Record<string, number> = {};
                                                (cancelLookupResult.items || []).forEach((it: any, idx: number) => { none[idx.toString()] = 0; });
                                                setReturnQtys(none);
                                            }}
                                            className="text-[10px] px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold transition-all">
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* overflow-hidden prevents the inner scroll container from
                                causing a double-scrollbar in the parent. If you ever add
                                an absolute-positioned dropdown or tooltip inside this table,
                                remove overflow-hidden from this outer div — it will clip those. */}
                            {(cancelLookupResult.items && cancelLookupResult.items.length > 0) ? (
                                <div className="w-full overflow-hidden">
                                <div className="border border-slate-100 rounded-xl overflow-x-auto">
                                    <table className="w-full min-w-[560px] text-sm">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100">
                                                <th className="p-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Product</th>
                                                <th className="p-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">Billed Qty</th>
                                                <th className="p-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ret.</th>
                                                <th className="p-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Price</th>
                                                <th className="p-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</th>
                                                {cancelAction === 'RETURN' && (
                                                    <th className="p-3 text-center text-[10px] font-bold text-red-500 uppercase tracking-wider">Return Qty</th>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {cancelLookupResult.items.map((item: any, idx: number) => {
                                                const originalQty = item.quantity ?? 0;
                                                const alreadyReturnedQty = item.returnedQuantity ?? 0;
                                                const remainingQty = Math.max(0, originalQty - alreadyReturnedQty);
                                                const returnQty = returnQtys[idx.toString()] ?? 0;
                                                const unitPrice = item.unitPrice ?? item.sellingPrice ?? item.mrp ?? 0;
                                                return (
                                                    <tr key={idx} className={`transition-colors ${cancelAction === 'RETURN' && returnQty > 0 ? 'bg-red-50/30' : 'hover:bg-slate-50/50'}`}>
                                                        <td className="p-3">
                                                            <p className="font-semibold text-slate-800 text-xs sm:text-sm">{item.productName || `Product #${item.productId}`}</p>
                                                            {item.hsnCode && <p className="text-[10px] text-slate-400 mt-0.5">HSN: {item.hsnCode}</p>}
                                                        </td>
                                                        <td className="p-3 text-center font-semibold text-slate-700">{originalQty}</td>
                                                        <td className="p-3 text-center text-xs text-orange-500 font-bold">{alreadyReturnedQty > 0 ? alreadyReturnedQty : '—'}</td>
                                                        <td className="p-3 text-right">
                                                            <div className="flex justify-end">
                                                                <PriceTag mrp={item.mrp} sellingPrice={unitPrice} size="sm" priceClassName="text-slate-500 font-normal" />
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <p className="font-semibold text-slate-800">₹{(remainingQty * unitPrice).toFixed(2)}</p>
                                                            {alreadyReturnedQty > 0 && (
                                                                <p className="text-[10px] text-slate-400 line-through">₹{(originalQty * unitPrice).toFixed(2)}</p>
                                                            )}
                                                        </td>
                                                        {cancelAction === 'RETURN' && (
                                                            <td className="p-3 text-center">
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={remainingQty}
                                                                    value={returnQty}
                                                                    onChange={(e) => {
                                                                        const othersQty = totalSelectedQty - returnQty;
                                                                        const val = Math.min(
                                                                            remainingQty,
                                                                            Math.max(0, maxTotalReturn - othersQty),
                                                                            Math.max(0, parseInt(e.target.value) || 0));
                                                                        setReturnQtys((prev: any) => ({ ...prev, [idx.toString()]: val }));
                                                                    }}
                                                                    disabled={remainingQty <= 0}
                                                                    className={`w-16 px-2 py-1.5 border rounded-lg text-center text-sm font-bold focus:ring-2 focus:ring-red-400 outline-none transition-all
                                                                        ${remainingQty <= 0 ? 'bg-slate-100 text-slate-400 border-slate-200' : 'border-red-200 focus:border-red-400'}`}
                                                                />
                                                                {remainingQty <= 0 && <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Returned</p>}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-50 border-t border-slate-100">
                                            <tr>
                                                <td colSpan={4} className="p-3 text-right text-xs font-bold text-slate-500 uppercase">
                                                    {cancelAction === 'RETURN' ? 'Net Refund' : 'Order Total'}
                                                </td>
                                                <td className="p-3 text-right font-black text-sky-700">
                                                    ₹{cancelAction === 'RETURN'
                                                        ? (cancelLookupResult.items || []).reduce((sum: number, item: any, idx: number) => {
                                                            const qty = returnQtys[idx.toString()] ?? 0;
                                                            return sum + (qty * (item.unitPrice ?? item.sellingPrice ?? 0));
                                                        }, 0).toFixed(2)
                                                        : (cancelLookupResult.items || []).reduce((sum: number, item: any) => {
                                                            const remQty = (item.quantity ?? 0) - (item.returnedQuantity ?? 0);
                                                            return sum + (remQty * (item.unitPrice ?? item.sellingPrice ?? 0));
                                                        }, 0).toFixed(2)
                                                    }
                                                </td>
                                                {cancelAction === 'RETURN' && <td />}
                                            </tr>
                                            {cancelLookupResult.paymentDetails && (
                                                <>
                                                    <tr className="border-t border-slate-100/50">
                                                        <td colSpan={4} className="p-3 text-right text-xs font-bold text-slate-500 uppercase">Cash</td>
                                                        <td className="p-3 text-right font-bold text-emerald-600 text-xs font-mono">₹{Number(cancelLookupResult.paymentDetails.cashAmount ?? 0).toFixed(2)}</td>
                                                        {cancelAction === 'RETURN' && <td />}
                                                    </tr>
                                                    <tr className="border-t border-slate-100/50">
                                                        <td colSpan={4} className="p-3 text-right text-xs font-bold text-slate-500 uppercase">Online</td>
                                                        <td className="p-3 text-right font-bold text-blue-600 text-xs font-mono">₹{Number(cancelLookupResult.paymentDetails.onlineAmount ?? 0).toFixed(2)}</td>
                                                        {cancelAction === 'RETURN' && <td />}
                                                    </tr>
                                                    <tr className="border-t border-slate-100">
                                                        <td colSpan={4} className="p-3 text-right text-xs font-bold text-slate-700 uppercase">Total Paid</td>
                                                        <td className="p-3 text-right font-extrabold text-sky-800 text-xs font-mono">₹{Number(cancelLookupResult.paymentDetails.amount ?? 0).toFixed(2)}</td>
                                                        {cancelAction === 'RETURN' && <td />}
                                                    </tr>
                                                </>
                                            )}
                                        </tfoot>
                                    </table>
                                </div>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic py-2">No item details available for this bill.</p>
                            )}
                        </div>

                        {/* Action section */}
                        <div className="p-4 space-y-4">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Action</p>
                                {/* Bug C fix: CANCEL is disabled for PARTIALLY_RETURNED orders.
                                    Allowing cancel on a partially-returned order would double-refund
                                    items that were already returned. RETURN stays available. */}
                                <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => setCancelAction('CANCEL')}
                                        disabled={
                                            cancelLookupResult.status === 'CANCELLED' ||
                                            cancelLookupResult.status === 'RETURNED' ||
                                            cancelLookupResult.status === 'PARTIALLY_RETURNED' ||
                                            paidOnline
                                        }
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150
                                            ${cancelAction === 'CANCEL'
                                                ? 'bg-white text-red-700 shadow-sm border border-red-200'
                                                : 'text-slate-500 hover:text-slate-700 border border-transparent'
                                            }
                                            disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                        <BanIcon />
                                        Cancel Order
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setCancelAction('RETURN')}
                                        disabled={
                                            cancelLookupResult.status === 'CANCELLED' ||
                                            cancelLookupResult.status === 'RETURNED'
                                        }
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-150
                                            ${cancelAction === 'RETURN'
                                                ? 'bg-white text-red-700 shadow-sm border border-red-200'
                                                : 'text-slate-500 hover:text-slate-700 border border-transparent'
                                            }
                                            disabled:opacity-40 disabled:cursor-not-allowed`}
                                    >
                                        <ReturnIcon />
                                        Return Order
                                    </button>
                                </div>
                                {cancelLookupResult.status === 'PARTIALLY_RETURNED' && (
                                    <p className="text-[10px] text-amber-600 font-semibold mt-1.5">
                                        This order is partially returned — Cancel is disabled. Use Return to return remaining items.
                                    </p>
                                )}
                                {paidOnline && cancelLookupResult.status !== 'PARTIALLY_RETURNED' && (
                                    <p className="text-[10px] text-amber-600 font-semibold mt-1.5">
                                        This order was paid online — Cancel is disabled. Use Return instead.
                                    </p>
                                )}
                                {cancelLookupResult.status !== 'PARTIALLY_RETURNED' && !paidOnline && (
                                    <p className="text-[10px] text-slate-400 mt-1.5">
                                        {cancelAction === 'CANCEL'
                                            ? 'Marks the full order as cancelled. Use when the sale never happened.'
                                            : 'Return some or all items. Adjust quantities per item in the table above.'}
                                    </p>
                                )}
                            </div>

                            {returnBlockedReason && (
                                <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl p-3">
                                    {returnBlockedReason}
                                </p>
                            )}

                            <div className="relative w-full transition-all duration-200 rounded-xl border border-slate-200 hover:border-slate-400 focus-within:border-red-400 focus-within:ring-2 focus-within:ring-red-400/15">
                                <span className="absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-500 pointer-events-none select-none z-10">
                                    Reason <span className="text-red-500">*</span>
                                </span>
                                <textarea
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                    placeholder="Enter reason for cancellation or return..."
                                    rows={2}
                                    className="w-full px-4 pt-3 pb-3 rounded-xl text-sm font-semibold text-slate-800 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder-slate-300 resize-none"
                                />
                            </div>

                            {cancelSuccess && (
                                <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                                    <CheckCircleIcon />
                                    <p className="text-sm font-semibold text-emerald-700">{cancelSuccess}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setCancelLookupResult(null); setCancelOrderNo(''); setCancelInvoiceNo(''); setCancelReason(''); setCancelSuccess(''); setReturnQtys({}); }}
                                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Clear
                                </button>
                                <button
                                    type="button"
                                    disabled={
                                        !cancelReason.trim() || cancelSubmitting ||
                                        cancelLookupResult.status === 'CANCELLED' ||
                                        cancelLookupResult.status === 'RETURNED' ||
                                        // Bug C fix: block Cancel action for PARTIALLY_RETURNED orders
                                        (cancelAction === 'CANCEL' && cancelLookupResult.status === 'PARTIALLY_RETURNED') ||
                                        (cancelAction === 'RETURN' && Object.values(returnQtys).every(q => q === 0)) ||
                                        !!returnBlockedReason
                                    }
                                    onClick={handleSubmit}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95"
                                >
                                    {cancelSubmitting && <SpinnerIcon />}
                                    Confirm {cancelAction === 'CANCEL' ? 'Cancellation' : 'Return'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
