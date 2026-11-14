import React from 'react';

interface SaleHeaderBannerProps {
    shopId: string;
    assignedShops: any[];
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    isMobile: boolean;
    nextInvoiceNumber?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    // Basket
    basketCount?: number;
    onOpenBasket?: () => void;
}

const ExpandIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
    </svg>
);

const CompressIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 14h6v6m0-6l-6 6m16-6h-6v6m0-6l6 6M4 10h6V4m0 6L4 4m16 6h-6V4m0 6l6-6" />
    </svg>
);

const StoreIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const RefreshIcon = ({ spinning }: { spinning?: boolean }) => (
    <svg
        className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`}
        fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}
    >
        <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

const ReceiptIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
);

const BasketIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

export function SaleHeaderBanner({
    shopId, assignedShops, isFullscreen, onToggleFullscreen, isMobile,
    nextInvoiceNumber, onRefresh, isRefreshing,
    basketCount = 0, onOpenBasket,
}: SaleHeaderBannerProps) {
    const activeShopName = shopId
        ? (shopId === 'ALL' ? 'All Shops' : assignedShops.find(s => s.id.toString() === shopId)?.shopName || 'Loading...')
        : 'None Selected';

    return (
        <div
            className="relative rounded-2xl p-4 pt-1 sm:p-5 text-white mb-3 sm:mb-4 shrink-0 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0369A1 0%, #0284C7 55%, #0EA5E9 100%)' }}
        >
            {/* Decorative blobs */}
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-10 bg-white pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-24 h-24 rounded-full opacity-5 bg-white pointer-events-none" />

            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">

                {/* Row 1+2: POS label + Retail Sales title */}
                {!isFullscreen && (
                    <div>
                        <p className="text-[10px] sm:text-xs font-semibold text-sky-200 uppercase tracking-widest mb-0.5">
                            POS &amp; Fast Billing
                        </p>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Retail Sales</h1>
                    </div>
                )}

                {/* Controls: on mobile → flex-col (shop chip row, then icons row); on sm → single flex row */}
                <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ${isFullscreen ? 'flex-1 sm:justify-between' : 'sm:ml-auto'}`}>

                    {/* Row 3: Active shop chip — own line on mobile */}
                    <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                        <div className="text-sky-200 shrink-0">
                            <StoreIcon />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[9px] sm:text-[10px] font-semibold text-sky-200 uppercase tracking-wider leading-none mb-0.5">
                                Active Shop
                            </p>
                            <p className="text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-none">
                                {activeShopName}
                            </p>
                        </div>
                    </div>

                    {/* Next invoice chip — desktop only */}
                    {nextInvoiceNumber && (
                        <div className="hidden sm:flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                            <div className="text-sky-200 shrink-0">
                                <ReceiptIcon />
                            </div>
                            <div>
                                <p className="text-[9px] font-semibold text-sky-200 uppercase tracking-wider leading-none mb-0.5">
                                    Next Invoice
                                </p>
                                <p className="text-xs font-bold font-mono">{nextInvoiceNumber}</p>
                            </div>
                        </div>
                    )}

                    {/* Row 4: basket + refresh left, fullscreen right — on mobile only */}
                    <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                        {/* Left group: basket + refresh */}
                        <div className="flex items-center gap-2">
                            {onOpenBasket && (
                                <button
                                    type="button"
                                    onClick={onOpenBasket}
                                    tabIndex={-1}
                                    className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-all duration-150 active:scale-95 shrink-0"
                                    title="View basket"
                                >
                                    <BasketIcon />
                                    <span className="hidden sm:inline">Basket</span>
                                    {basketCount > 0 && (
                                        <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black border-2 border-sky-700 shadow">
                                            {basketCount > 99 ? '99+' : basketCount}
                                        </span>
                                    )}
                                </button>
                            )}

                            {onRefresh && (
                                <button
                                    type="button"
                                    onClick={onRefresh}
                                    disabled={isRefreshing}
                                    tabIndex={-1}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold transition-all duration-150 active:scale-95 shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
                                    title="Refresh product stock"
                                >
                                    <RefreshIcon spinning={isRefreshing} />
                                    <span className="hidden sm:inline">{isRefreshing ? 'Refreshing…' : 'Refresh Stock'}</span>
                                </button>
                            )}
                        </div>

                        {/* Right: fullscreen — pushed to far right on mobile */}
                        <button
                            type="button"
                            onClick={onToggleFullscreen}
                            tabIndex={-1}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all duration-150 active:scale-95 shrink-0"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        >
                            {isFullscreen ? <CompressIcon /> : <ExpandIcon />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
