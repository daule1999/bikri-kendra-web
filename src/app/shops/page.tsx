'use client';

import { useEffect, useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { SHOPS_PAGE_KEYS } from '@/lib/pageInitKeys';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function ShopsPage() {
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    shopName: '',
    categoryId: '',
    categoryName: '',
    counterNumber: '',
    eventId: '',
    isActive: true
  });

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchShops = async () => {
    try {
      const response = await apiClient.get('/shops');
      if (response.ok) {
        const data = await response.json();
        setShops(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    }
  };

  const resetForm = () => {
    setFormData({ shopName: '', categoryId: '', categoryName: '', counterNumber: '', eventId: '', isActive: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const shopData = {
        shopName: formData.shopName,
        categoryId: parseInt(formData.categoryId),
        categoryName: formData.categoryName,
        counterNumber: parseInt(formData.counterNumber),
        eventId: formData.eventId ? parseInt(formData.eventId) : undefined,
        isActive: formData.isActive,
      };
      const response = await apiClient.post('/shops/register', shopData);
      if (response.ok) {
        setToastMessage('Shop registered');
        setShowToast(true);
        setShowModal(false);
        resetForm();
        fetchShops();
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.message || 'Failed to register shop');
        setShowErrorModal(true);
      }
    } catch {
      setErrorMessage('Network error occurred');
      setShowErrorModal(true);
    }
  };

  // ── Page init on mount ───────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiClient.get(`/page-init?include=${SHOPS_PAGE_KEYS.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          if (data.shops) setShops(Array.isArray(data.shops) ? data.shops : []);
          if (data.categories) setCategories(Array.isArray(data.categories) ? data.categories : []);
          if (data.events) setEvents(Array.isArray(data.events) ? data.events : []);
        }
      } catch (e) {
        console.error('Error fetching page-init data for shops page', e);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in-up p-4 sm:p-6">

        {/* Welcome Banner */}
        <section className="relative rounded-2xl p-6 sm:p-8 text-white"
          style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #3B82F6 100%)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#93C5FD' }}>Counter & Stall Management</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shop Management</h1>
            </div>
            <div className="flex gap-4 sm:gap-6 items-center">
              <div className="text-center hidden sm:block">
                <p className="text-2xl font-bold">{`${shops.filter((shop) => shop.isActive).length}/${shops.length}`}</p>
                <p className="text-xs mt-0.5" style={{ color: '#93C5FD' }}>Active Shops</p>
              </div>
              <div className="hidden sm:block w-px h-10" style={{ background: 'rgba(147,197,253,0.2)' }} />
              <button
                onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-sm hover:-translate-y-0.5 flex items-center justify-center gap-2 text-blue-700 hover:text-blue-800"
                style={{ background: 'var(--theme-surface)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Register Shop
              </button>
            </div>
          </div>
        </section>

        {/* Shops Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto min-h-[400px] pb-20">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50/80 border-b border-gray-100">
                <tr>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Shop Name</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Category</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Counter</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Status</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">Shift</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-600">
                    <span className="text-xs text-gray-400 font-normal">Click row to manage →</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shops.length > 0 ? (
                  shops.map((shop) => (
                    <tr
                      key={shop.id}
                      onClick={() => router.push(`/shops/${shop.id}`)}
                      className="hover:bg-blue-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                        {shop.shopName}
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {categories.find(c => c.id === shop.categoryId)?.name || shop.categoryName || 'N/A'}
                      </td>
                      <td className="p-4 text-sm font-medium text-gray-700">Counter {shop.counterNumber}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${shop.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {shop.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1 w-fit ${shop.shiftOpen ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${shop.shiftOpen ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {shop.shiftOpen ? 'Open' : 'Closed'}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-gray-400 group-hover:text-blue-500 flex items-center gap-1 transition-colors">
                          Manage
                          <svg className="w-3.5 h-3.5 -translate-x-0.5 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-8 text-gray-400 text-center text-sm" colSpan={6}>
                      No shops found. Register your first shop above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Register Shop Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up border border-indigo-50 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🏪</div>
              Register Shop
            </h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="text"
                placeholder="Shop Name *"
                value={formData.shopName}
                onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                required
              />
              <MuiSelect
                label="Category"
                value={formData.categoryId}
                onChange={(val) => {
                  const selected = categories.find(c => String(c.id) === String(val));
                  setFormData({ ...formData, categoryId: val, categoryName: selected?.name || '' });
                }}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                required
              />
              <input
                type="number"
                placeholder="Counter Number *"
                value={formData.counterNumber}
                onChange={(e) => setFormData({ ...formData, counterNumber: e.target.value })}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                min="1"
                required
              />
              <MuiSelect
                label="Event"
                value={formData.eventId}
                onChange={(val) => setFormData({ ...formData, eventId: val })}
                options={events.map(e => ({ value: e.id, label: e.eventName || e.name }))}
              />
              <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-gray-700">Active Shop</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-3.5 rounded-xl hover:bg-gray-200 font-bold transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formData.shopName.trim() || !formData.categoryId || !formData.counterNumber}
                  className="flex-1 bg-indigo-600 text-white px-4 py-3.5 rounded-xl hover:bg-indigo-700 font-bold transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  Register Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm text-center">
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <h3 className="text-lg font-semibold mb-2">Success!</h3>
            <p className="text-gray-600 mb-4">{successMessage}</p>
            <button onClick={() => setShowSuccessModal(false)} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">OK</button>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-red-600 text-4xl mb-4">✗</div>
            <h3 className="text-lg font-semibold mb-2">Error!</h3>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button onClick={() => setShowErrorModal(false)} className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 font-semibold">OK</button>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-fade-in">
          <div className="bg-emerald-600 text-white shadow-xl px-6 py-3 rounded-full flex items-center gap-2 font-semibold text-sm border border-emerald-500/20">
            <span className="text-base">✓</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
