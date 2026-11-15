'use client';

import { useQueryId } from '@/lib/routeParams';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { ContentLoader } from '@/components/ui/ContentLoader';

import ShopHeader from './components/ShopHeader';
import ShopMenu from './components/ShopMenu';
import HistoryTab from './components/HistoryTab';
import StaffTab from './components/StaffTab';
import StockTab from './components/StockTab';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

// ── Types ───────────────────────────────────────────────────────────────────

interface ShiftSession {
  id: number;
  status: string;
  openedAt: string;
}

type TabId = 'history' | 'staff' | 'stock';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'history', label: 'History', icon: '📋' },
  { id: 'staff',   label: 'Staff',   icon: '👥' },
  { id: 'stock',   label: 'Stock',   icon: '📦' },
];

// ── Inner component (needs Suspense for useSearchParams) ─────────────────────

function ShopDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = Number(useQueryId('id'));

  // ── Core data ──────────────────────────────────────────────────────────────
  const [shop, setShop] = useState<any>(null);
  const [shopError, setShopError] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingShop, setLoadingShop] = useState(true);

  // ── Shift ──────────────────────────────────────────────────────────────────
  const [activeShift, setActiveShift] = useState<ShiftSession | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);

  // ── Tab state ──────────────────────────────────────────────────────────────
  const tabParam = (searchParams.get('tab') as TabId) || 'history';
  const [activeTab, setActiveTab] = useState<TabId>(tabParam);

  // ── History ────────────────────────────────────────────────────────────────
  const [historyData, setHistoryData] = useState<any>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const historyFetchingRef = useRef(false); // ref guard — no re-render, no loop

  // ── Staff ──────────────────────────────────────────────────────────────────
  const [shopStaff, setShopStaff] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [unassigningStaff, setUnassigningStaff] = useState(false);

  // ── Stock ──────────────────────────────────────────────────────────────────
  const [stocks, setStocks] = useState<any[]>([]);
  const [stockLoaded, setStockLoaded] = useState(false); // FIX #4: flag separate from data for reliable cache/invalidation
  const [loadingStocks, setLoadingStocks] = useState(false);

  // ── Unissue ────────────────────────────────────────────────────────────────
  const [showUnissueModal, setShowUnissueModal] = useState(false);
  const [unissueStockList, setUnissueStockList] = useState<any[]>([]);
  const [unissueQtys, setUnissueQtys] = useState<Record<number, number>>({});
  const [unissueReason, setUnissueReason] = useState('');
  const [loadingUnissue, setLoadingUnissue] = useState(false);
  const [submittingUnissue, setSubmittingUnissue] = useState(false);

  // ── Edit modal ─────────────────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    shopName: '', categoryId: '', categoryName: '', counterNumber: '', eventId: '', isActive: true,
    receivingPrintEnabled: false,
  });

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // FIX #8: track whether the shop was closed so redirect is reliable, not based on string parsing
  const shopWasClosedRef = useRef(false);

  // ── Roles ──────────────────────────────────────────────────────────────────
  const [canUnissue, setCanUnissue] = useState(false);
  const [canManageShift, setCanManageShift] = useState(false);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showError = (msg: string) => { setErrorMessage(msg); setShowErrorModal(true); };
  const fireToast = (msg: string) => { setToastMessage(msg); setShowToast(true); };

  const setTab = (tab: TabId) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    router.replace(url.pathname + url.search, { scroll: false });
  };

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    const role = localStorage.getItem('userRole') || '';
    const isAdmin = role === 'ADMIN' || role === 'ACCOUNTS';
    const isSupervisor = role === 'SHOP_SUPERVISOR';
    setCanUnissue(isAdmin || isSupervisor);
    setCanManageShift(isAdmin || isSupervisor);
  }, []);

  // FIX #2: fetch shop by ID directly instead of loading all shops and filtering
  const fetchShop = useCallback(async () => {
    setLoadingShop(true);
    setShopError('');
    try {
      const res = await apiClient.get(`/shops/${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setShop(data);
      } else if (res.status === 404) {
        setShopError('Shop not found.');
      } else {
        setShopError('Failed to load shop. Please try again.');
      }
    } catch {
      setShopError('Network error loading shop. Please try again.');
    } finally {
      setLoadingShop(false);
    }
  }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchActiveShift = useCallback(async () => {
    setLoadingShift(true);
    try {
      const res = await apiClient.get(`/shifts/active/${shopId}`);
      if (res.status === 204 || res.status === 404) {
        setActiveShift(null);
      } else if (res.ok) {
        const text = await res.text();
        setActiveShift(text?.trim() ? JSON.parse(text) : null);
      } else {
        setActiveShift(null);
      }
    } catch {
      setActiveShift(null);
    } finally {
      setLoadingShift(false);
    }
  }, [shopId]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get('/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(Array.isArray(data.data) ? data.data : []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await apiClient.get('/sales/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(Array.isArray(data) ? data : []);
      }
    } catch { /* non-critical */ }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const username = localStorage.getItem('username') || '';
      const res = await apiClient.get('/users/allUsers', { 'X-Username': username, 'X-Roles': 'ADMIN' });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (!shopId) return;
    fetchShop();
    fetchActiveShift();
    fetchCategories();
    fetchEvents();
    fetchUsers();
  }, [shopId, fetchShop, fetchActiveShift, fetchCategories, fetchEvents, fetchUsers]);

  // ── Tab data loaders ───────────────────────────────────────────────────────
  // Always fetch on tab activation. ref guard prevents concurrent duplicate calls.
  const fetchHistory = useCallback(async () => {
    if (historyFetchingRef.current) return;
    historyFetchingRef.current = true;
    setLoadingHistory(true);
    try {
      const res = await apiClient.get(`/shops/${shopId}/history`);
      if (res.ok) {
        setHistoryData(await res.json());
        setHistoryLoaded(true);
      }
    } catch { /* non-critical */ }
    finally {
      setLoadingHistory(false);
      historyFetchingRef.current = false;
    }
  }, [shopId]);

  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await apiClient.get(`/shops-staff/${shopId}`);
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data) ? data : [];
        setShopStaff(arr.map((s: any) => ({
          ...s,
          userDetails: users.find(u => u.id === s.userId) || null
        })));
      }
    } catch { /* non-critical */ }
    finally { setLoadingStaff(false); }
  }, [shopId, users]);

  // FIX #4: guard by stockLoaded flag, not stocks.length, so invalidation via setStockLoaded(false) works reliably
  const fetchStocks = useCallback(async () => {
    if (stockLoaded) return;
    setLoadingStocks(true);
    try {
      const res = await apiClient.get(`/sales/retail/stocks/${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setStocks(Array.isArray(data) ? data : []);
        setStockLoaded(true);
      }
    } catch { /* non-critical */ }
    finally { setLoadingStocks(false); }
  }, [shopId, stockLoaded]);

  // Load tab data when tab is active
  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'staff')   fetchStaff();
    if (activeTab === 'stock')   fetchStocks();
  }, [activeTab, fetchHistory, fetchStaff, fetchStocks]);

  // Re-enrich staff when users arrive after staff was already fetched
  useEffect(() => {
    if (shopStaff.length > 0 && users.length > 0) {
      setShopStaff(prev => prev.map(s => ({
        ...s,
        userDetails: users.find(u => u.id === s.userId) || s.userDetails || null
      })));
    }
  }, [users]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toast auto-hide
  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAssignStaff = async (userId: string) => {
    setAssigningStaff(true);
    try {
      const res = await apiClient.post('/shops-staff/assign', { shopId, userId: parseInt(userId) });
      if (res.ok) {
        fireToast('Staff assigned successfully');
        await fetchStaff(); // fetchStaff has no cache guard — always re-fetches
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.message || 'Failed to assign staff.');
        throw new Error('assign failed'); // FIX #5: propagate so StaffTab doesn't close modal
      }
    } catch (e: any) {
      if (!e?.message?.includes('assign failed')) showError('Network error during staff assignment.');
      throw e; // re-throw so StaffTab.handleSubmit knows to keep modal open
    } finally {
      setAssigningStaff(false);
    }
  };

  const handleUnassignStaff = async (userId: number) => {
    setUnassigningStaff(true);
    try {
      // Backend endpoint: DELETE /api/sales-svc/shops-staff/user/{userId}
      const res = await apiClient.delete(`/shops-staff/user/${userId}`);
      if (res.ok) {
        // Optimistically remove from list — don't re-fetch immediately as backend
        // may not have committed yet (causes stale data to overwrite the removal)
        setShopStaff(prev => prev.filter(s => s.userId !== userId));
        fireToast('Staff unassigned successfully');
        // Fire force-logout in background — don't block UI or show error if it fails
        apiClient.post(`/auth/force-logout/${userId}`, {}).catch(() => {
          console.warn('[UnassignStaff] Force logout call failed for userId:', userId);
        });
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.message || 'Failed to unassign staff.');
        throw new Error('unassign failed');
      }
    } catch (e: any) {
      if (!e?.message?.includes('unassign failed')) showError('Network error during staff unassignment.');
      throw e;
    } finally {
      setUnassigningStaff(false);
    }
  };

  const handleOpenUnissue = async () => {
    setUnissueQtys({});
    setUnissueReason('');
    setUnissueStockList([]);
    setShowUnissueModal(true);
    setLoadingUnissue(true);
    try {
      const res = await apiClient.get(`/sales/retail/stocks/${shopId}`);
      if (res.ok) {
        const data = await res.json();
        setUnissueStockList((Array.isArray(data) ? data : []).filter((s: any) => s.shopStock > 0));
      }
    } catch { /* non-critical */ }
    finally { setLoadingUnissue(false); }
  };

  const handleUnissueSubmit = async () => {
    const items = Object.entries(unissueQtys)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({
        productId: parseInt(productId),
        quantity,
        reason: unissueReason.trim() || 'Manual unissue by supervisor',
      }));

    if (items.length === 0) { showError('Select at least one product with quantity > 0.'); return; }
    setSubmittingUnissue(true);
    try {
      const res = await apiClient.post(`/shops/${shopId}/unissue`, items);
      if (res.ok) {
        setShowUnissueModal(false);
        fireToast(`Stock returned to inventory from ${shop?.shopName}.`);
        // FIX #4: invalidate stock cache with flag, not by clearing array
        setStockLoaded(false);
        setStocks([]);
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.message || 'Unissue failed.');
      }
    } catch { showError('Network error during unissue.'); }
    finally { setSubmittingUnissue(false); }
  };

  const handleOpenEdit = () => {
    if (!shop) return;
    setEditForm({
      shopName: shop.shopName,
      categoryId: shop.categoryId?.toString() || '',
      categoryName: shop.categoryName || '',
      counterNumber: shop.counterNumber?.toString() || '',
      eventId: shop.eventId?.toString() || '',
      isActive: shop.isActive,
      receivingPrintEnabled: shop.receivingPrintEnabled ?? false,
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiClient.put(`/shops/${shopId}`, {
        shopName: editForm.shopName,
        categoryId: parseInt(editForm.categoryId),
        categoryName: editForm.categoryName,
        counterNumber: parseInt(editForm.counterNumber),
        eventId: editForm.eventId ? parseInt(editForm.eventId) : undefined,
        isActive: editForm.isActive,
        receivingPrintEnabled: editForm.receivingPrintEnabled,
      });
      if (res.ok) {
        setShowEditModal(false);
        fireToast('Shop updated successfully');
        await fetchShop();
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.message || 'Failed to update shop.');
      }
    } catch { showError('Network error occurred.'); }
  };

  // FIX #3: removed double state-set (showSuccess helper + direct setState)
  // FIX #8: use a ref to track closure so redirect doesn't rely on string parsing
  const handleCloseShop = () => setShowCloseConfirm(true);

  const confirmCloseShop = async () => {
    setShowCloseConfirm(false);
    try {
      const res = await apiClient.delete(`/shops/${shopId}`);
      if (res.ok) {
        shopWasClosedRef.current = true;
        setSuccessMessage(`Shop "${shop?.shopName}" has been closed.`);
        setShowSuccessModal(true);
      } else {
        const err = await res.json().catch(() => ({}));
        showError(err.message || 'Failed to close shop.');
      }
    } catch { showError('Network error while closing shop.'); }
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const resolvedCategory = categories.find(c => c.id === shop?.categoryId)?.name || shop?.categoryName || '';
  const resolvedEvent = events.find(e => e.id === shop?.eventId)?.eventName || shop?.eventName || '';
  const shiftIsOpen = activeShift?.status === 'OPEN';

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingShop) {
    return (
      <AppLayout>
        <ContentLoader message="Loading shop details..." />
      </AppLayout>
    );
  }

  if (shopError) {
    return (
      <AppLayout>
        <div className="max-w-7xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-lg font-bold text-gray-800">{shopError}</h2>
          <button
            onClick={() => router.push('/shops')}
            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            ← Back to Shops
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!shop) return null;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-5 animate-fade-in-up p-4 sm:p-6">

        <ShopHeader
          shop={shop}
          categoryName={resolvedCategory}
          eventName={resolvedEvent}
          activeShift={activeShift}
          loadingShift={loadingShift}
        />

        {/* Tab bar + menu row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <ShopMenu
            shopId={shopId}
            shopIsActive={shop.isActive}
            shiftIsOpen={shiftIsOpen}
            canManageShift={canManageShift}
            onEditShop={handleOpenEdit}
            onCloseShop={handleCloseShop}
          />
        </div>

        {/* Tab content */}
        <div className="card p-6">
          {activeTab === 'history' && (
            <HistoryTab
              historyData={historyData}
              loading={loadingHistory}
              users={users}
            />
          )}
          {activeTab === 'staff' && (
            <StaffTab
              shopName={shop.shopName}
              staff={shopStaff}
              users={users}
              onAssignSubmit={handleAssignStaff}
              submitting={assigningStaff}
              onUnassignSubmit={handleUnassignStaff}
              unassigning={unassigningStaff}
            />
          )}
          {activeTab === 'stock' && (
            <StockTab
              shopName={shop.shopName}
              stocks={stocks}
              loadingStocks={loadingStocks}
              canUnissue={canUnissue}
              onUnissue={handleOpenUnissue}
            />
          )}
        </div>
      </div>

      {/* ── Edit Shop Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 sm:p-8 rounded-2xl w-full max-w-md shadow-2xl animate-fade-in-up border border-indigo-50 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">✏️</div>
              Edit Shop
            </h3>
            <form onSubmit={handleEditSubmit} className="space-y-5">
              <input
                type="text"
                placeholder="Shop Name *"
                value={editForm.shopName}
                onChange={e => setEditForm({ ...editForm, shopName: e.target.value })}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                required
              />
              <MuiSelect
                label="Category"
                value={editForm.categoryId}
                onChange={(val) => {
                  const selected = categories.find(c => String(c.id) === String(val));
                  setEditForm({ ...editForm, categoryId: val, categoryName: selected?.name || '' });
                }}
                options={categories.map(c => ({ value: c.id, label: c.name }))}
                required
              />
              <input
                type="number"
                placeholder="Counter Number *"
                value={editForm.counterNumber}
                onChange={e => setEditForm({ ...editForm, counterNumber: e.target.value })}
                className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-shadow"
                min="1"
                required
              />
              <MuiSelect
                label="Event"
                value={editForm.eventId}
                onChange={(val) => setEditForm({ ...editForm, eventId: val })}
                options={events.map(e => ({ value: e.id, label: e.eventName || e.name }))}
              />
              <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 bg-white border-gray-300 rounded focus:ring-indigo-500"
                />
                <span className="text-sm font-semibold text-gray-700">Active Shop</span>
              </label>
              <label className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                <input
                  type="checkbox"
                  checked={editForm.receivingPrintEnabled}
                  onChange={e => setEditForm({ ...editForm, receivingPrintEnabled: e.target.checked })}
                  className="mt-0.5 w-4 h-4 text-amber-600 bg-white border-amber-300 rounded focus:ring-amber-500"
                />
                <div>
                  <span className="text-sm font-semibold text-amber-800 block">Print Receiving Slip</span>
                  <span className="text-xs text-amber-600">
                    Prints a second slip (Bill No, Date, Seller, Items with SKU) after each sale.
                    Requires event-level receiving print to also be enabled.
                  </span>
                </div>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-3.5 rounded-xl hover:bg-gray-200 font-bold transition-colors">
                  Cancel
                </button>
                <button type="submit"
                  disabled={!editForm.shopName.trim() || !editForm.categoryId || !editForm.counterNumber}
                  className="flex-1 bg-indigo-600 text-white px-4 py-3.5 rounded-xl hover:bg-indigo-700 font-bold transition-all shadow-md hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  Update Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Unissue Stock Modal ── */}
      {showUnissueModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Unissue Stock</h3>
                <p className="text-sm text-gray-500 mt-0.5">Return counter stock to main inventory — {shop?.shopName}</p>
              </div>
              <button onClick={() => setShowUnissueModal(false)}
                className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 text-lg">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingUnissue ? (
                <ContentLoader message="Loading counter stock..." />
              ) : unissueStockList.length === 0 ? (
                <p className="text-center text-gray-500 py-16">No stock available to return at this counter.</p>
              ) : (
                <div className="space-y-4">
                  <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚠️ Shift must be closed before unissuing. Stock will be moved back to main inventory.
                  </div>
                  <div className="overflow-x-auto w-full">
                  <table className="w-full min-w-[500px] text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-3 font-semibold text-gray-600 rounded-tl-lg">Product</th>
                        <th className="p-3 font-semibold text-gray-600 text-center">At Counter</th>
                        <th className="p-3 font-semibold text-gray-600 text-center rounded-tr-lg">Return Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {unissueStockList.map((s: any) => (
                        <tr key={s.id}>
                          <td className="p-3">
                            <p className="font-semibold text-gray-900">{s.name}</p>
                            <p className="text-xs text-gray-400">{s.sku}</p>
                          </td>
                          <td className="p-3 text-center font-bold text-gray-700">{s.shopStock}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number" min={0} max={s.shopStock}
                              value={unissueQtys[s.id] ?? 0}
                              onChange={e => setUnissueQtys(prev => ({
                                ...prev,
                                [s.id]: Math.min(Math.max(0, parseInt(e.target.value) || 0), s.shopStock)
                              }))}
                              className="w-20 text-center border border-gray-200 rounded-lg p-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <input
                    type="text" placeholder="Reason (optional)"
                    value={unissueReason}
                    onChange={e => setUnissueReason(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex gap-3 justify-end rounded-b-2xl">
              <button onClick={() => setShowUnissueModal(false)}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleUnissueSubmit}
                disabled={submittingUnissue || loadingUnissue || unissueStockList.length === 0}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {submittingUnissue ? 'Returning...' : 'Return to Inventory'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Close Shop Confirm Dialog ── */}
      <ConfirmDialog
        open={showCloseConfirm}
        title={`Close "${shop?.shopName}"?`}
        message="This soft-deletes the shop and releases all active staff assignments. This action cannot be undone."
        confirmLabel="Close Shop"
        cancelLabel="Keep Open"
        variant="danger"
        onConfirm={confirmCloseShop}
        onCancel={() => setShowCloseConfirm(false)}
      />

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-sm text-center">
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <h3 className="text-lg font-semibold mb-2">Success!</h3>
            <p className="text-gray-600 mb-4">{successMessage}</p>
            {/* FIX #8: use ref to decide redirect, not string parsing */}
            <button
              onClick={() => {
                setShowSuccessModal(false);
                if (shopWasClosedRef.current) router.push('/shops');
              }}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Error Modal ── */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 p-6 rounded-2xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-red-600 text-4xl mb-4">✗</div>
            <h3 className="text-lg font-semibold mb-2">Error!</h3>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button onClick={() => setShowErrorModal(false)}
              className="bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 font-semibold">
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
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

// FIX #1: wrap in Suspense — required by Next.js App Router for useSearchParams
export default function ShopDetailPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <ContentLoader message="Loading shop..." />
      </AppLayout>
    }>
      <ShopDetailContent />
    </Suspense>
  );
}
