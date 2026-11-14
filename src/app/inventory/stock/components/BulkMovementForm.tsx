'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';
import { matchByNameSku } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';

export default function BulkMovementForm({ setAddForm }) {
  const { products, categories, showSuccess, showError, fetchStocks, eventId } = useInventory();
  const [bulkStockData, setBulkStockData] = useState({
    movementType: 'IN',
    reason: '',
    reasonComment: '',
    items: [] as Array<{ productId: number, quantity: number }>
  });
  const [isProcessingBulkStock, setIsProcessingBulkStock] = useState(false);
  const [bulkStockFilter, setBulkStockFilter] = useState('');
  const [bulkStockSearch, setBulkStockSearch] = useState('');

  const updateBulkStockQuantity = (productId: number, quantity: string) => {
    const qty = parseInt(quantity) || 0;
    const isAdjustment = bulkStockData.movementType === 'ADJUSTMENT';
    setBulkStockData(prev => {
      const existingIndex = prev.items.findIndex(item => item.productId === productId);
      const newItems = [...prev.items];

      const isValid = isAdjustment ? qty !== 0 : qty > 0;
      if (existingIndex >= 0) {
        if (isValid) {
          newItems[existingIndex] = { productId, quantity: qty };
        } else {
          newItems.splice(existingIndex, 1);
        }
      } else if (isValid) {
        newItems.push({ productId, quantity: qty });
      }

      return { ...prev, items: newItems };
    });
  };

  const handleBulkStockSubmit = async () => {
    if (!eventId) {
      showError('No active event selected. Please select an event from the top bar before recording stock movements.');
      return;
    }

    const itemsToProcess = bulkStockData.items.filter(item => item.quantity > 0);

    if (itemsToProcess.length === 0) {
      showError('Please enter quantities for at least one product');
      return;
    }

    if (!bulkStockData.reason) {
      showError('Please select a reason for stock movement');
      return;
    }

    if (bulkStockData.reason === 'Other' && !bulkStockData.reasonComment) {
      showError('Please enter a comment for Other reason');
      return;
    }

    setIsProcessingBulkStock(true);
    inventoryLogger.info('Processing bulk stock movement', { itemCount: itemsToProcess.length });

    try {
      const finalReason = bulkStockData.reason === 'Other'
        ? `Other: ${bulkStockData.reasonComment}`
        : bulkStockData.reason;

      const promises = itemsToProcess.map(item => {
        const payload: any = {
          productId: item.productId,
          movementType: bulkStockData.movementType,
          quantity: item.quantity,
          reason: finalReason
        };

        return apiClient.post('/inventory/stock-movements', payload);
      });

      const results = await Promise.all(promises);
      const failedItems = results.filter(result => !result.ok);

      if (failedItems.length === 0) {
        inventoryLogger.info('Bulk stock movement completed successfully');
        setBulkStockData({
          movementType: 'IN',
          reason: '',
          reasonComment: '',
          items: []
        });
        showSuccess(`Successfully processed ${itemsToProcess.length} stock movements`);
        fetchStocks();
      } else {
        inventoryLogger.error('Some stock movements failed', { failedCount: failedItems.length });
        showError(`${failedItems.length} stock movements failed. Please try again.`);
      }
    } catch (error) {
      inventoryLogger.error('Bulk stock movement error', error);
      showError('Network error occurred while processing bulk stock movement');
    } finally {
      setIsProcessingBulkStock(false);
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full mb-8">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📦</div>
        Bulk Stock Movement
      </h3>

      {/* Controls */}
      <div className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <MuiSelect
              label="Movement Type"
              value={bulkStockData.movementType}
              onChange={(val) => setBulkStockData({ ...bulkStockData, movementType: val, reason: '', reasonComment: '' })}
              options={[
                { value: 'IN', label: 'Stock In' },
                { value: 'OUT', label: 'Stock Out' }
              ]}
              required
            />
          </div>
          <div>
            <MuiSelect
              label="Reason"
              value={bulkStockData.reason}
              onChange={(val) => setBulkStockData({ ...bulkStockData, reason: val, reasonComment: '' })}
              options={bulkStockData.movementType === 'OUT'
                ? [
                    { value: 'From Store', label: 'From Store' },
                    { value: 'Other', label: 'Other' },
                  ]
                : [
                    { value: 'From Ashram', label: 'From Ashram' },
                    { value: 'Other', label: 'Other' },
                  ]}
              required
            />
            {bulkStockData.reason === 'Other' && (
              <input
                type="text"
                placeholder="Enter comment *"
                value={bulkStockData.reasonComment}
                onChange={(e) => setBulkStockData({ ...bulkStockData, reasonComment: e.target.value })}
                className="w-full pl-4 pr-4 py-2.5 bg-transparent border border-slate-200 hover:border-slate-400 rounded-2xl mt-3 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all duration-200 text-slate-900 placeholder:text-slate-400 animate-fade-in-up"
                style={{ minHeight: '42px' }}
                required
              />
            )}
          </div>
          <div>
            <MuiSelect
              label="Category"
              value={bulkStockFilter}
              onChange={(val) => setBulkStockFilter(val)}
              options={[
                { value: '', label: 'All Categories' },
                ...categories.map(cat => ({ value: cat.id, label: cat.name }))
              ]}
            />
          </div>
        </div>
      </div>

      {/* Search — own full-width row so long product names are fully readable while typing */}
      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="Search Products..."
          value={bulkStockSearch}
          onChange={(e) => setBulkStockSearch(e.target.value)}
          className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
        {bulkStockSearch && (
          <button
            type="button"
            onClick={() => setBulkStockSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
            title="Clear search"
            aria-label="Clear search"
          >
            <CancelIcon />
          </button>
        )}
      </div>

      {/* Products Grid */}
      <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-inner mb-6">
        <div className="hidden sm:block bg-indigo-50/50 p-4 border-b border-indigo-100">
          <div className="grid grid-cols-[2fr_1fr_1.5fr] gap-4 font-bold text-sm text-indigo-900">
            <div>Product Details</div>
            <div>SKU</div>
            <div className="text-center">Movement Qty</div>
          </div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto bg-white divide-y divide-gray-50">
          {matchByNameSku(bulkStockSearch, products, { limit: Infinity })
            .filter(product => !bulkStockFilter || product.categoryId?.toString() === bulkStockFilter)
            .map((product) => {
              const currentQuantity = bulkStockData.items.find(item => item.productId === product.id)?.quantity || 0;

              return (
                <div key={product.id} className="p-4 hover:bg-indigo-50/30 transition-colors group">
                  {/* Mobile View */}
                  <div className="sm:hidden flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-2">
                        <h4 className="font-bold text-gray-800 text-sm leading-tight">{product.name}</h4>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{product.sku}</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Movement Qty:</span>
                      <input
                        type="number"
                        min={bulkStockData.movementType === 'ADJUSTMENT' ? undefined : "1"}
                        value={currentQuantity || ''}
                        onChange={(e) => updateBulkStockQuantity(product.id, e.target.value)}
                        className="w-20 sm:w-24 p-2 bg-white border border-gray-200 rounded-lg text-center text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow shadow-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Desktop View */}
                  <div className="hidden sm:grid grid-cols-[2fr_1fr_1.5fr] gap-4 items-center text-sm">
                    <div className="font-semibold text-gray-800 break-words group-hover:text-indigo-700 transition-colors">
                      {product.name}
                    </div>
                    <div className="text-gray-500 font-mono text-xs bg-gray-100 px-2 py-1 rounded w-fit">{product.sku}</div>
                    <div className="text-center flex justify-center">
                      <input
                        type="number"
                        min={bulkStockData.movementType === 'ADJUSTMENT' ? undefined : "1"}
                        value={currentQuantity || ''}
                        onChange={(e) => updateBulkStockQuantity(product.id, e.target.value)}
                        className="w-20 sm:w-24 p-2 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow placeholder:font-normal placeholder:text-gray-400"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
          onClick={() => setBulkStockData(prev => ({ ...prev, items: [] }))}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
        >
          Clear Selection
        </button>
        <button
          onClick={handleBulkStockSubmit}
          disabled={isProcessingBulkStock || bulkStockData.items.length === 0 || !bulkStockData.reason || (bulkStockData.reason === 'Other' && !bulkStockData.reasonComment)}
          className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isProcessingBulkStock ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>...</span>
            </>
          ) : (
            <span>Process Bulk Movement</span>
          )}
        </button>
      </div>

      {bulkStockData.reason && (
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5 animate-fade-in-up">
          <span className="text-sm">💡</span>
          <div>
            {bulkStockData.reason === 'From Ashram' && (
              <p><strong>From Ashram:</strong> Stock received from the Ashram and added to the main inventory.</p>
            )}
            {bulkStockData.reason === 'From Store' && (
              <p><strong>From Store:</strong> General stock replenishment sourced directly from the main store repository.</p>
            )}
            {bulkStockData.reason === 'Other' && (
              <p><strong>Other:</strong> Custom stock adjustment (e.g. Damage, Audit correction, Theft). Type the specific explanation in the comment box.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
