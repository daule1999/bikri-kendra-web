'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SingleMovementForm from './components/SingleMovementForm';
import BulkMovementForm from './components/BulkMovementForm';
import BulkUploadMovementForm from './components/BulkUploadMovementForm';
import StockOverviewList from './components/StockOverviewList';

export default function StockPage() {
  return (
    <Suspense fallback={null}>
      <StockPageContent />
    </Suspense>
  );
}

function StockPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stockTab, setStockTab] = useState('single');
  const [addForm, setAddForm] = useState(false);

  // Supports deep-linking straight into the "Add Stock" form, e.g. from the Inventory
  // History page's back link (?new=1), instead of always landing on the overview list.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAddForm(true);
      setStockTab('single');
      // Strip the query param so Cancel/browser-back doesn't keep re-opening the form.
      router.replace('/inventory/stock');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="w-full max-w-full">
      {/* Sub Tabs (Only visible when adding stock) */}
      {addForm && (
        <div className="flex justify-between items-center flex-wrap gap-3 mb-4 sm:mb-6">
          <div className="flex border border-indigo-100 bg-gray-50/80 rounded-xl p-1.5 w-fit max-w-full overflow-x-auto">
            <button
              onClick={() => setStockTab('single')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${stockTab === 'single' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Single Movement
            </button>
            <button
              onClick={() => setStockTab('bulk')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${stockTab === 'bulk' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Bulk Movement
            </button>
            <button
              onClick={() => setStockTab('bulk-upload')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${stockTab === 'bulk-upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Bulk Upload
            </button>
          </div>
          <button
            onClick={() => setAddForm(false)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            ← Back to Inventory dashboard
          </button>
        </div>
      )}

      {/* Forms or Stock Overview List in full width */}
      {addForm ? (
        <div className="w-full space-y-6">
          {/* Single Stock Movement */}
          <div className={stockTab === 'single' ? 'block animate-fade-in-up' : 'hidden'}>
            <SingleMovementForm setAddForm={setAddForm} />
          </div>

          {/* Bulk Stock Movement */}
          <div className={stockTab === 'bulk' ? 'block animate-fade-in-up' : 'hidden'}>
            <BulkMovementForm setAddForm={setAddForm} />
          </div>

          {/* Bulk Upload (CSV) Stock Movement */}
          <div className={stockTab === 'bulk-upload' ? 'block animate-fade-in-up' : 'hidden'}>
            <BulkUploadMovementForm setAddForm={setAddForm} />
          </div>
        </div>
      ) : (
        <div className="w-full animate-fade-in-up">
          <StockOverviewList setAddForm={setAddForm} />
        </div>
      )}
    </div>
  );
}
