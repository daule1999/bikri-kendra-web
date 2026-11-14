'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { ProductSearchSelect } from '@/components/ui/ProductSearchSelect';
import { useInventory } from '../../context/InventoryContext';
import { canViewStockMovementHistory } from '@/lib/auth';

interface MovementRow {
  id: number;
  productId: number;
  movementType: string;
  quantity: number;
  reason: string;
  locationFrom: string;
  locationTo: string;
  username: string;
  movementDate: string;
  status: string;
}

const PAGE_SIZE = 20;

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-600 border-green-200',
  EDITED: 'bg-amber-50 text-amber-600 border-amber-200',
  ROLLED_BACK: 'bg-red-50 text-red-600 border-red-200',
};

export default function InventoryMovementHistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <InventoryMovementHistoryContent />
    </Suspense>
  );
}

function InventoryMovementHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromNewInventory = searchParams.get('from') === 'new';
  const { products, categories } = useInventory();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    setAllowed(canViewStockMovementHistory());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (productFilter) params.append('productId', productFilter);
      if (typeFilter) params.append('movementType', typeFilter);
      if (categoryFilter) params.append('categoryId', categoryFilter);

      const res = await apiClient.get(`/inventory/stock-movements/inventory-history?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        const data = body.data || body;
        setRows(data.content || []);
        setTotal(data.totalElements || 0);
      } else if (res.status === 403) {
        setError('You do not have permission to view inventory movement history.');
      } else {
        setError('Failed to load inventory movement history.');
      }
    } catch (e) {
      setError('Network error while loading inventory movement history.');
    } finally {
      setLoading(false);
    }
  }, [page, productFilter, typeFilter, categoryFilter]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const productName = (id: number) => products.find((p) => p.id === id)?.name || `#${id}`;

  if (allowed === false) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view inventory movement history.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🕘</div>
          Stock Movement History
        </h3>
        <div className="flex flex-row items-center gap-4">
          {cameFromNewInventory && (
            <button
              onClick={() => router.push('/inventory/stock?new=1')}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
            >
              ← Back to New Inventory addition
            </button>
          )}
          <button
            onClick={() => router.push('/inventory/stock')}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            ← Back to Inventory dashboard
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <ProductSearchSelect
          products={products}
          value={productFilter}
          onChange={(val) => { setPage(0); setProductFilter(val); }}
          placeholder="All Products"
        />
        <MuiSelect
          label="Category"
          value={categoryFilter}
          onChange={(val) => { setPage(0); setCategoryFilter(val); }}
          options={[
            { value: '', label: 'All Categories' },
            ...categories.map((cat) => ({ value: String(cat.id), label: cat.name })),
          ]}
        />
        <MuiSelect
          label="Type"
          value={typeFilter}
          onChange={(val) => { setPage(0); setTypeFilter(val); }}
          options={[
            { value: '', label: 'All Types' },
            { value: 'IN', label: 'IN' },
            { value: 'OUT', label: 'OUT' },
            { value: 'ADJUSTMENT', label: 'ADJUSTMENT' },
          ]}
        />
      </div>

      {error && <div className="p-3 mb-4 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}

      <div className="overflow-x-auto border border-indigo-100 rounded-xl">
        <table className="w-full min-w-[720px]">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Sn</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Date</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Product</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Type</th>
              <th className="p-3 text-center text-sm font-bold text-indigo-900">Qty</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Reason</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">By</th>
              <th className="p-3 text-center text-sm font-bold text-indigo-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">No inventory movement history found</td></tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/inventory/movements/${row.id}`)}
                  className="hover:bg-indigo-50/50 cursor-pointer transition-colors"
                >
                  <td className="p-3 text-sm text-gray-500">{page * PAGE_SIZE + idx + 1}</td>
                  <td className="p-3 text-sm text-gray-600">{new Date(row.movementDate).toLocaleString()}</td>
                  <td className="p-3 text-sm font-medium text-gray-800">{productName(row.productId)}</td>
                  <td className="p-3 text-sm text-gray-600">{row.movementType}</td>
                  <td className="p-3 text-sm text-center font-semibold text-gray-800">{row.quantity}</td>
                  <td className="p-3 text-sm text-gray-600">{row.reason}</td>
                  <td className="p-3 text-sm text-gray-500">{row.username}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold border ${statusBadge[row.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-4">
        <span className="text-xs text-gray-500">
          {total > 0 ? `Page ${page + 1} of ${totalPages} (${total} total)` : ''}
        </span>
        <div className="flex gap-2">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm font-semibold rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
