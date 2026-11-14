'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { CancelIcon } from '@/components/ui/Icons';
import { matchItems } from '@/lib/searchMatch';

interface ProductListProps {
  setAddForm: (v: boolean) => void;
  onDuplicate?: (product: any) => void;
}

export default function ProductList({ setAddForm, onDuplicate }: ProductListProps) {
  const { categories, products, showSuccess, showError, fetchProducts, isAdminUser, soldAnalytics, fetchSoldAnalytics } = useInventory();
  const [salesChecked, setSalesChecked] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [productSkuFilter, setProductSkuFilter] = useState('');
  const [productMinPrice, setProductMinPrice] = useState('');
  const [productMaxPrice, setProductMaxPrice] = useState('');
  const [productAvailabilityFilter, setProductAvailabilityFilter] = useState('');
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editProductData, setEditProductData] = useState({
    name: '',
    sku: '',
    categoryId: '',
    mrp: '',
    sellingPrice: '',
    discount: '',
    description: '',
    minThreshold: '',
    isActive: true
  });
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);

  // Pricing is locked once the product has any sale (checked fresh each time Edit is opened)
  const productHasSales = (productId: number) =>
    soldAnalytics.some((s: any) => Number(s.productId) === Number(productId) && Number(s.totalSold) > 0);

  const startProductEdit = (product: any) => {
    setSalesChecked(false);
    fetchSoldAnalytics().finally(() => setSalesChecked(true));
    setEditingProductId(product.id);
    setEditProductData({
      name: product?.name || '',
      sku: product?.sku || '',
      categoryId: product?.categoryId?.toString() || '',
      mrp: product?.mrp?.toString() || '',
      sellingPrice: product?.sellingPrice?.toString() || '',
      discount: product?.discount?.toString() || '',
      description: product?.description || '',
      minThreshold: product?.minThreshold?.toString() || '',
      isActive: product?.isActive !== false
    });
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setEditProductData({
      name: '',
      sku: '',
      categoryId: '',
      mrp: '',
      sellingPrice: '',
      discount: '0',
      description: '',
      minThreshold: '',
      isActive: true
    });
  };

  const handleProductUpdate = async (productId: number) => {
    if (!editProductData.name.trim() || !editProductData.sku.trim() || !editProductData.categoryId) {
      showError('Product name, SKU, and category are required');
      return;
    }
    console.log('DIscount', editProductData.discount)
    const mrpVal = parseFloat(editProductData.mrp);
    const sellingPriceVal = parseFloat(editProductData.sellingPrice);
    const discountVal = editProductData.discount ? parseFloat(editProductData.discount) : 0;

    if (isNaN(mrpVal) || mrpVal <= 0) {
      showError('MRP must be greater than 0');
      return;
    }
    if (isNaN(sellingPriceVal) || sellingPriceVal <= 0) {
      showError('Selling Price must be greater than 0');
      return;
    }
    if (editProductData.discount && parseFloat(editProductData.discount) < 0) {
      showError('Discount cannot be negative');
      return;
    }

    setIsUpdatingProduct(true);
    inventoryLogger.info('Updating product', { productId, payload: editProductData });
    try {
      const response = await apiClient.put(`/products/${productId}`, {
        name: editProductData.name.trim(),
        sku: editProductData.sku.trim(),
        categoryId: parseInt(editProductData.categoryId),
        mrp: mrpVal,
        sellingPrice: sellingPriceVal,
        discount: discountVal,
        description: editProductData.description,
        minThreshold: editProductData.minThreshold ? parseInt(editProductData.minThreshold) : 10,
        isActive: editProductData.isActive
      });

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Product updated successfully', result);
        showSuccess(`Product "${editProductData.name}" updated successfully`);
        cancelProductEdit();
        fetchProducts();
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Product update failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to update product');
      }
    } catch (error) {
      inventoryLogger.error('Network error during product update', error);
      showError('Network error occurred while updating product');
    } finally {
      setIsUpdatingProduct(false);
    }
  };

  const handleProductDelete = (productId: number, productName: string) => {
    if (!isAdminUser) { showError('Only admin can delete products'); return; }
    setDeleteConfirm({ id: productId, name: productName });
  };

  const confirmProductDelete = async () => {
    if (!deleteConfirm) return;
    const { id: productId, name: productName } = deleteConfirm;
    setDeleteConfirm(null);
    setIsDeletingProduct(true);
    inventoryLogger.info('Deleting product', { productId, productName });
    try {
      const admin = localStorage.getItem('username');
      const response = await apiClient.delete(`/products/${productId}`, {
        'X-Username': admin || '',
        'X-Roles': 'ADMIN'
      });

      if (response.ok) {
        const result = await response.json().catch(() => ({}));
        inventoryLogger.info('Product deleted successfully', result);
        showSuccess(`Product "${productName}" deleted successfully`);
        if (editingProductId === productId) {
          cancelProductEdit();
        }
        fetchProducts();
      } else {
        const errorData = await response.json().catch(() => ({}));
        inventoryLogger.error('Product delete failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to delete product');
      }
    } catch (error) {
      inventoryLogger.error('Network error during product delete', error);
      showError('Network error occurred while deleting product');
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const searchMatchedProducts = new Set(
    matchItems(productSearchTerm, products, (p) => [p?.name, p?.sku, p?.description], Infinity)
  );
  const skuMatchedProducts = new Set(
    matchItems(productSkuFilter, products, (p) => [p?.sku], Infinity)
  );

  const filteredProducts = products.filter((product) => {
    const matchesSearch = searchMatchedProducts.has(product);

    const matchesCategory = !productCategoryFilter || product?.categoryId?.toString() === productCategoryFilter;
    const matchesSku = !productSkuFilter.trim() || skuMatchedProducts.has(product);
    const sellingPrice = Number(product?.sellingPrice ?? 0);
    const minPrice = productMinPrice ? Number(productMinPrice) : null;
    const maxPrice = productMaxPrice ? Number(productMaxPrice) : null;
    const matchesMinPrice = minPrice === null || sellingPrice >= minPrice;
    const matchesMaxPrice = maxPrice === null || sellingPrice <= maxPrice;
    const isOnSale = product?.isActive !== false;
    const matchesAvailability =
      !productAvailabilityFilter ||
      (productAvailabilityFilter === 'active' ? isOnSale : !isOnSale);

    return matchesSearch && matchesCategory && matchesSku && matchesMinPrice && matchesMaxPrice && matchesAvailability;
  });

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-4 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
      <div className='flex justify-between items-center'>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📋</div>
          All Products
        </h3>
        <button
          onClick={() => setAddForm(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all duration-150"
        >
          Add product
        </button>
      </div>
      <div className="mb-4 text-sm text-gray-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
        Total Products: <span className="font-semibold text-indigo-700">{products.length}</span>
        {filteredProducts.length !== products.length ? (
          <span className="ml-2 text-gray-500">(Showing {filteredProducts.length} after filters)</span>
        ) : null}
      </div>

      <div className="mb-5 relative">
        <input
          type="text"
          placeholder="Search products by name, SKU, or description..."
          value={productSearchTerm}
          onChange={(e) => setProductSearchTerm(e.target.value)}
          className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
        {productSearchTerm && (
          <button
            type="button"
            onClick={() => setProductSearchTerm('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
            title="Clear search"
            aria-label="Clear search"
          >
            <CancelIcon />
          </button>
        )}
      </div>

      <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
        <MuiSelect
          label="Category"
          value={productCategoryFilter}
          onChange={(val) => setProductCategoryFilter(val)}
          options={[
            { value: '', label: 'All Categories' },
            ...categories.map((category) => ({
              value: category.id,
              label: category.name
            }))
          ]}
        />
        <div className="relative">
          <input
            type="text"
            placeholder="Filter by SKU"
            value={productSkuFilter}
            onChange={(e) => setProductSkuFilter(e.target.value)}
            className="w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
          />
          {productSkuFilter && (
            <button
              type="button"
              onClick={() => setProductSkuFilter('')}
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
          min="0"
          step="0.01"
          placeholder="Min Selling Price"
          value={productMinPrice}
          onChange={(e) => setProductMinPrice(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Max Selling Price"
          value={productMaxPrice}
          onChange={(e) => setProductMaxPrice(e.target.value)}
          onWheel={(e) => e.currentTarget.blur()}
          className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
        />
        <MuiSelect
          label="Availability"
          value={productAvailabilityFilter}
          onChange={(val) => setProductAvailabilityFilter(val)}
          options={[
            { value: '', label: 'All Products' },
            { value: 'active', label: 'On Sale' },
            { value: 'inactive', label: 'Off Sale' }
          ]}
        />
        <button
          type="button"
          onClick={() => {
            setProductCategoryFilter('');
            setProductSkuFilter('');
            setProductMinPrice('');
            setProductMaxPrice('');
            setProductAvailabilityFilter('');
          }}
          className="md:col-span-2 w-full p-3 bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-sm sm:text-base font-semibold hover:bg-gray-200 transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-gray-500">No products found.</p>
      ) : filteredProducts.length === 0 ? (
        <p className="text-sm text-gray-500">No products match your search.</p>
      ) : (
        <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
          {filteredProducts.map((product) => {
            const category = categories.find((c) => c.id === product?.categoryId);
            return (
              <div key={product.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                {editingProductId === product.id ? (
                  <div className="space-y-4 bg-indigo-50/30 p-4 rounded-xl border border-indigo-100/60">
                    <div>
                      <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Product Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={editProductData.name}
                        onChange={(e) => setEditProductData({ ...editProductData, name: e.target.value })}
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        placeholder="Product Name"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">SKU / Barcode <span className="text-red-500">*</span></label>
                        <input
                          type="text"
                          value={editProductData.sku}
                          onChange={(e) => setEditProductData({ ...editProductData, sku: e.target.value })}
                          className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 font-mono"
                          placeholder="SKU"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Category <span className="text-red-500">*</span></label>
                        <MuiSelect
                          label=""
                          value={editProductData.categoryId}
                          onChange={(val) => setEditProductData({ ...editProductData, categoryId: val })}
                          options={categories.map((cat) => ({
                            value: cat.id,
                            label: cat.name
                          }))}
                          size="small"
                        />
                      </div>
                    </div>
                    {salesChecked && productHasSales(product.id) && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                        MRP, Selling Price and Discount cannot be changed because this product already has sales. Please create a new product instead.
                      </p>
                    )}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">MRP <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editProductData.mrp}
                          onChange={(e) => setEditProductData({ ...editProductData, mrp: e.target.value })}
                          disabled={!salesChecked || productHasSales(product.id)}
                          title={productHasSales(product.id) ? 'Price cannot be changed because this product has sales' : undefined}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          placeholder="MRP"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Selling Price <span className="text-red-500">*</span></label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editProductData.sellingPrice}
                          onChange={(e) => setEditProductData({ ...editProductData, sellingPrice: e.target.value })}
                          disabled={!salesChecked || productHasSales(product.id)}
                          title={productHasSales(product.id) ? 'Price cannot be changed because this product has sales' : undefined}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          placeholder="Selling Price"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Discount</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editProductData.discount}
                          onChange={(e) => setEditProductData({ ...editProductData, discount: e.target.value })}
                          disabled={!salesChecked || productHasSales(product.id)}
                          title={productHasSales(product.id) ? 'Price cannot be changed because this product has sales' : undefined}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          placeholder="Discount"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Min Threshold</label>
                        <input
                          type="number"
                          min="0"
                          value={editProductData.minThreshold}
                          onChange={(e) => setEditProductData({ ...editProductData, minThreshold: e.target.value })}
                          onWheel={(e) => e.currentTarget.blur()}
                          className="w-full p-3 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                          placeholder="Min Threshold"
                        />
                      </div>
                    </div>
                    <div className="max-w-xs">
                      <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Available for Sale</label>
                      <div className="w-full p-2.5 bg-white border border-gray-300 rounded-lg">
                        <ToggleSwitch
                          checked={editProductData.isActive}
                          onChange={(checked) => setEditProductData({ ...editProductData, isActive: checked })}
                          activeLabel="Sellable"
                          inactiveLabel="Not Sellable"
                          size="small"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-indigo-700 mb-1 uppercase tracking-wider">Product Description</label>
                      <textarea
                        value={editProductData.description}
                        onChange={(e) => setEditProductData({ ...editProductData, description: e.target.value })}
                        className="w-full p-3 bg-white border border-gray-300 rounded-lg h-20 text-sm focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="Description"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleProductUpdate(product.id)}
                        disabled={isUpdatingProduct}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
                      >
                        {isUpdatingProduct ? 'Updating...' : 'Update'}
                      </button>
                      <button
                        type="button"
                        onClick={cancelProductEdit}
                        disabled={isUpdatingProduct}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-300 disabled:opacity-60 transition-colors"
                      >
                        Cancel
                      </button>
                      {onDuplicate && salesChecked && productHasSales(product.id) && (
                        <button
                          type="button"
                          onClick={() => onDuplicate({ ...product, ...editProductData })}
                          disabled={isUpdatingProduct}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-sm sm:ml-auto"
                          title="Create a new product with the same details so the price can be changed"
                        >
                          Duplicate as new product
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-gray-800">{product?.name || '-'}</p>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${product?.isActive === false
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : 'bg-green-50 text-green-600 border-green-200'
                            }`}
                        >
                          {product?.isActive === false ? 'Off Sale' : 'On Sale'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => startProductEdit(product)}
                          className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-200"
                        >
                          Edit
                        </button>
                        {isAdminUser ? (
                          <button
                            type="button"
                            onClick={() => handleProductDelete(product.id, product?.name || 'this product')}
                            disabled={isDeletingProduct}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 disabled:opacity-60"
                          >
                            {isDeletingProduct ? 'Deleting...' : 'Delete'}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="text-sm text-gray-500">
                        <p>SKU: {product?.sku || '-'}</p>
                        <p>Category: {category?.name || 'Unknown Category'}</p>
                      </div>
                      <div className="text-sm text-gray-600 text-right">
                        <p>MRP: {product?.mrp ?? '-'}</p>
                        <p>Selling: {product?.sellingPrice ?? '-'}</p>
                        {product?.discount ? <p>Discount: {product.discount}</p> : null}
                      </div>
                    </div>
                  </div>
                )}
                {product?.description ? (
                  <p className="text-sm text-gray-500 mt-2">{product.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        title={`Delete "${deleteConfirm?.name}"?`}
        message="This action cannot be undone. The product will be permanently removed."
        confirmLabel="Delete Product"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmProductDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
