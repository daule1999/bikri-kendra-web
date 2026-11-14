'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseBackendIST } from '@/lib/dateUtils';

import { MuiDatePicker } from '@/components/ui/MuiDatePicker';
import { CancelIcon } from '@/components/ui/Icons';
import { useInventory } from '../../context/InventoryContext';
import { canViewStockMovementHistory } from '@/lib/auth';
import { matchByNameSku } from '@/lib/searchMatch';

export default function IssueRecordsList({ setAddForm }) {
  const router = useRouter();
  const { products, shops, salesRecords, soldAnalytics } = useInventory();
  const [showHistoryBtn, setShowHistoryBtn] = useState(false);

  useEffect(() => {
    setShowHistoryBtn(canViewStockMovementHistory());
  }, []);
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [salesStartDate, setSalesStartDate] = useState('');
  const [salesEndDate, setSalesEndDate] = useState('');
  const [filteredSalesRecords, setFilteredSalesRecords] = useState<any[]>([]);

  // Filter sales records based on search term and dates
  useEffect(() => {
    let filtered = salesRecords;

    if (salesSearchTerm) {
      const matchedProductIds = new Set(
        matchByNameSku(salesSearchTerm, products, { limit: Infinity }).map(p => p.id)
      );
      filtered = filtered.filter(sale => matchedProductIds.has(sale.productId));
    }

    if (salesStartDate) {
      // Parse as IST midnight — explicit +05:30 offset avoids OS-timezone shift
      const startIST = new Date(`${salesStartDate}T00:00:00+05:30`);
      filtered = filtered.filter(sale => {
        const saleDate = parseBackendIST(sale.createdAt || sale.saleDate);
        return saleDate >= startIST;
      });
    }

    if (salesEndDate) {
      // Parse as IST end-of-day
      const endIST = new Date(`${salesEndDate}T23:59:59.999+05:30`);
      filtered = filtered.filter(sale => {
        const saleDate = parseBackendIST(sale.createdAt || sale.saleDate);
        return saleDate <= endIST;
      });
    }

    filtered = [...filtered].sort((a, b) => {
      const counterA = shops.find(s => s.id === parseInt(a.shopId))?.counterNumber || 0;
      const counterB = shops.find(s => s.id === parseInt(b.shopId))?.counterNumber || 0;
      return counterA - counterB;
    });

    setFilteredSalesRecords(filtered);
  }, [salesRecords, salesSearchTerm, salesStartDate, salesEndDate, products, shops]);

  return (
    <div className="w-full bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:mt-0 animate-fade-in-up xl:sticky xl:top-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📋</div>
          Issued Records
        </h3>
        <div className="flex gap-2">
          {showHistoryBtn && (
            <button
              onClick={() => router.push('/inventory/issue/history?from=dashboard')}
              className="bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all duration-150"
            >
              History
            </button>
          )}
          <button
            onClick={() => setAddForm(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-150"
          >
            Issue Product
          </button>
        </div>
      </div>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 items-center">
          {/* <MuiDatePicker
            label="Start Date"
            value={salesStartDate}
            onChange={(val) => setSalesStartDate(val)}
            type="date"
            size="small"
          />
          <MuiDatePicker
            label="End Date"
            value={salesEndDate}
            onChange={(val) => setSalesEndDate(val)}
            type="date"
            size="small"
          /> */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search product..."
              value={salesSearchTerm}
              onChange={(e) => setSalesSearchTerm(e.target.value)}
              className="w-full pl-4 pr-10 py-2.5 bg-transparent border border-slate-200 hover:border-slate-400 rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all duration-200 text-slate-900 placeholder:text-slate-400 shadow-none"
              style={{ minHeight: '42px' }}
            />
            {salesSearchTerm && (
              <button
                type="button"
                onClick={() => setSalesSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                title="Clear search"
                aria-label="Clear search"
              >
                <CancelIcon />
              </button>
            )}
          </div>
        </div>
        {filteredSalesRecords.length > 0 ? (() => {
          // Group by counter number
          const groups: Record<string, any[]> = {};
          filteredSalesRecords.forEach(sale => {
            const shop = shops.find(s => s.id === parseInt(sale.shopId));
            const key = shop?.counterNumber?.toString() || 'N/A';
            if (!groups[key]) groups[key] = [];
            groups[key].push({ sale, shop });
          });
          return Object.entries(groups).map(([counterNo, records]) => {
            // Group by product within counter
            const productGroups: Record<number, { sale: any, shop: any, initialQty: number, liveQty: number }> = {};
            records.forEach(({ sale, shop }) => {
              if (!productGroups[sale.productId]) {
                productGroups[sale.productId] = { sale, shop, initialQty: 0, liveQty: 0 };
              }
              productGroups[sale.productId].initialQty += (sale.initialQuantity !== undefined ? sale.initialQuantity : (sale.quantity || 0));
              productGroups[sale.productId].liveQty += (sale.liveQuantity !== undefined ? sale.liveQuantity : (sale.quantity || 0));
            });
            return (
              <div key={counterNo} className="border border-indigo-100 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-indigo-50/80 px-4 py-3 flex items-center gap-3 border-b border-indigo-100">
                  <span className="font-bold text-indigo-800 text-lg">Counter {counterNo}</span>
                  <span className="text-sm font-medium text-indigo-600 bg-white px-2 py-0.5 rounded-md shadow-sm border border-indigo-100">{records[0]?.shop?.shopName || ''}</span>
                  <span className="ml-auto text-xs font-semibold text-indigo-500 uppercase tracking-wider">{Object.keys(productGroups).length} product{Object.keys(productGroups).length > 1 ? 's' : ''}</span>
                </div>
                <div className="overflow-hidden">
                  {/* Desktop Table View */}
                  <div className="overflow-x-auto w-full">
                    <table className="w-full min-w-[640px]">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="p-3 text-left text-sm font-bold text-indigo-900 border-b border-gray-100">Product</th>
                          <th className="p-3 text-center text-sm font-bold text-indigo-900 border-b border-gray-100">Initial Quantity</th>
                          <th className="p-3 text-center text-sm font-bold text-indigo-900 border-b border-gray-100">Live Quantity</th>
                          <th className="p-3 text-right text-sm font-bold text-indigo-900 border-b border-gray-100">Price</th>
                          <th className="p-3 text-right text-sm font-bold text-indigo-900 border-b border-gray-100">Sold Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {Object.values(productGroups).map(({ sale, initialQty, liveQty }) => {
                          const product = products.find(p => p.id === sale.productId);
                          const soldQty = soldAnalytics
                            .filter(s => parseInt(s.productId) === sale.productId && parseInt(s.shopId) === parseInt(sale.shopId))
                            .reduce((sum, s) => sum + (s.totalSold || s.total_sold || 0), 0);
                          const soldAmount = (product?.sellingPrice || 0) * soldQty;
                          const minThreshold = product?.minThreshold || 10;
                          const isOutOfStock = liveQty === 0;
                          const isLowStock = liveQty <= minThreshold && liveQty > 0;

                          return (
                            <tr key={sale.productId} className="hover:bg-gray-50/50 transition-colors">
                              <td className="p-3 text-sm font-medium text-gray-800">{product?.name || 'Unknown Product'}</td>
                              <td className="p-3 text-sm text-center text-gray-600 font-semibold">{initialQty}</td>
                              <td className="p-3 text-sm text-center">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold inline-block border ${isOutOfStock ? 'bg-red-50 text-red-600 animate-pulse border-red-200' :
                                  isLowStock ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                    'bg-green-50 text-green-600 border-green-200'
                                  }`}>
                                  {liveQty} {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                                </span>
                              </td>
                              <td className="p-3 text-sm text-right font-medium text-gray-600">₹{product?.sellingPrice || 0}</td>
                              <td className="p-3 text-sm text-right font-semibold text-gray-800">₹{soldAmount.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-indigo-50/50 border-t-2 border-indigo-100">
                          <td className="p-3 text-sm font-bold text-indigo-900 uppercase tracking-wider" colSpan={4}>Total Sale Amount</td>
                          <td className="p-3 text-base font-black text-indigo-700 text-right">
                            ₹{Object.values(productGroups).reduce((total, { sale }) => {
                              const product = products.find(p => p.id === sale.productId);
                              const soldQty = soldAnalytics
                                .filter(s => parseInt(s.productId) === sale.productId && parseInt(s.shopId) === parseInt(sale.shopId))
                                .reduce((sum, s) => sum + (s.totalSold || s.total_sold || 0), 0);
                              return total + (product?.sellingPrice || 0) * soldQty;
                            }, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="block sm:hidden divide-y divide-gray-100">
                    {Object.values(productGroups).map(({ sale, initialQty, liveQty }) => {
                      const product = products.find(p => p.id === sale.productId);
                      const soldQty = soldAnalytics
                        .filter(s => parseInt(s.productId) === sale.productId && parseInt(s.shopId) === parseInt(sale.shopId))
                        .reduce((sum, s) => sum + (s.totalSold || s.total_sold || 0), 0);
                      const soldAmount = (product?.sellingPrice || 0) * soldQty;
                      const minThreshold = product?.minThreshold || 10;
                      const isOutOfStock = liveQty === 0;
                      const isLowStock = liveQty <= minThreshold && liveQty > 0;

                      return (
                        <div key={sale.productId} className="p-4 bg-white hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-800">{product?.name || 'Unknown Product'}</h4>
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${isOutOfStock ? 'bg-red-50 text-red-600 animate-pulse border-red-200' :
                              isLowStock ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                                'bg-green-50 text-green-600 border-green-200'
                              }`}>
                              {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <div className="flex gap-4">
                              <div>
                                <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Initial</p>
                                <p className="font-semibold text-gray-700">{initialQty}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Live</p>
                                <p className="font-semibold text-indigo-700">{liveQty}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Price</p>
                                <p className="font-medium text-gray-600">₹{product?.sellingPrice || 0}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Sold Amount</p>
                              <p className="font-bold text-gray-900">₹{soldAmount.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div className="bg-indigo-50/80 p-4 flex justify-between items-center border-t border-indigo-100">
                      <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Total Sale</span>
                      <span className="text-lg font-black text-indigo-700">
                        ₹{Object.values(productGroups).reduce((total, { sale }) => {
                          const product = products.find(p => p.id === sale.productId);
                          const soldQty = soldAnalytics
                            .filter(s => parseInt(s.productId) === sale.productId && parseInt(s.shopId) === parseInt(sale.shopId))
                            .reduce((sum, s) => sum + (s.totalSold || s.total_sold || 0), 0);
                          return total + (product?.sellingPrice || 0) * soldQty;
                        }, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          });
        })() : (
          <div className="border border-dashed border-gray-200 rounded-xl p-8 text-gray-400 text-center font-medium bg-gray-50/50">
            {salesRecords.length === 0 ? 'No sales records found' : 'No sales records match the search criteria'}
          </div>
        )}
      </div>
    </div>
  );
}
