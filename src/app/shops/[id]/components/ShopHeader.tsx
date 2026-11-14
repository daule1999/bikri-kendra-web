'use client';

import { useRouter } from 'next/navigation';

interface ShiftSession {
  id: number;
  status: string;
  openedAt: string;
}

interface Shop {
  id: number;
  shopName: string;
  counterNumber: number;
  categoryId: number;
  categoryName?: string;
  eventId?: number;
  eventName?: string;
  isActive: boolean;
}

interface Props {
  shop: Shop;
  categoryName: string;
  eventName: string;
  activeShift: ShiftSession | null;
  loadingShift: boolean;
}

export default function ShopHeader({ shop, categoryName, eventName, activeShift, loadingShift }: Props) {
  const router = useRouter();
  const shiftIsOpen = activeShift?.status === 'OPEN';

  return (
    <div
      className="relative rounded-2xl text-white overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #3B82F6 100%)' }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}
      />

      <div className="relative p-6 sm:p-8">
        {/* Top row: back + shop name + shift badge */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push('/shops')}
              className="mt-1 flex items-center gap-1 text-blue-200 hover:text-white text-sm font-medium transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Shops
            </button>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: '#93C5FD' }}>Counter & Stall Management</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{shop.shopName}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm" style={{ color: '#93C5FD' }}>
                <span>Counter {shop.counterNumber}</span>
                {categoryName && <><span className="opacity-40">•</span><span>{categoryName}</span></>}
                {eventName && <><span className="opacity-40">•</span><span>{eventName}</span></>}
              </div>
            </div>
          </div>

          {/* Right side: status + actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Shop active status */}
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide ${shop.isActive ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/40' : 'bg-red-500/30 text-red-100 border border-red-400/40'
              }`}>
              {shop.isActive ? '● Active' : '● Inactive'}
            </span>

            {/* Shift status */}
            {loadingShift ? (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/60 animate-pulse">
                Checking shift...
              </span>
            ) : shiftIsOpen ? (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-500/30 text-emerald-100 border border-emerald-400/40">
                🟢 Shift Open
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 text-white/60 border border-white/20">
                ⚪ No Active Shift
              </span>
            )}
          </div>
        </div>

        {/* Bottom row: action buttons */}
        <div className="flex flex-wrap gap-3 mt-6">
          {/* Retail Sales */}
          <button
            onClick={() => router.push(`/sales?shopId=${shop.id}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-blue-700 hover:bg-blue-50 transition-all shadow-sm hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Retail Sales
          </button>

          {/* Go to Shift */}
          <button
            onClick={() => router.push(`/shifts?shopId=${shop.id}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/15 text-white hover:bg-white/25 border border-white/20 transition-all shadow-sm hover:-translate-y-0.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {shiftIsOpen ? 'Manage Shift' : 'Open Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
