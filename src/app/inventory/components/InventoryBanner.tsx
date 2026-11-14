'use client';

import { useInventory } from '../context/InventoryContext';

export default function InventoryBanner() {
  const { products } = useInventory();

  return (
    <div className="relative rounded-xl p-4 sm:p-5 text-white mb-3 sm:mb-4 shrink-0 shadow-md"
      style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 60%, #818CF8 100%)' }}>
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #E0E7FF 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold mb-0.5 text-indigo-100 uppercase tracking-wider">Central Hub</p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Inventory Management</h1>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-indigo-100">Total Products</p>
          <p className="text-lg font-bold">{products.length}</p>
        </div>
      </div>
    </div>
  );
}
