'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { CancelIcon } from '@/components/ui/Icons';
import { useInventory } from '../../context/InventoryContext';
import { canViewStockMovementHistory } from '@/lib/auth';
import { matchByNameSku } from '@/lib/searchMatch';

export default function StockOverviewList({ setAddForm }) {
  const router = useRouter();
  const { products, stocks, categories } = useInventory();
  const [showHistoryBtn, setShowHistoryBtn] = useState(false);

  useEffect(() => {
    setShowHistoryBtn(canViewStockMovementHistory());
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [filteredStocks, setFilteredStocks] = useState<any[]>([]);

  // Filter stocks based on search term, category, and status
  useEffect(() => {
    let filtered = stocks;

    // Search filter — tiered LIKE/fuzzy match on the linked product's name/sku
    if (searchTerm) {
      const matchedProductIds = new Set(
        matchByNameSku(searchTerm, products, { limit: Infinity }).map(p => p.id)
      );
      filtered = filtered.filter(stock => matchedProductIds.has(stock.productId));
    }

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter(stock => {
        const product = products.find(p => p.id === stock.productId);
        return product?.categoryId?.toString() === selectedCategory;
      });
    }

    // Status filter
    if (selectedStatus) {
      filtered = filtered.filter(stock => {
        const isOutOfStock = stock.quantity === 0;
        const isLowStock = stock.quantity <= (stock.minQuantity || 10) && stock.quantity > 0;
        const isInStock = stock.quantity > (stock.minQuantity || 10);

        switch (selectedStatus) {
          case 'out-of-stock': return isOutOfStock;
          case 'low-stock': return isLowStock;
          case 'in-stock': return isInStock;
          default: return true;
        }
      });
    }


    setFilteredStocks(filtered);
  }, [stocks, searchTerm, selectedCategory, selectedStatus, products]);

  return (
    <div className="w-full bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:mt-0 animate-fade-in-up xl:sticky xl:top-6">
      <div className='flex justify-between items-center'>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📊</div>
          Inventory Stock Overview
        </h3>
        <div className="flex gap-2">
          {showHistoryBtn && (
            <button
              onClick={() => router.push('/inventory/stock/history?from=dashboard')}
              className="bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 px-5 py-1.5 rounded-xl font-bold shadow-sm transition-all duration-150"
            >
              History
            </button>
          )}
          <button
            onClick={() => setAddForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-150"
          >
            Add Stock
          </button>
        </div>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center">
          <div className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-transparent border border-slate-200 hover:border-slate-400 rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all duration-200 text-slate-900 placeholder:text-slate-400 shadow-none"
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
            value={selectedCategory}
            onChange={(val) => setSelectedCategory(val)}
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map(cat => ({ value: cat.id, label: cat.name }))
            ]}
          />
          <MuiSelect
            label="Status"
            value={selectedStatus}
            onChange={(val) => setSelectedStatus(val)}
            options={[
              { value: '', label: 'All Status' },
              { value: 'in-stock', label: 'In Stock' },
              { value: 'low-stock', label: 'Low Stock' },
              { value: 'out-of-stock', label: 'Out of Stock' }
            ]}
          />
        </div>

        <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50/50">
                  <tr>
                    <th className="p-4 text-left text-sm font-bold text-indigo-900 border-b border-gray-100">Product</th>
                    <th className="p-4 text-left text-sm font-bold text-indigo-900 border-b border-gray-100">Category</th>
                    <th className="p-4 text-center text-sm font-bold text-indigo-900 border-b border-gray-100">Current Stock</th>
                    <th className="p-4 text-center text-sm font-bold text-indigo-900 border-b border-gray-100">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {filteredStocks.length > 0 ? (
                    filteredStocks.map((stock) => {
                      const product = products.find(p => p.id === stock.productId);
                      const category = categories.find(c => c.id === product?.categoryId);
                      const currentQty = stock.quantity || 0;
                      const minQty = product?.minThreshold || 10;
                      const isLowStock = currentQty <= minQty && currentQty > 0;
                      const isOutOfStock = currentQty === 0;

                      return (
                        <tr key={stock.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="p-4 text-sm font-semibold text-gray-800">{product?.name || 'Unknown Product'}</td>
                          <td className="p-4 text-sm text-gray-500">{category?.name || 'Unknown Category'}</td>
                          <td className="p-4 text-sm text-center font-bold text-indigo-700">{currentQty}</td>
                          <td className="p-4 text-sm text-center">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${isOutOfStock ? 'bg-red-50 text-red-600' :
                              isLowStock ? 'bg-yellow-50 text-yellow-600' :
                                'bg-green-50 text-green-600'
                              }`}>
                              {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td className="p-8 text-center text-gray-400 font-medium" colSpan={4}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="text-3xl">🔍</div>
                          <div>{stocks.length === 0 ? 'No stock records found' : 'No stocks match the current filters'}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            {/* DUAL MAINTENANCE WARNING: This mobile card view mirrors the desktop table above.
                If you add new columns, fields, or actions to the desktop table,
                you MUST also update the cards below — they are completely separate code paths. */}
            <div className="block sm:hidden divide-y divide-gray-100 bg-white">
              {filteredStocks.length > 0 ? (
                filteredStocks.map((stock) => {
                  const product = products.find(p => p.id === stock.productId);
                  const category = categories.find(c => c.id === product?.categoryId);
                  const currentQty = stock.quantity || 0;
                  const minQty = product?.minThreshold || 10;
                  const isLowStock = currentQty <= minQty && currentQty > 0;
                  const isOutOfStock = currentQty === 0;

                  return (
                    <div key={stock.id} className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold text-gray-800 text-sm leading-tight">{product?.name || 'Unknown Product'}</h4>
                          <p className="text-xs text-gray-400 mt-0.5">{category?.name || 'Unknown Category'}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-xs font-bold shrink-0 ml-2 ${isOutOfStock ? 'bg-red-50 text-red-600' :
                          isLowStock ? 'bg-yellow-50 text-yellow-600' :
                            'bg-green-50 text-green-600'
                          }`}>
                          {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                        </span>
                      </div>

                      <div className="mt-3 bg-gray-50 p-2 rounded-lg text-center">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Current Stock</p>
                        <p className="text-sm font-bold text-indigo-700">{currentQty}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-400 font-medium">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="text-3xl">🔍</div>
                    <div>{stocks.length === 0 ? 'No stock records found' : 'No stocks match the current filters'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
