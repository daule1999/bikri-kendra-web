import React from 'react';
import { PriceTag } from '../helpers/priceDisplay';

interface SalePreviewModalProps {
    show: boolean;
    saleData: any;
    products: any[];
    assignedShops: any[];
    calculateTotal: () => string;
    calculateChange: () => string;
    isSubmitting: boolean;
    isPaymentValid: boolean;
    onClose: () => void;
    onSubmit: (printFlag: boolean) => void;
    isMobile: boolean
}

export function SalePreviewModal({
    show, saleData, products, assignedShops, calculateTotal, calculateChange, isMobile,
    isSubmitting, isPaymentValid, onClose, onSubmit
}: SalePreviewModalProps) {
    const processRef = React.useRef<HTMLButtonElement>(null);
    const confirmRef = React.useRef<HTMLButtonElement>(null);
    const editRef   = React.useRef<HTMLButtonElement>(null);

    // Focus the Process button when the modal opens.
    React.useEffect(() => {
        if (show) {
            // Small delay so the CSS animation doesn't fight the focus ring.
            const t = setTimeout(() => processRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [show]);

    // Tab trap: cycle Process → Confirm → Edit → Process (skip disabled buttons).
    // Shift+Tab reverses the cycle. Escape closes.
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { onClose(); return; }
        if (e.key !== 'Tab') return;
        e.preventDefault();

        // Ordered list; disabled buttons are excluded from cycle.
        const order = [processRef.current, confirmRef.current, editRef.current]
            .filter((btn): btn is HTMLButtonElement => !!btn && !btn.disabled);
        if (order.length === 0) return;

        const idx = order.findIndex(btn => btn === document.activeElement);
        const next = !e.shiftKey
            ? (idx + 1) % order.length
            : (idx - 1 + order.length) % order.length;
        order[next].focus();
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Sale Preview</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        title="Close preview and return to editing"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 sm:p-6 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-gray-500 font-medium">Customer:</span>
                                <p className="font-semibold">{saleData.customerName || 'N/A'} ({saleData.customerMobile || 'N/A'})</p>
                            </div>
                            <div className="text-right">
                                <span className="text-gray-500 font-medium">Shop:</span>
                                <p className="font-semibold">{assignedShops.find(s => s.id.toString() === saleData.shopId)?.shopName || 'N/A'}</p>
                            </div>
                        </div>

                        {/* overflow-x-auto handles both rounded-corner clipping and horizontal
                            scroll on phones narrower than min-w-[480px]. */}
                        <div className="border border-gray-200 rounded-lg overflow-x-auto">
                            <table className="w-full min-w-[480px] text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="p-3 text-left font-semibold text-gray-600">Product</th>
                                        <th className="p-3 text-center font-semibold text-gray-600">Qty</th>
                                        <th className="p-3 text-right font-semibold text-gray-600">Price</th>
                                        <th className="p-3 text-right font-semibold text-gray-600">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {saleData.items.filter((i: any) => i.productId && parseInt(i.quantity) > 0).map((item: any, idx: number) => {
                                        const product = products.find(p => p.id.toString() === item.productId);
                                        const qty = parseInt(item.quantity) || 0;
                                        const price = parseFloat(item.sellingPrice) || 0;
                                        return (
                                            <tr key={idx}>
                                                <td className="p-3">{product?.name || item.productName}</td>
                                                <td className="p-3 text-center">{qty}</td>
                                                <td className="p-3 text-right">
                                                    <div className="flex justify-end">
                                                        <PriceTag mrp={item.mrp} sellingPrice={price} size="sm" />
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right font-medium">₹{(qty * price).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-sky-50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-600 font-medium">Payment Mode:</span>
                                <span className="font-bold text-sky-800">{saleData.paymentMode}</span>
                            </div>
                            {saleData.paymentMode === 'BOTH' ? (
                                <>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Cash Portion:</span>
                                        <span className="font-semibold">₹{parseFloat(saleData.cashAmount || '0').toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">Online Portion:</span>
                                        <span className="font-semibold">₹{parseFloat(saleData.onlineAmount || '0').toFixed(2)}</span>
                                    </div>
                                </>
                            ) : saleData.paymentMode === 'CASH' ? (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-600">Cash Received:</span>
                                    <span className="font-semibold">₹{parseFloat(saleData.cashReceived || '0').toFixed(2)}</span>
                                </div>
                            ) : null}
                            {saleData.paymentReference && (
                                <div className="flex justify-between items-center text-sm border-t border-sky-100 pt-2">
                                    <span className="text-gray-600">Reference:</span>
                                    <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border">{saleData.paymentReference}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex justify-between items-center w-full sm:w-auto">
                        <span className="text-gray-500 font-medium mr-2">Grand Total:</span>
                        <span className="text-2xl font-black text-sky-700">₹{calculateTotal()}</span>
                    </div>

                    {/* Tab order: Process → Confirm → Edit → Process (managed by handleKeyDown trap).
                        DOM order doesn't matter for Tab since the trap overrides it.
                        tabIndex=-1 on all so the trap is the sole Tab authority inside the modal. */}
                    <div className="grid grid-cols-3 gap-2 w-full sm:flex sm:flex-row sm:gap-3 sm:w-auto">
                        <button
                            ref={editRef}
                            tabIndex={-1}
                            onClick={onClose}
                            className="flex items-center justify-center gap-1.5 px-1 py-2 sm:px-6 sm:py-2.5 rounded-xl border-2 border-gray-300 text-gray-700 text-xs sm:text-base font-semibold hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                        >
                            Edit
                        </button>

                        <button
                            ref={processRef}
                            tabIndex={-1}
                            disabled={!isPaymentValid || isSubmitting}
                            onClick={() => onSubmit(false)}
                            className="flex items-center justify-center gap-1.5 bg-sky-600 text-white px-1 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-base hover:bg-sky-700 font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                            Process
                        </button>

                        <button
                            ref={confirmRef}
                            tabIndex={-1}
                            disabled={!isPaymentValid || isSubmitting}
                            onClick={() => onSubmit(true)}
                            className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-500 text-white px-1 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-base hover:from-emerald-700 hover:to-green-600 font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                            {isSubmitting ? '⏳' : '🖨️'} <span className="hidden sm:inline">Confirm</span><span className="sm:hidden">Confirm+Print</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}