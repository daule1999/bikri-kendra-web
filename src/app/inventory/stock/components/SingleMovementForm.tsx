'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { ProductSearchSelect } from '@/components/ui/ProductSearchSelect';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';

export default function SingleMovementForm({ setAddForm }) {
  const router = useRouter();
  const { products, showSuccess, showError, fetchStocks, eventId } = useInventory();
  const [stockData, setStockData] = useState({
    productId: '',
    movementType: '',
    quantity: '',
    reason: '',
    reasonComment: '',
  });

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!eventId) {
      showError('No active event selected. Please select an event from the top bar before recording stock movements.');
      return;
    }

    if (!stockData.reason) {
      showError('Please select a reason for stock movement');
      return;
    }

    if (stockData.reason === 'Other' && !stockData.reasonComment) {
      showError('Please enter a comment for Other reason');
      return;
    }

    inventoryLogger.info('Creating stock movement', stockData);
    try {
      const finalReason = stockData.reason === 'Other'
        ? `Other: ${stockData.reasonComment}`
        : stockData.reason;

      const payload: any = {
        productId: parseInt(stockData.productId),
        movementType: stockData.movementType,
        quantity: parseInt(stockData.quantity),
        reason: finalReason
      };

      const response = await apiClient.post('/inventory/stock-movements', payload);

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Stock movement created successfully', result);
        setStockData({ productId: '', movementType: '', quantity: '', reason: '', reasonComment: '' });
        showSuccess('Stock movement recorded successfully');
        fetchStocks();
        router.push('/inventory/stock/history?from=new');
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Stock movement failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to record stock movement');
      }
    } catch (error) {
      inventoryLogger.error('Network error during stock movement', error);
      showError('Network error occurred while recording stock movement');
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full mb-8">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🔄</div>
        Add Stock Movement
      </h3>
      <form onSubmit={handleStockMovement} className="space-y-4">
        {/* Product Search — own full-width row so long product names are fully readable */}
        <div className="w-full">
          <ProductSearchSelect
            products={products}
            value={stockData.productId}
            onChange={(productId) => setStockData({ ...stockData, productId })}
            placeholder="Search product... *"
            dropDirection="up"
            required
          />
        </div>

        {/* Movement Type, Quantity, Reason — stretched evenly across the full available width */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <MuiSelect
              label="Movement"
              value={stockData.movementType}
              onChange={(val) => setStockData({ ...stockData, movementType: val, reason: '', reasonComment: '' })}
              options={[
                { value: 'IN', label: 'Stock In' },
                { value: 'OUT', label: 'Stock Out' }
              ]}
              required
            />
          </div>

          <div>
            <input
              type="number"
              min={stockData.movementType === 'ADJUSTMENT' ? undefined : '1'}
              placeholder="Qty *"
              value={stockData.quantity}
              onChange={(e) => setStockData({ ...stockData, quantity: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>

          <div>
            <MuiSelect
              label="Reason"
              value={stockData.reason}
              onChange={(val) => setStockData({ ...stockData, reason: val, reasonComment: '' })}
              options={stockData.movementType === 'OUT'
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
          </div>
        </div>

        {/* Reason Comment (conditional) */}
        {stockData.reason === 'Other' && (
          <div className="w-full animate-fade-in-up">
            <input
              type="text"
              placeholder="Enter comment *"
              value={stockData.reasonComment}
              onChange={(e) => setStockData({ ...stockData, reasonComment: e.target.value })}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>
        )}

        {/* Submit & Cancel — own row, right-aligned */}
        <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={() => setAddForm(false)}
            className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
            Record
          </button>
        </div>
      </form>
    </div>
  );
}
