'use client';

import { formatISTDateTime } from '@/lib/dateUtils';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import AppLayout from '@/components/layout/AppLayout';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { RefreshIcon } from '@/components/ui/Icons';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useShop } from '@/hooks/useShop';
import { ContentLoader } from '@/components/ui/ContentLoader';

interface Shop {
  id: number;
  shopName: string;
  counterNumber: number;
}

interface ShiftSession {
  id: number;
  shopId: number;
  eventId: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingCashBalance: number;
  expectedClosingCash: number;
  actualClosingCash: number;
  expectedClosingOnline?: number;
  actualClosingOnline?: number;
  openedByUserId: number;
  closedByUserId: number | null;
}

interface Denomination {
  value: number;
  count: number;
}

const DEFAULT_DENOMINATIONS = [
  { value: 500, count: 0 },
  { value: 200, count: 0 },
  { value: 100, count: 0 },
  { value: 50, count: 0 },
  { value: 20, count: 0 },
  { value: 10, count: 0 },
  { value: 5, count: 0 },
  { value: 2, count: 0 },
  { value: 1, count: 0 },
];

function ShiftsContent() {
  const { eventId } = useActiveEvent();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryShopId = searchParams.get('shopId');
  const { assignedShops, loading: shopsLoading, isAdmin, refreshShops } = useShop();
  const [selectedShopId, setSelectedShopId] = useState<number | null>(null);
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [history, setHistory] = useState<ShiftSession[]>([]);
  // Total mid-shift float added, per shift id (for the "Opening + Float" column of the ledger).
  const [floatByShift, setFloatByShift] = useState<Record<number, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pagination for Shift History
  const [historyPage, setHistoryPage] = useState(0);
  const [historySize] = useState(50);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);

  // Reconcile Modal State
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileShiftId, setReconcileShiftId] = useState<number | null>(null);
  const [reconcileComment, setReconcileComment] = useState('');

  // Shift opening state
  const [openDenominations, setOpenDenominations] = useState<Denomination[]>(DEFAULT_DENOMINATIONS);
  const [openingCash, setOpeningCash] = useState(0);

  // Shift closing state
  const [closeDenominations, setCloseDenominations] = useState<Denomination[]>(DEFAULT_DENOMINATIONS);
  const [actualClosingCash, setActualClosingCash] = useState(0);
  const [actualClosingOnline, setActualClosingOnline] = useState(0);
  const [addCashModalOpen, setAddCashModalOpen] = useState(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [isRefreshingCash, setIsRefreshingCash] = useState(false);
  const [addDenominations, setAddDenominations] = useState<Denomination[]>(DEFAULT_DENOMINATIONS);
  const [addedCashTotal, setAddedCashTotal] = useState(0);
  const [activeDenominations, setActiveDenominations] = useState<any[]>([]);

  useEffect(() => {
    if (activeSession) {
      setActualClosingOnline(activeSession.expectedClosingOnline || 0);
    } else {
      setActualClosingOnline(0);
    }
  }, [activeSession]);

  // Access and assignments state
  const [canReconcile, setCanReconcile] = useState(false);
  // Issue 7 fix: canManageShift controls Open Shift and Close Shift actions.
  // CASHIER and BILLING_OPERATOR can VIEW the shifts page but cannot open or close shifts.
  const [canManageShift, setCanManageShift] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await refreshShops();
    }
    initialize();
  }, [refreshShops])

  useEffect(() => {
    const initialize = async () => {
      const username = typeof window !== 'undefined' ? localStorage.getItem('username') : '';
      const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
      let activeRoles: string[] = [];
      logger.info('Shift Page', 'here 1', username);
      if (!isAdmin && username) {
        // Fetch user information to get their userId and latest roles
        const userResponse = await apiClient.get(`/users/${username}`);
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.roles) {
            activeRoles = Array.isArray(userData.roles)
              ? userData.roles
              : Array.from(userData.roles);

            // Sync userRole to local storage so other parts of the app are updated
            if (activeRoles.length > 0) {
              localStorage.setItem('userRole', activeRoles[0]);
              window.dispatchEvent(new CustomEvent('bikri-role-change'));
            }
          }
        }
      }

      // Check access permission based on latest dynamic roles
      const hasSupervisorRole = userRole === 'SHOP_SUPERVISOR' || activeRoles.includes('SHOP_SUPERVISOR');
      const hasCashierOrBillingRole = userRole === 'CASHIER' || userRole === 'BILLING_OPERATOR' || activeRoles.includes('CASHIER') || activeRoles.includes('BILLING_OPERATOR');

      setCanReconcile((isAdmin || hasSupervisorRole) && !hasCashierOrBillingRole);
      // Issue 7 fix: same role set as canReconcile — only ADMIN and SHOP_SUPERVISOR can open/close shifts
      setCanManageShift((isAdmin || hasSupervisorRole) && !hasCashierOrBillingRole);

      if (assignedShops.length > 0) {
        if (queryShopId) {
          const matchedShop = assignedShops.find(s => s.id.toString() === queryShopId);
          if (matchedShop) {
            setSelectedShopId(matchedShop.id);
          } else {
            setSelectedShopId(assignedShops[0].id);
          }
        } else {
          setSelectedShopId(assignedShops[0].id);
        }
      }
    };
    initialize();
  }, [eventId, isAdmin, assignedShops, queryShopId])

  // Load active session when shop changes
  useEffect(() => {
    if (selectedShopId && eventId) {
      fetchActiveSession();
    } else {
      setActiveSession(null);
    }
  }, [selectedShopId, eventId]);

  // Load history when shop changes or page changes
  useEffect(() => {
    if (selectedShopId && eventId) {
      fetchShiftHistory();
    } else {
      setHistory([]);
    }
  }, [selectedShopId, eventId, historyPage]);

  // Reset page when shop changes
  useEffect(() => {
    setHistoryPage(0);
  }, [selectedShopId]);

  // Sum up opening cash dynamically
  useEffect(() => {
    const total = openDenominations.reduce((sum, d) => sum + d.value * d.count, 0);
    setOpeningCash(total);
  }, [openDenominations]);

  // Sum up closing cash dynamically
  useEffect(() => {
    const total = closeDenominations.reduce((sum, d) => sum + d.value * d.count, 0);
    setActualClosingCash(total);
  }, [closeDenominations]);

  // Sum up added cash dynamically
  useEffect(() => {
    const total = addDenominations.reduce((sum, d) => sum + d.value * d.count, 0);
    setAddedCashTotal(total);
  }, [addDenominations]);



  const refreshExpectedCash = async () => {
    if (!activeSession) return;
    setIsRefreshingCash(true);
    try {
      const response = await apiClient.get(`/shifts/${activeSession.id}/expected-cash`);
      if (response.ok) {
        const data = await response.json();
        setActiveSession(prev => prev ? {
          ...prev,
          expectedClosingCash: data.expectedClosingCash,
          expectedClosingOnline: data.expectedClosingOnline,
        } : prev);
      }
    } catch (err) {
      console.error('Failed to refresh expected cash:', err);
    } finally {
      setIsRefreshingCash(false);
    }
  };

  // Auto-poll expected cash every 30 seconds while shift is OPEN
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'OPEN') return;
    const interval = setInterval(() => {
      refreshExpectedCash();
    }, 30000);
    return () => clearInterval(interval);
  }, [activeSession?.id, activeSession?.status]);

  const fetchActiveDenominations = async (sessionId: number) => {
    try {
      const response = await apiClient.get(`/shifts/${sessionId}/denominations`);
      if (response.ok) {
        const data = await response.json();
        setActiveDenominations(data);
      }
    } catch (err) {
      console.error('Failed to fetch active shift denominations:', err);
    }
  };

  const fetchActiveSession = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const response = await apiClient.get(`/shifts/active/${selectedShopId}`);
      if (response.status === 204 || response.status === 404) {
        setActiveSession(null);
        setActiveDenominations([]);
      } else if (response.ok) {
        const text = await response.text();
        if (text && text.trim()) {
          const data = JSON.parse(text);
          setActiveSession(data);
          fetchActiveDenominations(data.id);
        } else {
          setActiveSession(null);
          setActiveDenominations([]);
        }
      } else {
        setActiveSession(null);
        setActiveDenominations([]);
      }
    } catch (err) {
      console.error('Failed to fetch active session:', err);
      setActiveSession(null);
      setActiveDenominations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShiftHistory = async () => {
    if (!selectedShopId) return;
    setIsHistoryLoading(true);
    try {
      const response = await apiClient.get(`/shifts/history/${selectedShopId}?page=${historyPage}&size=${historySize}`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
        setHasMoreHistory(data.length === historySize);
        // Fetch float additions of each listed shift (existing denominations endpoint).
        try {
          const entries = await Promise.all(
            (data as ShiftSession[]).map(async (sh) => {
              try {
                const r = await apiClient.get(`/shifts/${sh.id}/denominations`);
                if (!r.ok) return [sh.id, 0] as [number, number];
                const dens = await r.json();
                const total = (Array.isArray(dens) ? dens : [])
                  .filter((d: any) => d.entryType === 'ADDITION')
                  .reduce((sum: number, d: any) => sum + (d.currencyValue || 0) * (d.noteCount || 0), 0);
                return [sh.id, total] as [number, number];
              } catch {
                return [sh.id, 0] as [number, number];
              }
            })
          );
          setFloatByShift(Object.fromEntries(entries));
        } catch (e) {
          console.error('Failed to load float additions for shift history:', e);
        }
      }
    } catch (err) {
      console.error('Failed to fetch shift history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleOpenDenominationChange = (value: number, count: number) => {
    setOpenDenominations(prev =>
      prev.map(d => d.value === value ? { ...d, count: Math.max(0, count) } : d)
    );
  };

  const handleCloseDenominationChange = (value: number, count: number) => {
    setCloseDenominations(prev =>
      prev.map(d => d.value === value ? { ...d, count: Math.max(0, count) } : d)
    );
  };

  const handleAddDenominationChange = (value: number, count: number) => {
    setAddDenominations(prev =>
      prev.map(d => d.value === value ? { ...d, count: Math.max(0, count) } : d)
    );
  };

  const getAdditionsList = () => {
    if (!activeDenominations) return [];
    const additions = activeDenominations.filter((d: any) => d.entryType === 'ADDITION');
    const groups: { [key: string]: any[] } = {};
    additions.forEach((d: any) => {
      const ts = d.createdAt;
      if (!groups[ts]) {
        groups[ts] = [];
      }
      groups[ts].push(d);
    });
    return Object.keys(groups).map(ts => {
      const items = groups[ts].map(d => ({ value: d.currencyValue, count: d.noteCount })).filter(item => item.count > 0);
      const totalAmount = items.reduce((sum, item) => sum + item.value * item.count, 0);
      return {
        timestamp: ts,
        items,
        totalAmount
      };
    }).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  };

  // Total of all mid-shift float additions — shown together with the opening cash.
  const floatAddedTotal = getAdditionsList().reduce((sum, a) => sum + a.totalAmount, 0);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShopId || !eventId) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        shopId: selectedShopId,
        openingCash: openingCash,
        denominations: openDenominations.map(d => ({
          currencyValue: d.value,
          noteCount: d.count
        }))
      };
      const response = await apiClient.post('/shifts/open', payload);
      if (response.ok) {
        const data = await response.json();
        setActiveSession(data);
        setSuccessMsg('Shift session successfully opened! Ready to accept sales.');
        setOpenDenominations(DEFAULT_DENOMINATIONS);
        fetchShiftHistory();
      } else {
        const errorData = await response.json();
        setErrorMsg(errorData.message || 'Failed to open shift session.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred while opening the shift.');
    }
  };

  const handleAddCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        amount: addedCashTotal,
        denominations: addDenominations.map(d => ({
          currencyValue: d.value,
          noteCount: d.count
        }))
      };
      const response = await apiClient.post(`/shifts/${activeSession.id}/add-cash`, payload);
      if (response.ok) {
        setSuccessMsg(`Successfully added ₹${addedCashTotal.toFixed(2)} cash float to the shift drawer.`);
        setAddDenominations(DEFAULT_DENOMINATIONS);
        setAddCashModalOpen(false);
        fetchActiveSession();
        fetchShiftHistory();
      } else {
        const errorData = await response.json();
        setErrorMsg(errorData.message || 'Failed to add cash to shift session.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred while adding cash float.');
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const payload = {
        actualClosingCash: actualClosingCash,
        actualClosingOnline: actualClosingOnline,
        denominations: closeDenominations.map(d => ({
          currencyValue: d.value,
          noteCount: d.count
        }))
      };
      const response = await apiClient.post(`/shifts/${activeSession.id}/close`, payload);
      if (response.ok) {
        setSuccessMsg('Shift session successfully closed! Audited results are listed below.');
        setCloseDenominations(DEFAULT_DENOMINATIONS);
        setCloseShiftModalOpen(false);
        fetchActiveSession();
        fetchShiftHistory();
      } else {
        const errorData = await response.json();
        setErrorMsg(errorData.message || 'Failed to close shift session.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred while closing the shift.');
    }
  };

  const handleReconcileShift = (id: number) => {
    setReconcileShiftId(id);
    setReconcileComment('');
    setReconcileModalOpen(true);
  };

  const submitReconciliation = async () => {
    if (reconcileShiftId === null) return;
    setErrorMsg('');
    setSuccessMsg('');
    setReconcileModalOpen(false);

    // Double safeguard clamping
    let finalComment = reconcileComment;
    if (finalComment.length > 500) {
      finalComment = finalComment.substring(0, 500);
    }

    try {
      const response = await apiClient.post(`/shifts/${reconcileShiftId}/reconcile`, { comment: finalComment });
      if (response.ok) {
        setSuccessMsg('Shift session successfully audited and reconciled!');
        fetchActiveSession();
        fetchShiftHistory();
      } else {
        const errorData = await response.json();
        setErrorMsg(errorData.message || 'Failed to reconcile shift session.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred during reconciliation.');
    } finally {
      setReconcileShiftId(null);
      setReconcileComment('');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in-up p-4 sm:p-6 text-gray-800">

        {/* Welcome Banner */}
        <section className="relative rounded-2xl p-6 sm:p-8 text-white shadow-md"
          style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #3B82F6 100%)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #93C5FD 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#93C5FD' }}>Drawer Auditing & Logs</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Shift Management</h1>
            </div>
            <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {assignedShops.length > 0 && (
                <>
                  <MuiSelect
                    label="Shop Counter"
                    value={selectedShopId || ''}
                    onChange={val => setSelectedShopId(Number(val))}
                    options={assignedShops.map(shop => ({
                      value: shop.id,
                      label: `🏬 ${shop.shopName} (Counter ${shop.counterNumber})`
                    }))}
                    className="w-full sm:w-72 bg-white rounded-2xl text-slate-800 shadow-md font-semibold"
                    size="small"
                  />
                  <button
                    onClick={() => {
                      if (selectedShopId) {
                        router.push(`/sales?shopId=${selectedShopId}`);
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 whitespace-nowrap text-sm h-[40px] sm:h-auto"
                  >
                    <span>🛒</span> Go to Shop
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Messaging Area */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm font-semibold flex items-center gap-2 shadow-sm animate-pulse">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm font-semibold flex items-center gap-2 shadow-sm">
            ✅ {successMsg}
          </div>
        )}

        {shopsLoading ? (
          <ContentLoader message="Verifying shop counter access permissions..." />
        ) : !shopsLoading && assignedShops.length <= 0 ? (
          <div className="bg-white border border-gray-200/80 rounded-2xl p-10 text-center space-y-4 shadow-sm">
            <div className="text-5xl">🚫</div>
            <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
              You do not have any active shop counter assignments to manage shifts.
              Please contact an administrator to assign your user to a shop counter.
            </p>
          </div>
        ) : (
          <>
            {isLoading ? (
              <ContentLoader message="Loading shift details..." />
            ) : !activeSession ? (
              /* =========================================================
                 OPEN SHIFT VIEW
                 ========================================================= */
              <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                <div className="border-b border-gray-100 pb-4">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    🔓 {canManageShift ? 'Open a New Shift Session' : 'No Active Shift'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {canManageShift
                      ? 'Input your initial float currency count to start recording transactions at this counter.'
                      : 'There is no open shift at this counter. A supervisor must open a shift before sales can begin.'}
                  </p>
                </div>

                {/* Issue 7 fix: Only ADMIN / SHOP_SUPERVISOR can open shifts. Cashiers see read-only message. */}
                {!canManageShift ? (
                  <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm font-semibold text-amber-700">
                    ⏳ Waiting for a supervisor to open the shift for this counter.
                  </div>
                ) : null}

                {canManageShift && <form onSubmit={handleOpenShift} className="space-y-6">
                  {/* Denominations Grid */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Denomination Breakdown</label>
                    <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-4">
                      {openDenominations.map(d => (
                        <div key={d.value} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between hover:bg-gray-100/50 transition-colors">
                          <span className="text-sm font-bold text-gray-800">₹{d.value}</span>
                          <input
                            type="number"
                            min="0"
                            value={d.count || ''}
                            onChange={e => handleOpenDenominationChange(d.value, Number(e.target.value))}
                            placeholder="0"
                            className="w-20 bg-white border border-gray-200 rounded-lg text-gray-800 px-2 py-1 text-right text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                      {/* Standard denominations grid */}
                    </div>
                  </div>

                  {/* Float Summary & Actions */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                    <div>
                      <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Opening Float</p>
                      <p className="text-2xl font-black text-indigo-600 mt-1">₹{openingCash.toFixed(2)}</p>
                    </div>
                    <button
                      type="submit"
                      className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95 text-center"
                    >
                      Confirm & Open Shift
                    </button>
                  </div>
                </form>}
              </div>
            ) : (
              /* =========================================================
                 ACTIVE SHIFT VIEW (CLOSE OR RECONCILE)
                 ========================================================= */
              <div className="space-y-6">
                {/* Shift Session Information Card */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl p-6 relative overflow-hidden">
                  <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider mb-2 ${activeSession.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        activeSession.status === 'CLOSED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                        🟢 Status: {activeSession.status}
                      </span>
                      <h2 className="text-xl font-bold text-gray-900 mt-1">Shift Session #{activeSession.id}</h2>
                      <p className="text-xs text-gray-500 mt-1">Opened on {formatISTDateTime(activeSession.openedAt)}</p>
                    </div>
                    <div className="flex gap-6">
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-semibold uppercase">Opening Cash + Float Added</p>
                        <p className={`mt-0.5 font-bold ${activeSession.status === 'OPEN' ? 'text-lg text-gray-700' : 'text-2xl text-indigo-600'}`}>₹{(activeSession.openingCashBalance + floatAddedTotal).toFixed(2)}</p>
                        {floatAddedTotal > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">₹{activeSession.openingCashBalance.toFixed(2)} opening + ₹{floatAddedTotal.toFixed(2)} added</p>
                        )}
                      </div>
                      {activeSession.status === 'OPEN' && (
                        <div className="text-right border-l border-indigo-200 pl-6">
                          <p className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1 justify-end">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Live Expected Cash
                            <button
                              type="button"
                              onClick={refreshExpectedCash}
                              disabled={isRefreshingCash}
                              title="Refresh expected cash"
                              className="ml-1 text-indigo-400 hover:text-indigo-600 disabled:opacity-40 transition-colors"
                            >
                              <RefreshIcon />
                            </button>
                          </p>
                          <p className="text-2xl font-black text-indigo-600 mt-0.5">
                            {isRefreshingCash
                              ? <span className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin align-middle" />
                              : `₹${activeSession.expectedClosingCash.toFixed(2)}`}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shift Actions Card & Infusion Log */}
                {activeSession.status === 'OPEN' ? (
                  <>
                    <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                      <div className="border-b border-gray-100 pb-4">
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                          ⚡ Active Shift Actions
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Manage drawer cash float infusions or proceed to reconcile notes and close the session.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setAddDenominations(DEFAULT_DENOMINATIONS);
                            setAddCashModalOpen(true);
                          }}
                          className="w-full sm:w-1/2 flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl shadow-sm hover:shadow transition-all group active:scale-[0.98]"
                        >
                          <span className="text-3xl mb-2 transition-transform group-hover:scale-110">💵</span>
                          <span className="text-sm font-bold text-gray-800 group-hover:text-indigo-700">Add Money (Add Float)</span>
                          <span className="text-xxs text-gray-400 mt-1 text-center font-medium">Record mid-shift cash infusion with denomination breakdown</span>
                        </button>

                        {/* Issue 7 fix: only ADMIN / SHOP_SUPERVISOR can close a shift */}
                        {canManageShift ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCloseDenominations(DEFAULT_DENOMINATIONS);
                              setCloseShiftModalOpen(true);
                            }}
                            className="w-full sm:w-1/2 flex flex-col items-center justify-center p-6 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-2xl shadow-sm hover:shadow transition-all group active:scale-[0.98]"
                          >
                            <span className="text-3xl mb-2 transition-transform group-hover:scale-110">🔒</span>
                            <span className="text-sm font-bold text-gray-800 group-hover:text-rose-700">Confirm & Close Shift</span>
                            <span className="text-xxs text-gray-400 mt-1 text-center font-medium">Audit drawer denominations and verify online payment aggregates</span>
                          </button>
                        ) : (
                          <div className="w-full sm:w-1/2 flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl opacity-50 cursor-not-allowed">
                            <span className="text-3xl mb-2">🔒</span>
                            <span className="text-sm font-bold text-gray-500">Close Shift</span>
                            <span className="text-xxs text-gray-400 mt-1 text-center font-medium">Supervisor access required</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Cash Infusion / Addition Log Panel */}
                    <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm animate-fade-in">
                      <div className="border-b border-gray-100 pb-3">
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          📥 Cash Infusion / Addition Log
                        </h3>
                        <p className="text-xxs text-gray-500">History of mid-shift cash float additions made to this session's drawer.</p>
                      </div>

                      {getAdditionsList().length === 0 ? (
                        <p className="text-xs text-gray-400 italic py-4 text-center">No cash float additions recorded for this shift.</p>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                          {getAdditionsList().map((addition, index) => (
                            <div key={addition.timestamp} className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2.5">
                              <div className="flex justify-between items-center text-xs border-b border-slate-200/60 pb-1.5">
                                <span className="font-bold text-indigo-700">Addition #{index + 1}</span>
                                <span className="text-slate-500 font-semibold">
                                  {formatISTDateTime(addition.timestamp)}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 gap-2 text-xxs font-semibold text-slate-600">
                                {addition.items.map(item => (
                                  <span key={item.value} className="bg-white px-2 py-1.5 rounded border border-slate-100 flex items-center justify-between">
                                    <span className="font-bold text-gray-800">₹{item.value}</span>
                                    <span className="text-gray-400">x{item.count}</span>
                                  </span>
                                ))}
                              </div>
                              <div className="flex justify-between items-center text-xs pt-1">
                                <span className="text-slate-500 font-bold">Total Added Amount:</span>
                                <span className="font-black text-indigo-600 text-sm">₹{addition.totalAmount.toFixed(2)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* =========================================================
                     RECONCILIATION & AUDITED SUMMARY VIEW
                     ========================================================= */
                  <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
                    <div className="border-b border-gray-100 pb-4">
                      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        📊 Shift Payment Reconciliation Summary
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">Verification metrics showing mathematical discrepancies for physical cash and digital gateways independently.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Cash Drawer Reconciliation */}
                      <div className="border border-gray-100 rounded-2xl p-5 bg-slate-50 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                            💵 Cash Drawer Audit
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${activeSession.actualClosingCash === activeSession.expectedClosingCash
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                            }`}>
                            {activeSession.actualClosingCash === activeSession.expectedClosingCash ? 'BALANCED' : 'DISCREPANCY'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400 font-semibold uppercase tracking-wider block">Expected Cash</span>
                            <span className="text-sm font-bold text-gray-800">₹{activeSession.expectedClosingCash.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-semibold uppercase tracking-wider block">Counted Cash</span>
                            <span className="text-sm font-bold text-gray-800">₹{activeSession.actualClosingCash.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className={`p-3 rounded-xl text-center border ${activeSession.actualClosingCash === activeSession.expectedClosingCash
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-100'
                          }`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider block">Cash Drawer Variance</span>
                          <span className="text-lg font-black block mt-0.5">
                            ₹{(activeSession.actualClosingCash - activeSession.expectedClosingCash).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Online Payments Reconciliation */}
                      <div className="border border-gray-100 rounded-2xl p-5 bg-slate-50 space-y-4">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <span className="text-sm font-bold text-gray-950 flex items-center gap-1.5">
                            🌐 Online Payments Audit
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${(activeSession.actualClosingOnline || 0) === (activeSession.expectedClosingOnline || 0)
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                            }`}>
                            {(activeSession.actualClosingOnline || 0) === (activeSession.expectedClosingOnline || 0) ? 'MATCHED' : 'DISCREPANCY'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400 font-semibold uppercase tracking-wider block">Expected Online</span>
                            <span className="text-sm font-bold text-gray-800">₹{(activeSession.expectedClosingOnline || 0).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 font-semibold uppercase tracking-wider block">Confirmed Online</span>
                            <span className="text-sm font-bold text-gray-800">₹{(activeSession.actualClosingOnline || 0).toFixed(2)}</span>
                          </div>
                        </div>

                        <div className={`p-3 rounded-xl text-center border ${(activeSession.actualClosingOnline || 0) === (activeSession.expectedClosingOnline || 0)
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                          : 'bg-rose-50 text-rose-800 border-rose-100'
                          }`}>
                          <span className="text-[10px] font-bold uppercase tracking-wider block">Online Gateway Variance</span>
                          <span className="text-lg font-black block mt-0.5">
                            ₹{((activeSession.actualClosingOnline || 0) - (activeSession.expectedClosingOnline || 0)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {activeSession.status === 'CLOSED' && (
                      <div className="flex justify-end border-t border-gray-100 pt-4">
                        {canReconcile ? (
                          <button
                            onClick={() => handleReconcileShift(activeSession.id)}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 text-xs"
                          >
                            <span>🛡️</span> Approve & Reconcile Shift
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-200 shadow-sm flex items-center gap-1.5 animate-pulse">
                            ⏳ Pending Supervisor Audit
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* =========================================================
           SHIFT HISTORY & AUDIT LOG LEDGER
           ========================================================= */}
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-gray-100 pb-3">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    📜 Shift Audit Log Ledger
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Historical overview of shift closures and calculated cash drawer discrepancies.</p>
                </div>
                <button
                  onClick={fetchShiftHistory}
                  className="w-full sm:w-auto text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100 hover:border-indigo-200 transition-all"
                >
                  <RefreshIcon />  Refresh
                </button>
              </div>

              {isHistoryLoading ? (
                <ContentLoader message="Loading shift history..." />
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center italic">No historic shift sessions recorded for this shop counter.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-xs bg-gray-50/50">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">Opened At</th>
                        <th className="py-3 px-3 text-right">Opening + Float</th>
                        <th className="py-3 px-3 text-right">Exp. Cash</th>
                        <th className="py-3 px-3 text-right">Act. Cash</th>
                        <th className="py-3 px-3 text-right">Cash Var.</th>
                        <th className="py-3 px-3 text-right">Online Var.</th>
                        <th className="py-3 px-3 text-center">Status</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-gray-800 font-medium">
                      {history.map(session => {
                        const variance = session.actualClosingCash - session.expectedClosingCash;
                        const onlineVariance = (session.actualClosingOnline || 0) - (session.expectedClosingOnline || 0);
                        return (
                          <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-3">#{session.id}</td>
                            <td className="py-3.5 px-3 text-xs text-gray-500">
                              {formatISTDateTime(session.openedAt)}
                            </td>
                            <td className="py-3.5 px-3 text-right text-gray-900">
                              ₹{(session.openingCashBalance + (floatByShift[session.id] || 0)).toFixed(2)}
                              {(floatByShift[session.id] || 0) > 0 && (
                                <span className="block text-[10px] text-gray-400 font-normal">
                                  ₹{session.openingCashBalance.toFixed(2)} + ₹{(floatByShift[session.id] || 0).toFixed(2)}
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right text-gray-700">
                              {session.status === 'OPEN' ? (
                                <span className="inline-flex items-center gap-1 text-indigo-600 font-bold">
                                  ₹{session.expectedClosingCash.toFixed(2)}
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" title="Live Expected Cash"></span>
                                </span>
                              ) : (
                                `₹${session.expectedClosingCash.toFixed(2)}`
                              )}
                            </td>
                            <td className="py-3.5 px-3 text-right text-gray-700">
                              {session.status === 'OPEN' ? '—' : `₹${session.actualClosingCash.toFixed(2)}`}
                            </td>
                            <td className={`py-3.5 px-3 text-right font-bold ${session.status === 'OPEN' ? 'text-gray-500' :
                              variance === 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                              {session.status === 'OPEN' ? 'Active' : `₹${variance.toFixed(2)}`}
                            </td>
                            <td className={`py-3.5 px-3 text-right font-bold ${session.status === 'OPEN' ? 'text-gray-500' :
                              onlineVariance === 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                              {session.status === 'OPEN' ? 'Active' : `₹${onlineVariance.toFixed(2)}`}
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${session.status === 'OPEN' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                session.status === 'CLOSED' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}>
                                {session.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center">
                              {session.status === 'CLOSED' ? (
                                canReconcile ? (
                                  <button
                                    onClick={() => handleReconcileShift(session.id)}
                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 transition-all shadow-sm"
                                  >
                                    Reconcile
                                  </button>
                                ) : (
                                  <span className="text-xs text-amber-600 font-semibold italic">Pending Audit</span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Pagination Controls */}
                  {history.length > 0 && (
                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 text-xs font-semibold text-gray-500">
                      <div>
                        Page <span className="text-gray-900 font-bold">{historyPage + 1}</span> (up to {historySize} shifts)
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (historyPage > 0) {
                              setHistoryPage(prev => prev - 1);
                            }
                          }}
                          disabled={historyPage === 0}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-gray-700 transition-all active:scale-95 shadow-sm"
                        >
                          ◀ Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (hasMoreHistory) {
                              setHistoryPage(prev => prev + 1);
                            }
                          }}
                          disabled={!hasMoreHistory}
                          className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-gray-700 transition-all active:scale-95 shadow-sm"
                        >
                          Next ▶
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Premium Reconciliation Modal */}
      {reconcileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl space-y-4 transform transition-all duration-300 scale-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                🛡️ Shift Reconciliation Audit
              </h3>
              <button
                onClick={() => setReconcileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg focus:outline-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Auditing Comment (optional, max 500 chars)
              </label>
              <textarea
                value={reconcileComment}
                onChange={(e) => setReconcileComment(e.target.value)}
                maxLength={500}
                placeholder="Explain any physical float variance or discrepancy..."
                className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 font-medium resize-none transition-all"
              />
              <div className="flex justify-end text-xxs font-bold text-slate-400">
                {reconcileComment.length} / 500 characters
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReconcileModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitReconciliation}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Confirm & Reconcile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Cash Modal */}
      {addCashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-2xl bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl space-y-4 transform transition-all duration-300 scale-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                💵 Add Cash Float mid-shift
              </h3>
              <button
                onClick={() => setAddCashModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg focus:outline-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddCash} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Denomination Count to Add</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {addDenominations.map(d => (
                    <div key={d.value} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between hover:bg-gray-100/50 transition-colors">
                      <span className="text-sm font-bold text-gray-800">₹{d.value}</span>
                      <input
                        type="number"
                        min="0"
                        value={d.count || ''}
                        onChange={e => handleAddDenominationChange(d.value, Number(e.target.value))}
                        placeholder="0"
                        className="w-20 bg-white border border-gray-200 rounded-lg text-gray-800 px-2 py-1 text-right text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <div>
                  <p className="text-xs text-indigo-700 font-semibold uppercase tracking-wider">Total Infused Cash Float</p>
                  <p className="text-2xl font-black text-indigo-600 mt-1">₹{addedCashTotal.toFixed(2)}</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setAddCashModalOpen(false)}
                    className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-md active:scale-[0.95] text-center text-xs"
                  >
                    Confirm & Add Cash
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {closeShiftModalOpen && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl space-y-4 transform transition-all duration-300 scale-100 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                🔒 Close Shift & Audit Drawer
              </h3>
              <button
                onClick={() => setCloseShiftModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg focus:outline-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Denominations Grid */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Physical Cash Denomination Count</label>
                <div className="grid grid-cols-2 gap-3">
                  {closeDenominations.map(d => (
                    <div key={d.value} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 flex items-center justify-between hover:bg-gray-100/50 transition-colors">
                      <span className="text-xs font-bold text-gray-800">₹{d.value}</span>
                      <input
                        type="number"
                        min="0"
                        value={d.count || ''}
                        onChange={e => handleCloseDenominationChange(d.value, Number(e.target.value))}
                        placeholder="0"
                        className="w-16 bg-white border border-gray-200 rounded-lg text-gray-800 px-2 py-1 text-right text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Handover Envelope and Online Aggregate Verification */}
              <div className="space-y-6 flex flex-col justify-between">
                {/* Interactive Envelope Sheet */}
                <div className="bg-indigo-900/5 rounded-2xl p-5 border border-indigo-900/10 space-y-4">
                  <div className="flex items-center gap-2 text-indigo-900">
                    <span className="text-xl">✉️</span>
                    <h4 className="text-xs font-bold uppercase tracking-wider">Physical Cash Handover Envelope Sheet</h4>
                  </div>

                  <div className="space-y-2 text-xs font-medium text-gray-600">
                    <div className="flex justify-between">
                      <span>1. Opening float + added cash (Kept in drawer)</span>
                      <span className="font-bold text-gray-800">₹{(activeSession.openingCashBalance + floatAddedTotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-gray-200 pb-2">
                      <span>2. Net Cash Sales (after refunds)</span>
                      <span className="font-bold text-gray-800">₹{Math.max(0, activeSession.expectedClosingCash - activeSession.openingCashBalance - floatAddedTotal).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-indigo-700 font-bold pt-1">
                      <span>3. Expected Envelope Handover</span>
                      <span>₹{activeSession.expectedClosingCash.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-indigo-900 font-black text-sm pt-2 border-t border-indigo-200">
                      <span>4. Counted Envelope Handover</span>
                      <span>₹{actualClosingCash.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Float variance badge */}
                  {actualClosingCash !== activeSession.expectedClosingCash && (
                    <div className={`p-2.5 rounded-xl text-center text-xs font-semibold border ${actualClosingCash > activeSession.expectedClosingCash
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`}>
                      Variance: ₹{(actualClosingCash - activeSession.expectedClosingCash).toFixed(2)} ({actualClosingCash > activeSession.expectedClosingCash ? 'Surplus' : 'Deficit'})
                    </div>
                  )}
                </div>

                {/* Online Aggregates Verification */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Confirmed Online Payments (UPI/Card Terminals)
                    </label>
                    <span className="bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-300">
                      Expected: ₹{(activeSession.expectedClosingOnline || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm font-semibold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={actualClosingOnline}
                      onChange={e => setActualClosingOnline(Number(e.target.value))}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-xl text-slate-800 pl-7 pr-3 py-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Total Submission Actions */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                  <div>
                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Total Declared Assets</p>
                    <p className="text-lg font-black text-indigo-600 mt-0.5">₹{(actualClosingCash + actualClosingOnline).toFixed(2)}</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => setCloseShiftModalOpen(false)}
                      className="w-full sm:w-auto px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-[0.95] text-center text-xs"
                    >
                      Confirm & Close Shift
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default function ShiftsPage() {
  return (
    <Suspense fallback={<AppLayout><div className="p-4 text-center mt-10">Loading Shift Details...</div></AppLayout>}>
      <ShiftsContent />
    </Suspense>
  );
}
