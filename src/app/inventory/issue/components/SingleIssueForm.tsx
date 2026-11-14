'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { ProductSearchSelect } from '@/components/ui/ProductSearchSelect';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';

export default function SingleIssueForm({ setAddForm }) {
  const router = useRouter();
  const { products, shops, stocks, showSuccess, showError, fetchSalesRecords, fetchStocks, currentUsername } = useInventory();
  const [salesData, setSalesData] = useState({
    productId: '',
    sellerUser: currentUsername || '',
    shopId: '',
    quantity: ''
  });

  // Sync sellerUser when currentUsername changes
  useEffect(() => {
    if (currentUsername) {
      setSalesData(prev => ({ ...prev, sellerUser: currentUsername }));
    }
  }, [currentUsername]);

  // Derive selected shop from current shopId — used for category filtering
  const selectedShop = shops.find(s => s.id.toString() === salesData.shopId);

  // When a shop is selected and has a categoryId, only offer matching products.
  // If the shop has no categoryId (bad data), skip the filter to avoid showing a blank list.
  // Each option also carries the product's current MAIN inventory quantity so the picker
  // doubles as an at-a-glance stock check while choosing what to issue.
  const categoryFilteredProducts = products
    .filter(product =>
      !selectedShop || selectedShop.categoryId == null || product.categoryId === selectedShop.categoryId
    )
    .map(product => ({
      ...product,
      liveQty: stocks.find(s => s.productId === product.id)?.quantity ?? 0,
    }));

  // Selected product's MRP/SP, shown next to Quantity so price is visible without leaving the form.
  const selectedProduct = products.find(p => p.id.toString() === salesData.productId);
  const qtyNum = parseInt(salesData.quantity) || 0;

  const handleShopChange = (val: string) => {
    // Reset product selection when shop changes to avoid stale cross-category product
    setSalesData(prev => ({ ...prev, shopId: val, productId: '' }));
  };

  const handleSalesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    inventoryLogger.info('Creating new sales record', salesData);
    try {
      const response = await apiClient.post('/inventory/sales', {
        ...salesData,
        productId: parseInt(salesData.productId),
        shopId: parseInt(salesData.shopId),
        quantity: parseInt(salesData.quantity)
      });

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Sales record API response received', result);
        if (result.success) {
          inventoryLogger.info('Sales record created successfully', result.data);
          showSuccess('Sales record created successfully');
          fetchSalesRecords();
          fetchStocks();
          router.push('/inventory/issue/history?from=new');
        } else {
          inventoryLogger.error('Sales creation failed - success false', result);
          showError(result.message || 'Failed to create sales record');
        }
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Sales creation failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to create sales record');
      }
    } catch (error) {
      inventoryLogger.error('Network error during sales creation', error);
      showError('Network error occurred while creating sales record');
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] w-full">
      <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
        <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📦</div>
        Record Single Issue
      </h3>
      <form onSubmit={handleSalesSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shop */}
          <div>
            <MuiSelect
              label="Destination Shop"
              value={salesData.shopId}
              onChange={handleShopChange}
              options={shops.map((shop) => ({
                value: String(shop.id),
                label: `${shop.shopName} - Counter ${shop.counterNumber}`
              }))}
              required
            />
          </div>

          {/* Seller */}
          <div>
            <input
              type="text"
              value={salesData.sellerUser}
              placeholder="Issued By"
              className="w-full p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm sm:text-base font-medium text-gray-500"
              readOnly
            />
          </div>
        </div>

        {/* Product — own full-width row so long product names are fully readable */}
        <div className="w-full">
          <ProductSearchSelect
            products={categoryFilteredProducts}
            value={salesData.productId}
            onChange={(productId) => setSalesData(prev => ({ ...prev, productId }))}
            placeholder={selectedShop ? `Search products for ${selectedShop.categoryName || 'this shop'} *` : 'Select a shop first *'}
            disabled={!salesData.shopId}
            required
            hint={selectedShop ? (
              <>Showing products for <span className="font-bold">{selectedShop.categoryName || `category ${selectedShop.categoryId}`}</span> only</>
            ) : undefined}
            emptyMessage="No products with available stock for this shop's category"
          />
          {selectedProduct && (
            <p className="mt-1 text-xs text-gray-500 pl-1">
              {selectedProduct.sellingPrice !== undefined && (
                <span className="font-semibold text-indigo-600">SP ₹{selectedProduct.sellingPrice}</span>
              )}
              {selectedProduct.sellingPrice !== undefined && selectedProduct.mrp !== undefined && '  •  '}
              {selectedProduct.mrp !== undefined && (
                <span>MRP ₹{selectedProduct.mrp}</span>
              )}
            </p>
          )}
        </div>

        {/* Quantity — same grid pattern as the Shop/Seller row above, so it lands at exactly half width */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <input
              type="number"
              placeholder="Quantity *"
              value={salesData.quantity}
              onChange={(e) => setSalesData(prev => ({ ...prev, quantity: e.target.value }))}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
              required
            />
            {selectedProduct?.sellingPrice !== undefined && qtyNum > 0 && (
              <p className="mt-1 text-xs text-gray-500 pl-1">
                Total: <span className="font-semibold text-gray-700">₹{(selectedProduct.sellingPrice * qtyNum).toFixed(2)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="pt-4 mt-2 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={() => setAddForm(false)}
            className="w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button type="submit" className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
            Confirm Issue
          </button>
        </div>
      </form>
    </div>
  );
}
