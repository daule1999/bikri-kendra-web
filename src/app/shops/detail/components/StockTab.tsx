'use client';

import { useState, useMemo } from 'react';
import { ContentLoader } from '@/components/ui/ContentLoader';
import { matchByNameSku } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';

interface StockItem {
  id: number;
  name: string;
  sku: string;
  categoryName?: string;
  sellingPrice?: number;
  price?: number;        // fallback alias
  shopStock: number;
}

interface Props {
  shopName: string;
  stocks: StockItem[];
  loadingStocks: boolean;
  canUnissue: boolean;
  onUnissue: () => void; // opens unissue modal in parent
}

export default function StockTab({ shopName, stocks, loadingStocks, canUnissue, onUnissue }: Props) {
  const [searchName, setSearchName] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  const filtered = useMemo(() => {
    const searchMatched = new Set(matchByNameSku(searchName, stocks, { limit: Infinity }));
    return stocks.filter(s => {
      const effectivePrice = s.sellingPrice ?? s.price ?? 0;
      if (searchName && !searchMatched.has(s)) return false;
      if (minPrice && effectivePrice < parseFloat(minPrice)) return false;
      if (maxPrice && effectivePrice > parseFloat(maxPrice)) return false;
      return true;
    });
  }, [stocks, searchName, minPrice, maxPrice]);

  const hasFilters = searchName || minPrice || maxPrice;
  const totalStock = filtered.reduce((sum, s) => sum + (s.shopStock || 0), 0);

  if (loadingStocks) {
    return <ContentLoader message="Loading stock..." />;
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            <span className="font-bold text-gray-800">{filtered.length}</span> product{filtered.length !== 1 ? 's' : ''} at counter
            {totalStock > 0 && <span className="ml-2 text-purple-700 font-semibold">({totalStock} units total)</span>}
          </p>
        </div>
        {canUnissue && (
          <button
            onClick={onUnissue}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Unissue Stock
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search product name..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full p-2.5 pr-10 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
            {searchName && (
              <button
                type="button"
                onClick={() => setSearchName('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                title="Clear search"
                aria-label="Clear search"
              >
                <CancelIcon />
              </button>
            )}
          </div>
          <input
            type="number"
            placeholder="Min price (₹)"
            value={minPrice}
            onChange={e => setMinPrice(e.target.value)}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            min="0"
          />
          <input
            type="number"
            placeholder="Max price (₹)"
            value={maxPrice}
            onChange={e => setMaxPrice(e.target.value)}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            min="0"
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => { setSearchName(''); setMinPrice(''); setMaxPrice(''); }}
            className="mt-3 text-xs font-semibold text-purple-600 hover:text-purple-800 underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Stock table */}
      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 text-left font-semibold text-gray-600">Product</th>
                <th className="p-4 text-left font-semibold text-gray-600">SKU</th>
                <th className="p-4 text-right font-semibold text-gray-600">Price</th>
                <th className="p-4 text-right font-semibold text-gray-600">At Counter</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(stock => (
                <tr key={stock.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-semibold text-gray-800">{stock.name}</td>
                  <td className="p-4 text-gray-500 text-xs font-mono">{stock.sku || '—'}</td>
                  <td className="p-4 text-right text-gray-700 font-medium">
                    {(stock.sellingPrice) != null
                      ? `₹${Number(stock.sellingPrice).toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="p-4 text-right">
                    <span className={`inline-flex items-center justify-center w-10 h-7 rounded-lg text-sm font-bold ${stock.shopStock > 10 ? 'bg-emerald-100 text-emerald-800'
                        : stock.shopStock > 0 ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                      {stock.shopStock}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="text-5xl">📦</div>
          <h4 className="text-base font-bold text-gray-700">
            {hasFilters ? 'No matching stock' : 'No Stock at Counter'}
          </h4>
          <p className="text-sm text-gray-500">
            {hasFilters ? 'Adjust your filters to see stock.' : 'Issue stock to this counter from Inventory.'}
          </p>
        </div>
      )}
    </div>
  );
}
