'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { useInventory, inventoryLogger } from '../../context/InventoryContext';

interface ParsedRow {
  rowNumber: number;
  nameRaw: string;
  sku: string;
  quantityRaw: string;
  productId?: number;
  productName?: string;
  quantity?: number;
  currentStock?: number;
  errors: string[];
}

/**
 * Resolve a CSV row's product from name and/or SKU:
 * - Both filled: look each up independently, then require they point at the SAME product
 *   (catches a row where the name and SKU were copy-pasted from different products).
 * - Only one filled: resolve by whichever field is present.
 * - Neither filled: unresolvable.
 */
function resolveProductFromRow(nameRaw: string, skuRaw: string, products: any[]) {
  const nameKey = nameRaw.trim().toLowerCase();
  const skuKey = skuRaw.trim().toLowerCase();

  if (!nameKey && !skuKey) {
    return { product: undefined, error: 'Missing product name and SKU' };
  }

  if (nameKey && skuKey) {
    const byName = products.find((p) => (p.name || '').trim().toLowerCase() === nameKey);
    const bySku = products.find((p) => (p.sku || '').trim().toLowerCase() === skuKey);
    if (!byName && !bySku) return { product: undefined, error: 'Unknown product name and SKU' };
    if (!byName) return { product: undefined, error: 'Unknown product name' };
    if (!bySku) return { product: undefined, error: 'Unknown SKU' };
    if (byName.id !== bySku.id) return { product: undefined, error: 'Product name and SKU do not match the same product' };
    return { product: byName, error: null };
  }

  if (skuKey) {
    const bySku = products.find((p) => (p.sku || '').trim().toLowerCase() === skuKey);
    return bySku ? { product: bySku, error: null } : { product: undefined, error: 'Unknown SKU' };
  }

  const byName = products.find((p) => (p.name || '').trim().toLowerCase() === nameKey);
  return byName ? { product: byName, error: null } : { product: undefined, error: 'Unknown product name' };
}

export default function BulkUploadMovementForm({ setAddForm }) {
  const router = useRouter();
  const { products, stocks, showSuccess, showError, fetchStocks, eventId } = useInventory();

  const [movementType, setMovementType] = useState('IN');
  const [reason, setReason] = useState('');
  const [reasonComment, setReasonComment] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Bumping this remounts the file input, which is the only reliable way to clear its
  // value — otherwise re-selecting the exact same filename after submitting silently
  // does nothing because the browser won't fire onChange for it.
  const [fileInputKey, setFileInputKey] = useState(0);

  const downloadSampleCsv = () => {
    const csvContent = 'name,sku,quantity\nSample Product,SKU001,10\n,SKU002,5\nSample Product 3,,3';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk-stock-movement-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Movement type affects what counts as a valid quantity (and whether stock-availability
  // matters), so re-validate whenever it changes.
  const validateRows = (parsedRows: { rowNumber: number; nameRaw: string; sku: string; quantityRaw: string }[], typeForValidation: string) => {
    const seenKeys = new Set<string>();

    return parsedRows.map((r): ParsedRow => {
      const errors: string[] = [];

      // Match by name+SKU (must resolve to the SAME product), or by whichever of the
      // two is filled in, before anything else.
      const { product, error: resolveError } = resolveProductFromRow(r.nameRaw, r.sku, products);
      if (resolveError) errors.push(resolveError);

      const dedupeKey = (r.nameRaw.trim() + '|' + r.sku.trim()).toLowerCase();
      if (dedupeKey !== '|' && seenKeys.has(dedupeKey)) {
        errors.push('Duplicate row in file');
      }
      seenKeys.add(dedupeKey);

      const quantity = parseInt(r.quantityRaw, 10);
      const isAdjustment = typeForValidation === 'ADJUSTMENT';
      const validQuantity = isAdjustment ? !isNaN(quantity) && quantity !== 0 : !isNaN(quantity) && quantity > 0;
      if (!validQuantity) {
        errors.push(isAdjustment ? 'Invalid quantity (must be non-zero)' : 'Invalid quantity (must be positive)');
      }

      let currentStock: number | undefined;
      if (product) {
        currentStock = stocks.find((s) => s.productId === product.id)?.quantity ?? 0;

        if (typeForValidation === 'OUT' && validQuantity && currentStock < quantity) {
          errors.push(`Exceeds available stock (${currentStock})`);
        }
      }

      return {
        rowNumber: r.rowNumber,
        nameRaw: r.nameRaw,
        sku: r.sku,
        quantityRaw: r.quantityRaw,
        productId: product?.id,
        productName: product?.name,
        quantity: !isNaN(quantity) ? quantity : undefined,
        currentStock,
        errors,
      };
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

      if (lines.length < 2) {
        showError('CSV file must contain a header row and at least one data row');
        setRows([]);
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('product name');
      const skuIdx = headers.indexOf('sku');
      const qtyIdx = headers.indexOf('quantity');

      if ((nameIdx === -1 && skuIdx === -1) || qtyIdx === -1) {
        showError('CSV must have a "name" and/or "sku" column, plus "quantity"');
        setRows([]);
        return;
      }

      const parsed = lines.slice(1).map((line, idx) => {
        const values = line.split(',').map((v) => v.trim());
        return {
          rowNumber: idx + 2,
          nameRaw: nameIdx !== -1 ? (values[nameIdx] || '') : '',
          sku: skuIdx !== -1 ? (values[skuIdx] || '') : '',
          quantityRaw: values[qtyIdx] || '',
        };
      });

      const validated = validateRows(parsed, movementType);
      setRows(validated);

      // Surface name/SKU mismatches as an on-screen error immediately, not just inline
      // in the preview table below, so it can't be missed.
      const mismatches = validated.filter((r) => r.errors.includes('Product name and SKU do not match the same product'));
      if (mismatches.length > 0) {
        const rowList = mismatches.map((r) => r.rowNumber).join(', ');
        showError(`Row${mismatches.length === 1 ? '' : 's'} ${rowList}: product name and SKU do not match the same product. Please fix and re-upload.`);
      }
    };
    reader.onerror = () => {
      showError('Failed to read the CSV file');
    };
    reader.readAsText(file);
  };

  const handleMovementTypeChange = (val: string) => {
    setMovementType(val);
    setReason('');
    setReasonComment('');
    if (rows.length > 0) {
      setRows(validateRows(rows.map((r) => ({ rowNumber: r.rowNumber, nameRaw: r.nameRaw, sku: r.sku, quantityRaw: r.quantityRaw })), val));
    }
  };

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidCount = rows.length - validRows.length;

  const reasonReady = reason && !(reason === 'Other' && !reasonComment);

  const handleSubmit = async () => {
    if (!eventId) {
      showError('No active event selected. Please select an event from the top bar before recording stock movements.');
      return;
    }
    if (validRows.length === 0) {
      showError('No valid rows to process. Fix the errors shown below and re-upload.');
      return;
    }
    if (!reasonReady) {
      showError('Please complete the reason (and shop/comment if required) before uploading.');
      return;
    }

    setIsSubmitting(true);
    inventoryLogger.info('Processing bulk upload stock movement', { rowCount: validRows.length });

    try {
      const finalReason = reason === 'Other' ? `Other: ${reasonComment}` : reason;

      const promises = validRows.map((r) => {
        const payload: any = {
          productId: r.productId,
          movementType,
          quantity: r.quantity,
          reason: finalReason,
        };
        return apiClient.post('/inventory/stock-movements', payload);
      });

      const results = await Promise.all(promises);
      const failedCount = results.filter((res) => !res.ok).length;

      if (failedCount === 0) {
        inventoryLogger.info('Bulk upload stock movement completed successfully');
        showSuccess(`Successfully processed ${validRows.length} stock movement${validRows.length === 1 ? '' : 's'} from CSV`);
        setRows([]);
        setFileName('');
        setFileInputKey((k) => k + 1);
        fetchStocks();
        router.push('/inventory/stock/history?from=new');
      } else {
        inventoryLogger.error('Some bulk upload stock movements failed', { failedCount });
        showError(`${failedCount} of ${validRows.length} stock movements failed. Please try again.`);
        fetchStocks();
      }
    } catch (error) {
      inventoryLogger.error('Bulk upload stock movement error', error);
      showError('Network error occurred while processing bulk upload stock movement');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] sm:max-w-5xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">📤</div>
          Bulk Upload Inventory Addition
        </h3>
        <button
          type="button"
          onClick={downloadSampleCsv}
          className="w-full sm:w-auto px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center justify-center gap-2"
        >
          <span>📥</span> Download Sample CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div>
          <MuiSelect
            label="Movement Type"
            value={movementType}
            onChange={handleMovementTypeChange}
            options={[
              { value: 'IN', label: 'Stock In' },
              { value: 'OUT', label: 'Stock Out' },
            ]}
            required
          />
        </div>
        <div>
          <MuiSelect
            label="Reason"
            value={reason}
            onChange={(val) => {
              setReason(val);
              setReasonComment('');
            }}
            options={movementType === 'OUT'
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
        {reason === 'Other' && (
          <input
            type="text"
            placeholder="Enter comment *"
            value={reasonComment}
            onChange={(e) => setReasonComment(e.target.value)}
            className="w-full pl-4 pr-4 py-2.5 bg-transparent border border-slate-200 hover:border-slate-400 rounded-2xl text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/15 transition-all duration-200 text-slate-900 placeholder:text-slate-400 animate-fade-in-up"
            style={{ minHeight: '42px' }}
            required
          />
        )}
      </div>

      <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-xl p-8 text-center hover:bg-indigo-50/60 transition-colors mb-6">
        <label className="cursor-pointer block">
          <span className="text-4xl mb-4 block">📄</span>
          <span className="block text-sm font-semibold text-indigo-700 mb-2">Click to select CSV File</span>
          <span className="block text-xs text-gray-500 mb-4">{fileName || 'No file chosen'}</span>
          <input key={fileInputKey} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        </label>
        <div className="text-xs text-gray-400 bg-white inline-block px-3 py-2 rounded-lg border border-gray-100 mt-2">
          <strong>Format:</strong> name,sku,quantity — fill name, sku, or both (both must match the same product)
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm font-semibold text-gray-600">
              {validRows.length} of {rows.length} row{rows.length === 1 ? '' : 's'} ready to process
              {invalidCount > 0 && <span className="text-red-500"> · {invalidCount} with errors</span>}
              {!reasonReady && <span className="text-amber-500"> · Complete the Reason (and Shop/Comment if required) to enable upload</span>}
            </p>
          </div>

          <div className="border border-indigo-100 rounded-xl overflow-hidden shadow-inner mb-6">
            <div className="hidden sm:block bg-indigo-50/50 p-3 border-b border-indigo-100">
              <div className="grid grid-cols-[0.5fr_2fr_1fr_1fr_1fr_2fr] gap-3 font-bold text-xs text-indigo-900 uppercase tracking-wider">
                <div>Row</div>
                <div>Product (SKU)</div>
                <div className="text-center">Qty</div>
                <div className="text-center">Current Stock</div>
                <div className="text-center">Status</div>
                <div>Details</div>
              </div>
            </div>
            <div className="max-h-[45vh] overflow-y-auto bg-white divide-y divide-gray-50">
              {rows.map((row) => (
                <div key={row.rowNumber} className={`p-3 text-sm ${row.errors.length > 0 ? 'bg-red-50/40' : ''}`}>
                  <div className="hidden sm:grid grid-cols-[0.5fr_2fr_1fr_1fr_1fr_2fr] gap-3 items-center">
                    <div className="text-gray-400">{row.rowNumber}</div>
                    <div>
                      <div className="font-semibold text-gray-800">{row.productName || row.nameRaw || '—'}</div>
                      <div className="text-xs text-gray-400 font-mono">{row.sku || (row.nameRaw ? '(matched by name)' : '')}</div>
                    </div>
                    <div className="text-center font-bold text-gray-700">{row.quantity ?? row.quantityRaw}</div>
                    <div className="text-center text-gray-600">{row.currentStock ?? '—'}</div>
                    <div className="text-center">
                      {row.errors.length === 0 ? (
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold border bg-green-50 text-green-600 border-green-200">✅ Ready</span>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold border bg-red-50 text-red-600 border-red-200">❌ Error</span>
                      )}
                    </div>
                    <div className="text-xs text-red-500">{row.errors.join('; ')}</div>
                  </div>

                  {/* Mobile view */}
                  <div className="sm:hidden flex flex-col gap-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-gray-800">{row.productName || row.nameRaw || '—'}</div>
                        <div className="text-xs text-gray-400 font-mono">{row.sku}</div>
                      </div>
                      {row.errors.length === 0 ? (
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold border bg-green-50 text-green-600 border-green-200">✅</span>
                      ) : (
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold border bg-red-50 text-red-600 border-red-200">❌</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">Qty: {row.quantity ?? row.quantityRaw} · Stock: {row.currentStock ?? '—'}</div>
                    {row.errors.length > 0 && <div className="text-xs text-red-500">{row.errors.join('; ')}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="border-t border-gray-100 pt-5 flex flex-col sm:flex-row justify-end gap-3">
        <button
          type="button"
          onClick={() => setAddForm(false)}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || validRows.length === 0 || !reasonReady}
          className="w-full sm:w-auto bg-indigo-600 text-white px-8 py-2.5 rounded-xl hover:bg-indigo-700 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>...</span>
            </>
          ) : (
            <span>Upload &amp; Process{validRows.length > 0 ? ` (${validRows.length})` : ''}</span>
          )}
        </button>
      </div>

      {reason && (
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-800 flex items-start gap-2.5 animate-fade-in-up">
          <span className="text-sm">💡</span>
          <div>
            {reason === 'From Ashram' && (
              <p><strong>From Ashram:</strong> Stock received from the Ashram and added to the main inventory.</p>
            )}
            {reason === 'From Store' && (
              <p><strong>From Store:</strong> General stock replenishment sourced directly from the main store repository.</p>
            )}
            {reason === 'Other' && (
              <p><strong>Other:</strong> Custom stock adjustment (e.g. Damage, Audit correction, Theft). Type the specific explanation in the comment box.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
