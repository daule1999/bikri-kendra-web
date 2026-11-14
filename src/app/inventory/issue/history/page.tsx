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
  shopId: number | null;
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

export default function IssueHistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <IssueHistoryContent />
    </Suspense>
  );
}

function IssueHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cameFromNewIssue = searchParams.get('from') === 'new';
  const { products, shops } = useInventory();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    setAllowed(canViewStockMovementHistory());
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), size: String(PAGE_SIZE) });
      if (productFilter) params.append('productId', productFilter);
      if (shopFilter) params.append('shopId', shopFilter);
      if (typeFilter) params.append('movementType', typeFilter);

      const res = await apiClient.get(`/inventory/stock-movements/issue-history?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        const data = body.data || body;
        setRows(data.content || []);
        setTotal(data.totalElements || 0);
      } else if (res.status === 403) {
        setError('You do not have permission to view issue history.');
      } else {
        setError('Failed to load issue history.');
      }
    } catch (e) {
      setError('Network error while loading issue history.');
    } finally {
      setLoading(false);
    }
  }, [page, productFilter, shopFilter, typeFilter]);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  const productName = (id: number) => products.find((p) => p.id === id)?.name || `#${id}`;
  const shopLabel = (id: number | null) => {
    if (!id) return '—';
    const shop = shops.find((s) => s.id === id);
    return shop ? `${shop.shopName} (Counter ${shop.counterNumber})` : `Shop #${id}`;
  };

  if (allowed === false) {
    return (
      <div className="p-8 text-center text-gray-500">
        You do not have permission to view issue history.
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🕘</div>
          Issue History
        </h3>
        <div className="flex flex-row items-center gap-4">
          {cameFromNewIssue && (
            <button
              onClick={() => router.push('/inventory/issue?new=1')}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
            >
              ← Back to New Issue
            </button>
          )}
          <button
            onClick={() => router.push('/inventory/issue')}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            ← Back to Issue dashboard
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
          label="Shop"
          value={shopFilter}
          onChange={(val) => { setPage(0); setShopFilter(val); }}
          options={[
            { value: '', label: 'All Shops' },
            ...shops.map((s) => ({ value: String(s.id), label: `${s.shopName} - Counter ${s.counterNumber}` })),
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
            { value: 'TRANSFER', label: 'TRANSFER' },
            { value: 'ADJUSTMENT', label: 'ADJUSTMENT' },
          ]}
        />
      </div>

      {error && <div className="p-3 mb-4 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}

      <div className="overflow-x-auto border border-indigo-100 rounded-xl">
        <table className="w-full min-w-[820px]">
          <thead className="bg-gray-50/50">
            <tr>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Sn</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Date</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Product</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Shop</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Type</th>
              <th className="p-3 text-center text-sm font-bold text-indigo-900">Qty</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">From → To</th>
              <th className="p-3 text-left text-sm font-bold text-indigo-900">Reason</th>
              <th className="p-3 text-center text-sm font-bold text-indigo-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">No issue history found</td></tr>
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
                  <td className="p-3 text-sm text-gray-600">{shopLabel(row.shopId)}</td>
                  <td className="p-3 text-sm text-gray-600">{row.movementType}</td>
                  <td className="p-3 text-sm text-center font-semibold text-gray-800">{row.quantity}</td>
                  <td className="p-3 text-xs text-gray-500 font-mono">{row.locationFrom} → {row.locationTo}</td>
                  <td className="p-3 text-sm text-gray-600">{row.reason}</td>
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
