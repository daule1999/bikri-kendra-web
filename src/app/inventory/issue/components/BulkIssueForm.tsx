'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';
import { matchByNameSku } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';

export default function BulkIssueForm({ setAddForm }) {
  const { products, stocks, shops, categories, showSuccess, showError, fetchSalesRecords, fetchStocks, currentUsername } = useInventory();
  const [bulkIssueData, setBulkIssueData] = useState({
    sellerUser: currentUsername || '',
    shopId: '',
    items: [] as Array<{ productId: number, quantity: number }>
  });
  const [isProcessingBulkIssue, setIsProcessingBulkIssue] = useState(false);
  const [bulkIssueFilter, setBulkIssueFilter] = useState('');
  const [bulkIssueSearch, setBulkIssueSearch] = useState('');

  // Sync sellerUser when currentUsername changes
  useEffect(() => {
    if (currentUsername) {
      setBulkIssueData(prev => ({ ...prev, sellerUser: currentUsername }));
    }
  }, [currentUsername]);

  const updateBulkQuantity = (productId: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    setBulkIssueData(prev => {
      const existingIndex = prev.items.findIndex(item => item.productId === productId);
      const newItems = [...prev.items];

      if (existingIndex >= 0) {
        if (qty > 0) {
          newItems[existingIndex] = { productId, quantity: qty };
        } else {
          newItems.splice(existingIndex, 1);
        }
      } else if (qty > 0) {
        newItems.push({ productId, quantity: qty });
      }

      return { ...prev, items: newItems };
    });
  };

  const handleBulkIssueSubmit = async () => {
    const itemsToIssue = bulkIssueData.items.filter(item => item.quantity > 0);

    if (itemsToIssue.length === 0) {
      showError('Please enter quantities for at least one product');
      return;
    }

    if (!bulkIssueData.shopId) {
      showError('Please select a shop');
      return;
    }

    const hasCategoryMismatch = itemsToIssue.some(item => {
      const product = products.find(p => p.id === item.productId);
      const selectedShop = shops.find(s => s.id.toString() === bulkIssueData.shopId);
      return product && selectedShop && product.categoryId !== selectedShop.categoryId;
    });

    if (hasCategoryMismatch) {
      showError("Cannot process bulk issue: one or more selected items do not match the destination shop's Category.");
      return;
    }

    setIsProcessingBulkIssue(true);
    inventoryLogger.info('Processing bulk issue', { itemCount: itemsToIssue.length });

    try {
      const bulkPayload = itemsToIssue.map(item => ({
        productId: item.productId,
        sellerUser: bulkIssueData.sellerUser,
        shopId: parseInt(bulkIssueData.shopId),
        quantity: item.quantity
      }));

      const response = await apiClient.post('/inventory/sales/bulk', bulkPayload);

      if (response.ok) {
        inventoryLogger.info('Bulk issue completed successfully');
        setBulkIssueData({
          sellerUser: currentUsername || '',
          shopId: '',
          items: []
        });
        showSuccess(`Successfully issued ${itemsToIssue.length} products`);
        fetchSalesRecords();
        fetchStocks();
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Bulk issue failed', { error: errorData });
        showError(errorData.message || 'Failed to process bulk issue');
      }
    } catch (error) {
      inventoryLogger.error('Bulk issue processing error', error);
      showError('Network error occurred while processing bulk issue');
    } finally {
      setIsProcessingBulkIssue(false);
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📚</div>
        Bulk Issue
      </h3>

      {/* Shop Selection and Category Filter */}
      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <input
              type="text"
              value={bulkIssueData.sellerUser}
              placeholder="Issued By"
              className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm sm:text-base font-medium text-gray-500"
              readOnly
            />
          </div>
          <div>
            <MuiSelect
              label="Destination Shop"
              value={bulkIssueData.shopId}
              onChange={(val) => {
                const selectedShop = shops.find(shop => shop.id.toString() === val.toString());
                // Reset items and search when shop changes
                setBulkIssueData(prev => ({ ...prev, shopId: val, items: [] }));
                setBulkIssueSearch('');
                if (selectedShop && selectedShop.categoryId) {
                  setBulkIssueFilter(selectedShop.categoryId.toString());
                } else {
                  setBulkIssueFilter('');
                }
              }}
              options={shops.map(shop => ({
                value: String(shop.id),
                label: `${shop.shopName} - Counter ${shop.counterNumber}`
              }))}
              required
            />
          </div>
          <div>
            <MuiSelect
              label="Category"
              value={bulkIssueFilter}
              onChange={(val) => setBulkIssueFilter(val)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map(cat => ({ value: String(cat.id), label: cat.name }))
              ]}
            />
            {bulkIssueData.shopId && bulkIssueFilter && (
              <p className="mt-1 text-xs text-indigo-500 font-medium pl-1">
                Pre-filled from shop's category
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Search — own full-width row so long product names are fully readable while typing */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="Search Products..."
          value={bulkIssueSearch}
          onChange={(e) => setBulkIssueSearch(e.target.value)}
          className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
        {bulkIssueSearch && (
          <button
            type="button"
            onClick={() => setBulkIssueSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
            title="Clear search"
            aria-label="Clear search"
          >
            <CancelIcon />
          </button>
        )}
      </div>

      {/* Products Grid */}
      <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-inner">
        <div className="hidden sm:block bg-indigo-50/50 p-4 border-b border-indigo-100">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.5fr] gap-4 font-bold text-sm text-indigo-900">
            <div>Product Details</div>
            <div>SKU</div>
            <div className="text-center">Stock Available</div>
            <div className="text-center">Issue Qty</div>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto bg-white divide-y divide-gray-50">
          {(() => {
            const filtered = matchByNameSku(bulkIssueSearch, products, { limit: Infinity })
              .filter(product => !bulkIssueFilter || product.categoryId?.toString() === bulkIssueFilter);

            if (filtered.length === 0) {
              return (
                <div className="p-8 text-center text-gray-400 text-sm font-medium">
                  {bulkIssueData.shopId
                    ? bulkIssueFilter
                      ? `No products found for the selected category${bulkIssueSearch ? ' matching your search' : ''}`
                      : 'Select a category to see products'
                    : 'Select a shop to see products'}
                </div>
              );
            }

            return filtered.map((product) => {
              const currentQuantity = bulkIssueData.items.find(item => item.productId === product.id)?.quantity || 0;
              const currentStock = stocks.find(s => s.productId === product.id)?.quantity || 0;

              return (
                <div key={product.id} className="p-4 hover:bg-indigo-50/30 transition-colors group">
                  {/* Mobile View */}
                  <div className="sm:hidden flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <h4 className="font-bold text-gray-800 text-sm leading-tight">{product.name}</h4>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{product.sku}</p>
                      </div>
                      <div className="shrink-0 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-xs font-bold border border-indigo-100">
                        Stock: {currentStock}
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Issue Qty:</span>
                      <input
                        type="number"
                        min="0"
                        max={currentStock}
                        value={currentQuantity || ''}
                        onChange={(e) => updateBulkQuantity(product.id, e.target.value)}
                        className="w-20 sm:w-24 p-2 bg-white border border-gray-200 rounded-lg text-center text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Desktop View */}
                  <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1.5fr] gap-4 items-center text-sm">
                    <div className="font-semibold text-gray-800 break-words group-hover:text-indigo-700 transition-colors">
                      <div>{product.name}</div>
                    </div>
                    <div className="text-gray-500 font-mono text-xs bg-gray-100 px-2 py-1 rounded w-fit">{product.sku}</div>
                    <div className="text-center text-gray-600 font-bold text-base">
                      {currentStock}
                    </div>
                    <div className="text-center flex justify-center">
                      <input
                        type="number"
                        min="0"
                        max={currentStock}
                        value={currentQuantity || ''}
                        onChange={(e) => updateBulkQuantity(product.id, e.target.value)}
                        className="w-20 sm:w-24 p-2 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow placeholder:font-normal placeholder:text-gray-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-gray-100 pt-5 flex flex-col sm:flex-row justify-end gap-3 mt-6">
        <button
          type="button"
          onClick={() => setAddForm(false)}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => setBulkIssueData(prev => ({ ...prev, items: [] }))}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
        >
          Clear Selection
        </button>
        <button
          onClick={handleBulkIssueSubmit}
          disabled={isProcessingBulkIssue || bulkIssueData.items.length === 0 || !bulkIssueData.shopId}
          className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isProcessingBulkIssue ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>...</span>
            </>
          ) : (
            <span>Process Bulk Issue</span>
          )}
        </button>
      </div>
    </div>
  );
}
