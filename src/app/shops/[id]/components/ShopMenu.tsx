'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  shopId: number;
  shopIsActive: boolean;
  shiftIsOpen: boolean;
  canManageShift: boolean;   // ADMIN or SHOP_SUPERVISOR only
  onEditShop: () => void;
  onCloseShop: () => void;
}

export default function ShopMenu({
  shopId,
  shopIsActive,
  shiftIsOpen,
  canManageShift,
  onEditShop,
  onCloseShop,
}: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
        aria-label="Shop menu"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zm0 5.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
        </svg>
        Options
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-2xl shadow-xl z-30 py-1 overflow-hidden">

          {/* Shift management */}
          {canManageShift && shopIsActive && (
            <button
              onClick={() => { setOpen(false); router.push(`/shifts?shopId=${shopId}`); }}
              className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 flex items-center gap-3 transition-colors"
            >
              <span className="text-emerald-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <span className="text-gray-700">{shiftIsOpen ? 'Manage Shift' : 'Open Shift'}</span>
            </button>
          )}

          {/* Edit Shop */}
          <button
            onClick={() => { setOpen(false); onEditShop(); }}
            className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 flex items-center gap-3 transition-colors"
          >
            <span className="text-orange-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            <span className="text-gray-700">Edit Shop</span>
          </button>

          {/* Close Shop — only for active shops, separated */}
          {shopIsActive && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <button
                onClick={() => { setOpen(false); onCloseShop(); }}
                className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-red-50 flex items-center gap-3 transition-colors"
              >
                <span className="text-red-500">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </span>
                <span className="text-red-600 font-semibold">Close Shop</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
