'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';

interface AddProductFormProps {
  setAddForm: (v: boolean) => void;
  /** When set, the single-product form is prefilled from this product (SKU is left blank - it must be unique). */
  initialProduct?: any;
}

export default function AddProductForm({ setAddForm, initialProduct }: AddProductFormProps) {
  const { categories, showSuccess, showError, fetchProducts } = useInventory();
  const [productTab, setProductTab] = useState('single');
  const [productData, setProductData] = useState({
    name: initialProduct?.name ?? '',
    categoryId: initialProduct?.categoryId != null ? String(initialProduct.categoryId) : '',
    sku: '',
    description: initialProduct?.description ?? '',
    mrp: initialProduct?.mrp != null ? String(initialProduct.mrp) : '',
    sellingPrice: initialProduct?.sellingPrice != null ? String(initialProduct.sellingPrice) : '',
    discount: initialProduct?.discount != null ? String(initialProduct.discount) : '',
    minThreshold: initialProduct?.minThreshold != null ? String(initialProduct.minThreshold) : '',
    isActive: initialProduct?.isActive ?? true
  });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedCategoryForBulk, setSelectedCategoryForBulk] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const mrpVal = parseFloat(productData.mrp);
    const sellingPriceVal = parseFloat(productData.sellingPrice);
    const discountVal = productData.discount ? parseFloat(productData.discount) : 0;

    if (isNaN(mrpVal) || mrpVal <= 0) {
      showError('MRP must be greater than 0');
      return;
    }
    if (isNaN(sellingPriceVal) || sellingPriceVal <= 0) {
      showError('Selling Price must be greater than 0');
      return;
    }
    if (productData.discount && (isNaN(discountVal) || discountVal <= 0)) {
      showError('Discount must be greater than 0');
      return;
    }

    inventoryLogger.info('Creating new product', productData);
    try {
      const response = await apiClient.post('/products', {
        ...productData,
        categoryId: parseInt(productData.categoryId),
        mrp: mrpVal,
        sellingPrice: sellingPriceVal,
        discount: discountVal,
        minThreshold: productData.minThreshold ? parseInt(productData.minThreshold) : 10,
        isActive: productData.isActive
      });

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Product created successfully', result);
        setProductData({ name: '', categoryId: '', sku: '', description: '', mrp: '', sellingPrice: '', discount: '', minThreshold: '', isActive: true });
        showSuccess(`Product "${productData.name}" created successfully`);
        fetchProducts();
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Product creation failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to create product');
      }
    } catch (error) {
      inventoryLogger.error('Network error during product creation', error);
      showError('Network error occurred while creating product');
    }
  };

  const handleBulkProductSubmit = async () => {
    if (!csvFile || !selectedCategoryForBulk || isUploading) return;

    setIsUploading(true);
    inventoryLogger.info('Creating bulk products from CSV', { fileName: csvFile.name, categoryId: selectedCategoryForBulk });
    try {
      const csvText = await csvFile.text();
      const lines = csvText.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        showError('CSV file must contain at least a header and one data row');
        setIsUploading(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim());
      const products = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length === headers.length) {
          const product: any = { categoryId: parseInt(selectedCategoryForBulk) };
          headers.forEach((header, index) => {
            if (header === 'mrp' || header === 'sellingPrice' || header === 'discount') {
              product[header] = parseFloat(values[index]) || 0;
            } else {
              product[header] = values[index];
            }
          });

          if (product.mrp <= 0) {
            showError(`Line ${i + 1}: MRP must be greater than 0`);
            setIsUploading(false);
            return;
          }
          if (product.sellingPrice <= 0) {
            showError(`Line ${i + 1}: Selling Price must be greater than 0`);
            setIsUploading(false);
            return;
          }
          if (product.discount < 0) {
            showError(`Line ${i + 1}: Discount cannot be negative`);
            setIsUploading(false);
            return;
          }

          products.push(product);
        }
      }

      if (products.length === 0) {
        showError('No valid products found in CSV file');
        setIsUploading(false);
        return;
      }

      if (products.length > 1000) {
        showError('Maximum 1000 products allowed per upload');
        setIsUploading(false);
        return;
      }

      inventoryLogger.info('Uploading products', { count: products.length });

      const response = await apiClient.post('/products/bulk', products);

      if (response.ok) {
        const result = await response.json();
        inventoryLogger.info('Bulk products created successfully', result);
        setCsvFile(null);
        setSelectedCategoryForBulk('');
        showSuccess(`${products.length} products uploaded successfully`);
        fetchProducts();
      } else {
        const errorData = await response.json();
        inventoryLogger.error('Bulk product creation failed', { status: response.status, error: errorData });
        showError(errorData.message || 'Failed to upload products');
      }
    } catch (error) {
      inventoryLogger.error('Error processing CSV file', error);
      showError('Error processing CSV file. Please check the format.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-4 sm:p-10 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🏷️</div>
          Products
        </h3>
        <div className="flex flex-row items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const csvContent = 'name,sku,mrp,sellingPrice,discount,description\nSample Product,SKU001,100.00,90.00,10.00,Sample product description';
              const blob = new Blob([csvContent], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'product-sample.csv';
              link.click();
              URL.revokeObjectURL(url);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
          >
            <span>📥</span> Download Sample CSV
          </button>
          <button
            type="button"
            onClick={() => setAddForm(false)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            ← Back to Product dashboard
          </button>
        </div>
      </div>

      {/* Tabs for Single vs Bulk */}
      <div className="flex mb-8 border border-indigo-100 bg-gray-50/80 rounded-xl p-1.5 w-fit">
        <button
          onClick={() => setProductTab('single')}
          className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${productTab === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Single Product
        </button>
        <button
          onClick={() => setProductTab('bulk')}
          className={`px-6 py-2 text-sm font-semibold rounded-lg transition-all ${productTab === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Bulk Upload
        </button>
      </div>

      {/* Single Product Form */}
      <div className={productTab === 'single' ? 'block' : 'hidden'}>
        <form onSubmit={handleProductSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Product Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Enter product name"
              value={productData.name}
              onChange={(e) => setProductData({ ...productData, name: e.target.value })}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">SKU / Barcode <span className="text-red-500">*</span></label>
            <input
              type="text"
              placeholder="Enter SKU or scan barcode"
              value={productData.sku}
              onChange={(e) => setProductData({ ...productData, sku: e.target.value })}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Category <span className="text-red-500">*</span></label>
            <MuiSelect
              label=""
              value={productData.categoryId}
              onChange={(val) => setProductData({ ...productData, categoryId: val })}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name
              }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">MRP <span className="text-red-500">*</span></label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={productData.mrp}
              onChange={(e) => setProductData({ ...productData, mrp: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Selling Price <span className="text-red-500">*</span></label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={productData.sellingPrice}
              onChange={(e) => setProductData({ ...productData, sellingPrice: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Discount (Optional)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={productData.discount}
              onChange={(e) => setProductData({ ...productData, discount: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Min Threshold (Optional)</label>
            <input
              type="number"
              min="0"
              placeholder="Defaults to 10"
              value={productData.minThreshold}
              onChange={(e) => setProductData({ ...productData, minThreshold: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Available for Sale</label>
            <div className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl">
              <ToggleSwitch
                checked={productData.isActive}
                onChange={(checked) => setProductData({ ...productData, isActive: checked })}
                activeLabel="Sellable"
                inactiveLabel="Not Sellable"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Product Description</label>
            <textarea
              placeholder="Enter product description"
              value={productData.description}
              onChange={(e) => setProductData({ ...productData, description: e.target.value })}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl h-28 text-sm sm:text-base focus:ring-2 focus:ring-indigo-500 transition-shadow resize-none"
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-3 mt-2">
            <button
              type="button"
              onClick={() => setAddForm(false)}
              className="w-full md:w-auto px-6 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button type="submit" className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5">
              Register Product
            </button>
          </div>
        </form>
      </div>

      {/* Bulk Upload Form */}
      <div className={productTab === 'bulk' ? 'block' : 'hidden'}>
        <div className="space-y-6">
          <div>
            <MuiSelect
              label="Target Category"
              value={selectedCategoryForBulk}
              onChange={(val) => setSelectedCategoryForBulk(val)}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name
              }))}
              required
            />
          </div>
          <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-8 text-center hover:bg-indigo-50/60 transition-colors">
            <label className="cursor-pointer block">
              <span className="text-4xl mb-4 block">📄</span>
              <span className="block text-sm font-semibold text-indigo-700 mb-2">Click to select CSV File</span>
              <span className="block text-xs text-gray-500 mb-4">{csvFile ? csvFile.name : 'No file chosen'}</span>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="hidden"
                required
              />
            </label>
            <div className="text-xs text-gray-400 bg-white inline-block px-3 py-2 rounded-lg border border-gray-100 mt-2">
              <strong>Format:</strong> name,sku,mrp,sellingPrice,discount,description<br />
              Max 1000 products
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAddForm(false)}
              className="w-full sm:w-auto px-6 py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkProductSubmit}
              disabled={!csvFile || !selectedCategoryForBulk || isUploading}
              className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-3.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isUploading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <span>Upload Products</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
