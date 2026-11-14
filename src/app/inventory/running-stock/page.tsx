'use client';

import { CancelIcon, RefreshIcon } from '@/components/ui/Icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MuiSelect } from '@/components/ui/MuiSelect';
import { apiClient } from '@/lib/api';
import { matchItems } from '@/lib/searchMatch';
import { useInventory } from '../context/InventoryContext';

const DEFAULT_INTERVAL_SECONDS = 30;
const MIN_INTERVAL_SECONDS = 5;
const DEFAULT_SOLD_WINDOW_HOURS = 1;

type ViewMode = 'in-stock' | 'not-in-stock';

interface RunningStockRow {
  productId: number;
  productName: string;
  sku: string;
  categoryId: number;
  categoryName: string;
  warehouseStock: number;
  currentQty: number;
  soldLastNHours: number;
  soldDataAvailable: boolean;
  currentQtyScope: 'ALL_SHOPS' | 'SINGLE_SHOP';
  status: 'NOT_IN_INVENTORY' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
}

export default function RunningStockPage() {
  // categories/shops are still sourced from the shared context — they only populate the
  // filter dropdown labels, not the report data itself, so this doesn't reintroduce the
  // 3 APIs (stocks/products/sales) the report endpoint replaces.
  const { categories, shops, eventId } = useInventory();

  const [rows, setRows] = useState<RunningStockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshOn, setAutoRefreshOn] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);
  const [intervalInput, setIntervalInput] = useState(String(DEFAULT_INTERVAL_SECONDS));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Toggle between products that DO have a footprint (warehouse or shop stock) and
  // products that have NONE at all — sent to the backend as the `inInventory` param, so
  // this is still one API, just a different filter value, not a second endpoint.
  const [viewMode, setViewMode] = useState<ViewMode>('in-stock');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [soldWindowHours, setSoldWindowHours] = useState(DEFAULT_SOLD_WINDOW_HOURS);
  const [soldWindowInput, setSoldWindowInput] = useState(String(DEFAULT_SOLD_WINDOW_HOURS));

  // Single source of truth for this page: the backend running-stock report already joins
  // Product/Category/Warehouse Stock/Current Qty (all shops)/Sold-in-window/Status server-side —
  // no client-side stitching of separate stocks/products/sales calls anymore.
  const fetchRunningStock = useCallback(async () => {
    if (!eventId) {
      setRows([]);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (shopFilter) params.set('shopId', shopFilter);
      params.set('hours', String(soldWindowHours));
      params.set('inInventory', String(viewMode === 'in-stock'));

      const response = await apiClient.get(`/inventory/reports/running-stock?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setRows(Array.isArray(data) ? data : []);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId, categoryFilter, shopFilter, soldWindowHours, viewMode]);

  useEffect(() => {
    fetchRunningStock();
  }, [fetchRunningStock]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRunningStock();
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === 'in-stock' ? 'not-in-stock' : 'in-stock'));
  };

  // Auto-refresh only ever runs while the toggle is explicitly ON.
  // Changing the interval while it's running restarts the timer with the new value.
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (!autoRefreshOn) return;

    const ms = Math.max(MIN_INTERVAL_SECONDS, intervalSeconds) * 1000;
    intervalRef.current = setInterval(() => {
      handleRefresh();
    }, ms);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefreshOn, intervalSeconds]);

  const commitIntervalInput = () => {
    const parsed = parseInt(intervalInput, 10);
    const safe = isNaN(parsed) ? DEFAULT_INTERVAL_SECONDS : Math.max(MIN_INTERVAL_SECONDS, parsed);
    setIntervalSeconds(safe);
    setIntervalInput(String(safe));
  };

  const commitSoldWindowInput = () => {
    const parsed = parseInt(soldWindowInput, 10);
    // Mirrors the backend's own clamp (1-168h) so the UI can't request something the API
    // would silently cap anyway.
    const safe = isNaN(parsed) ? DEFAULT_SOLD_WINDOW_HOURS : Math.min(168, Math.max(1, parsed));
    setSoldWindowHours(safe);
    setSoldWindowInput(String(safe));
  };

  const visibleRows = useMemo(() => {
    let filtered = rows;
    if (searchTerm) {
      // Tiered LIKE/fuzzy match on name + SKU, same search used everywhere else in the app.
      filtered = matchItems(searchTerm, filtered, (row) => [row.productName, row.sku], Infinity);
    }
    // Default order: fewest current stock first (most urgent), then by highest recent
    // sell frequency as the tiebreaker when stock counts are equal.
    return [...filtered].sort((a, b) => {
      const stockDiff = a.currentQty - b.currentQty;
      if (stockDiff !== 0) return stockDiff;
      return b.soldLastNHours - a.soldLastNHours;
    });
  }, [rows, searchTerm]);

  const statusBadge = (row: RunningStockRow) => {
    if (row.status === 'NOT_IN_INVENTORY') return 'bg-slate-100 text-slate-500 border-slate-200';
    if (row.status === 'OUT_OF_STOCK') return 'bg-red-50 text-red-600 border-red-200';
    if (row.status === 'LOW_STOCK') return 'bg-amber-50 text-amber-600 border-amber-200';
    return 'bg-green-50 text-green-600 border-green-200';
  };

  const statusLabel = (row: RunningStockRow) => {
    if (row.status === 'NOT_IN_INVENTORY') return 'Not in Inventory';
    if (row.status === 'OUT_OF_STOCK') return 'Out of Stock';
    if (row.status === 'LOW_STOCK') return 'Low Stock';
    return 'In Stock';
  };

  const currentQtyColumnLabel = shopFilter ? 'Current Qty (This Shop)' : 'Current Qty (All Shops)';
  const soldColumnLabel = `Sold (Last ${soldWindowHours}h)`;

  const emptyMessage =
    viewMode === 'in-stock'
      ? 'No products found in Inventory Stock.'
      : 'Every product has a stock entry in Inventory Stock. 🎉';

  return (
    <div className="w-full bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-amber-100 text-amber-700 p-2 rounded-xl">⚠️</div>
          Running Stock {viewMode === 'in-stock' ? '(All Stock)' : '(Not in Inventory)'}
        </h3>

        <div className="flex items-center flex-wrap gap-3">
          {lastUpdated && (
            <span className="text-xs text-gray-400 whitespace-nowrap">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          {/* Sold-window editor — sent to the backend as the `hours` query param */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Sold window</span>
            <input
              type="number"
              min={1}
              max={168}
              value={soldWindowInput}
              onChange={(e) => setSoldWindowInput(e.target.value)}
              onBlur={commitSoldWindowInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-12 bg-transparent text-sm font-semibold text-gray-700 text-center focus:outline-none"
            />
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">hr</span>
          </div>

          {/* Timer / interval editor — only takes effect while auto-refresh is ON */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5">
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">Every</span>
            <input
              type="number"
              min={MIN_INTERVAL_SECONDS}
              value={intervalInput}
              onChange={(e) => setIntervalInput(e.target.value)}
              onBlur={commitIntervalInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-14 bg-transparent text-sm font-semibold text-gray-700 text-center focus:outline-none"
            />
            <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">sec</span>
          </div>

          {/* Auto-refresh toggle — auto-refresh ONLY runs when this is ON */}
          <button
            type="button"
            onClick={() => setAutoRefreshOn((prev) => !prev)}
            title={autoRefreshOn ? 'Auto-refresh is ON — click to stop' : 'Auto-refresh is OFF — click to start'}
            className={`px-4 py-1.5 rounded-xl font-bold text-sm shadow-sm transition-all duration-150 whitespace-nowrap ${autoRefreshOn
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50'
              }`}
          >
            {autoRefreshOn ? '⏸ Auto-Refresh: ON' : '▶ Auto-Refresh: OFF'}
          </button>

          {/* Manual refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh now"
            className="flex items-center justify-center bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 p-2 rounded-xl shadow-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshIcon className={`text-indigo-600 hover:text-indigo-800 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center flex-wrap gap-3 mb-6">
        {/* In-Inventory / Not-in-Inventory toggle — re-fetches (via the same API, inInventory param) on switch */}
        <button
          type="button"
          onClick={handleToggleViewMode}
          title="Switch between products stocked in Inventory Stock and products with no stock record"
          className={`px-4 py-1.5 rounded-xl font-bold text-sm shadow-sm transition-all duration-150 whitespace-nowrap ${viewMode === 'not-in-stock'
              ? 'bg-slate-700 text-white hover:bg-slate-800'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
        >
          {viewMode === 'in-stock' ? '📦 Showing: In Inventory Stock' : '🚫 Showing: Not in Inventory Stock'}
        </button>

        <div className="flex items-center flex-wrap gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-56 pl-4 pr-10 py-2.5 bg-transparent border border-slate-200 hover:border-slate-400 rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all duration-200 text-slate-900 placeholder:text-slate-400 shadow-none"
              style={{ minHeight: '42px' }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                title="Clear search"
                aria-label="Clear search"
              >
                <CancelIcon />
              </button>
            )}
          </div>
          <MuiSelect
            label="Category"
            size="small"
            value={categoryFilter}
            onChange={(val) => setCategoryFilter(val)}
            options={[{ value: '', label: 'All Categories' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            className="w-44"
          />
          <MuiSelect
            label="Shop"
            size="small"
            value={shopFilter}
            onChange={(val) => setShopFilter(val)}
            options={[
              { value: '', label: 'All Shops' },
              ...shops.map((s) => ({ value: s.id, label: `${s.shopName} - Counter ${s.counterNumber}` })),
            ]}
            className="w-52"
          />
        </div>
      </div>

      {loadError ? (
        <div className="p-10 text-center text-red-500 border border-dashed border-red-200 rounded-xl">
          Couldn't load the running stock report. Try refreshing.
        </div>
      ) : loading && visibleRows.length === 0 ? (
        <div className="p-10 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
          Loading…
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="p-10 text-center text-gray-400 border border-dashed border-gray-200 rounded-xl">
          {emptyMessage}
        </div>
      ) : (
        <div className="overflow-x-auto border border-indigo-50 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-3">S.No</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3 text-right">Warehouse Stock (Unissued)</th>
                <th className="px-4 py-3 text-right">{currentQtyColumnLabel}</th>
                <th className="px-4 py-3 text-right">{soldColumnLabel}</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleRows.map((row, idx) => (
                <tr key={row.productId} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{row.productName}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.sku}</td>
                  <td className="px-4 py-3 text-gray-600">{row.categoryName}</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-800">{row.warehouseStock}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.currentQty}</td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                    {row.soldDataAvailable ? (
                      row.soldLastNHours
                    ) : (
                      <span title="Sold data temporarily unavailable" className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadge(row)}`}>
                      {statusLabel(row)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
