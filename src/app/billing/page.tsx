'use client';

import { formatISTDate, formatISTTime } from '@/lib/dateUtils';
import { useEffect, useMemo, useRef, useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import { ContentLoader } from '@/components/ui/ContentLoader';
import { DEFAULT_RECEIPT_CONFIG } from '@/lib/recieptConfig';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { RefreshIcon } from '@/components/ui/Icons';
import { apiClient } from '@/lib/api';
import { getCurrentUserId } from '@/lib/auth';
import { printDocuments } from '@/lib/printService';
import { printReceivingSmart } from '@/lib/centralPrint';
import { resolveShopInfo } from '@/lib/resolveShopInfo';
import { matchItems } from '@/lib/searchMatch';
import { CancelIcon } from '@/components/ui/Icons';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useRouter } from 'next/navigation';
import { useShop } from '@/hooks/useShop';

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  sellingPrice: number;
  mrp: number;
  discount: number;
  categoryId?: string;
}

interface Sale {
  id: number;
  orderNumber?: string;
  invoiceId?: string;
  totalAmount?: number;
  paymentMode?: string;
  paymentReference?: string;
  cashAmount?: number;
  cashReceived?: number;
  onlineAmount?: number;
  change?: number;
  items?: SaleItem[];
  originalAmount?: number;
  salesOrderNumber?: string;
  invoiceNo?: string;
  shopId?: number | string;
  receivingPrinted?: boolean;
  sellerId?: number;
  sellerName?: string;
  billedBy?: number;
  customerName?: string | null;
  customerMobile?: string | null;
  customerGstin?: string | null;
  subtotalAmount?: number;
  discountAmount?: number;
  taxAmount?: number;
  netAmount?: number;
  status?: string;
  billingDate?: string;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Response parsing helper
// ---------------------------------------------------------------------------

function extractRows(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (raw?.content !== undefined) return raw.content ?? [];
  return raw?.data ?? [];
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BillingPage() {
  const router = useRouter();
  const { eventId, eventName } = useActiveEvent();
  const { assignedShops, shopReady, isAdmin } = useShop();

  const [sales, setSales] = useState<Sale[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const receiptConfig = useMemo(() => {
    const currentEvent = allEvents.find(e => String(e?.id) === String(eventId));
    return currentEvent?.receiptConfig || DEFAULT_RECEIPT_CONFIG;
  }, [allEvents, eventId]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [printFallbackMsg, setPrintFallbackMsg] = useState('');

  // ── Pagination state ────────────────────────────────────────────────────
  const [page, setPage] = useState(0); // 0-indexed, matches backend
  const pageSize = 10;
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Edit is now handled on the Sales page
  const handleEditBill = (sale: Sale) => {
    const orderNo = sale.salesOrderNumber || sale.orderNumber || '';
    const invoiceNo = sale.invoiceNo || sale.invoiceId || '';
    const params = new URLSearchParams({ tab: 'cancel' });
    if (orderNo) params.set('orderNo', orderNo);
    if (invoiceNo) params.set('invoiceNo', invoiceNo);
    router.push(`/sales?${params.toString()}`);
  };

  // Thermal print fallback notification — shows when ESC/POS fails and browser dialog opens
  useEffect(() => {
    const handleThermalFallback = (e: Event) => {
      const reason = (e as CustomEvent<{ reason: string }>).detail?.reason ?? 'Unknown error';
      setPrintFallbackMsg(`Thermal print failed — browser print dialog opened.\nReason: ${reason}`);
      setTimeout(() => setPrintFallbackMsg(''), 10_000); // auto-dismiss after 10 s
    };
    window.addEventListener('thermalPrintFallback', handleThermalFallback);
    return () => window.removeEventListener('thermalPrintFallback', handleThermalFallback);
  }, []);
  const assignedShopIdsKey = useMemo(
    () => assignedShops.map(s => s.id).sort((a, b) => a - b).join(','),
    [assignedShops]
  );

  // Pre-select first assigned shop counter for restricted roles on load
  useEffect(() => {
    if (!isAdmin && assignedShops.length > 0 && !shopFilter) {
      setShopFilter(assignedShops[0].id.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignedShopIdsKey, isAdmin, shopFilter]);
  const [userFilterResolved, setUserFilterResolved] = useState(false);
  useEffect(() => {
    const id = getCurrentUserId();
    if (id != null) {
      setUserFilter(String(id));
    }
    setUserFilterResolved(true);
  }, []);

  const allReady = shopReady && userFilterResolved;

  const pendingSearchRef = useRef(false);
  const pendingShopFilterRef = useRef(false);
  const pendingUserFilterRef = useRef(false);

  useEffect(() => {
    if (allReady && !pendingSearchRef.current && !pendingShopFilterRef.current && !pendingUserFilterRef.current) {
      setPage(0);
      fetchData('', 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, assignedShopIdsKey, allReady]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const pageInitRes = await apiClient.get('/page-init?include=events');
        if (pageInitRes.ok) {
          const data = await pageInitRes.json();
          setAllEvents(Array.isArray(data.events) ? data.events : []);
          return;
        }
      } catch (e) {
        console.warn('[billing] page-init fetch failed, falling back to individual endpoint:', e);
      }
      // page-init not available — fall back to the individual endpoint
      const eventsRes = await apiClient.get('/events');
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setAllEvents(Array.isArray(eventsData) ? eventsData : (eventsData.data || []));
      }
    })();
  }, [eventId]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get('/users/allUsers');
        if (res.ok) {
          const raw = await res.json();
          setUsers(Array.isArray(raw) ? raw : (raw.data ?? []));
        }
      } catch (e) {
        console.warn('[billing] users fetch failed:', e);
      }
    })();
  }, []);

  const searchMountedRef = useRef(false);
  const shopFilterMountedRef = useRef(false);
  const userFilterMountedRef = useRef(false);

  useEffect(() => {
    if (!searchMountedRef.current) {
      searchMountedRef.current = true;
      return;
    }
    if (!allReady) {
      pendingSearchRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      setPage(0);
      fetchData(searchTerm, 0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Re-fetch when shop filter changes (state has settled by now). Same
  // queue-if-not-ready treatment as search, via pendingShopFilterRef.
  useEffect(() => {
    if (!shopFilterMountedRef.current) {
      shopFilterMountedRef.current = true;
      return;
    }
    if (!allReady) {
      pendingShopFilterRef.current = true;
      return;
    }
    setPage(0);
    fetchData(searchTerm, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopFilter]);

  useEffect(() => {
    if (!userFilterMountedRef.current) {
      userFilterMountedRef.current = true;
      return;
    }
    if (!allReady) {
      pendingUserFilterRef.current = true;
      return;
    }
    setPage(0);
    fetchData(searchTerm, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userFilter]);

  useEffect(() => {
    if (allReady && (pendingSearchRef.current || pendingShopFilterRef.current || pendingUserFilterRef.current)) {
      pendingSearchRef.current = false;
      pendingShopFilterRef.current = false;
      pendingUserFilterRef.current = false;
      setPage(0);
      fetchData(searchTerm, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allReady]);

  /** Called by pagination controls — updates state and triggers fetch. */
  const goToPage = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return;
    setPage(newPage);
    fetchData(searchTerm, newPage);
  };

  /**
   * fetchData — single call to the aggregator route, which fetches the invoices
   * page and the matching bounded retail lookup, merges them server-side, and
   * returns one PageResponse-shaped body. See /api/billing/invoices/enriched.
   *
   * @param search  - current search term
   * @param pageNum - 0-indexed page to fetch
   */
  const fetchData = async (search = '', pageNum = page) => {
    setLoading(true);
    try {
      // Shop scoping — resolved client-side (same logic as before), then sent
      // as a single param the aggregator forwards to invoices/search.
      let shopIds: string | undefined;
      if (shopFilter) {
        // Admin explicitly selected a shop
        shopIds = shopFilter;
      } else if (!isAdmin) {
        shopIds = assignedShops.length > 0
          ? assignedShops.map(s => s.id.toString()).join(',')
          : '-1';
      }

      const res = await apiClient.post('/billing/invoices/enriched', {
        eventId: eventId || undefined,
        shopIds,
        searchTerm: search.trim() || undefined,
        billedBy: userFilter || undefined,
        page: pageNum,
        size: pageSize,
      });

      if (res.ok) {
        const raw = await res.json();
        const mergedSales = extractRows(raw);
        setTotalElements(raw?.totalElements ?? mergedSales.length);
        setTotalPages(raw?.totalPages ?? 1);
        setSales(mergedSales);
      } else {
        console.error('[billing] enriched fetch failed with status', res.status);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch the authoritative payment details for a single order just before
   * printing. Only one API call, only when the user actually clicks Print.
   */
  const handlePrint = async (sale: Sale) => {
    const { shopName, orgName, counterNumber } = resolveShopInfo(sale.shopId, assignedShops);
    const orderNo = sale.salesOrderNumber || sale.orderNumber;

    let enrichedSale: Sale = sale;
    if (orderNo) {
      try {
        const payRes = await apiClient.get(`/sales/retail/${orderNo}/payment`);
        if (payRes.ok) {
          const p = await payRes.json();
          const cashAmt = Number(p.cashAmount ?? p.cash_amount ?? 0);
          const onlineAmt = Number(p.onlineAmount ?? p.online_amount ?? 0);
          const mode: string =
            p.paymentMode || p.payment_mode ||
            (cashAmt > 0 && onlineAmt > 0 ? 'BOTH' :
              onlineAmt > 0 ? 'ONLINE' :
                cashAmt > 0 ? 'CASH' :
                  sale.paymentMode || '');
          enrichedSale = {
            ...sale,
            paymentMode: mode,
            cashAmount: cashAmt > 0 ? cashAmt : (sale.cashAmount ?? 0),
            cashReceived: Number(p.cashReceived ?? p.cash_received ?? cashAmt ?? sale.cashReceived ?? 0),
            onlineAmount: onlineAmt > 0 ? onlineAmt : (sale.onlineAmount ?? 0),
            paymentReference: p.paymentReference || p.payment_reference || p.upiReference || sale.paymentReference || '',
            change: Number(p.changeGiven ?? p.change_given ?? p.change ?? sale.change ?? 0),
          };
        }
      } catch {
        // fall through — print with whatever data we already have
      }
    }
    // Single entry point. isReprint:true → bill only (receiving is NOT auto-printed from history;
    // the dedicated receiving button handles that). Same central-vs-local routing as a new sale.
    printDocuments(enrichedSale, {
      shopName,
      orgName,
      counterNumber,
      eventName: eventName,
      config: receiptConfig,
      shop: {},
      isReprint: true,
    }).catch((e: any) => console.warn('[billing] print failed:', e?.message || e));
  };

  /**
   * Print a receiving slip from billing history.
   * Only shown when the event + shop gates pass AND the slip hasn't been printed yet
   * (this session — we no longer persist a "printed" flag to the backend, see below).
   */
  const handlePrintReceiving = async (sale: Sale) => {
    const { shopName, orgName, counterNumber } = resolveShopInfo(sale.shopId, assignedShops);
    await printReceivingSmart(sale, { shopName, orgName, counterNumber, eventName: eventName || undefined, eventConfigPayload: receiptConfig });
    // NOTE: no longer PATCHing /sales/retail/{orderNo}/receiving-printed — by request,
    // receiving-print is treated as always "done," so we don't call that endpoint anymore.
    // Optimistically hide the button so the operator can't double-print in this session.
    setSales(prev => prev.map(s => s.id === sale.id ? { ...s, receivingPrinted: true } : s));
  };

  const filteredSales = useMemo(() => {
    const searchMatched = new Set(
      matchItems(
        searchTerm,
        sales,
        (sale) => [
          sale.salesOrderNumber,
          sale.orderNumber,
          sale.invoiceNo,
          sale.invoiceId,
          sale.customerName,
          sale.customerMobile,
          ...(sale.items?.map(item => item.productName) || []),
        ],
        Infinity
      )
    );

    return sales.filter(sale => {
      const matchesSearch = searchMatched.has(sale);
      const matchesShop = !shopFilter || sale.shopId?.toString() === shopFilter;
      const matchesUser = !userFilter || sale.billedBy?.toString() === userFilter;

      return matchesSearch && matchesShop && matchesUser;
    });
  }, [sales, searchTerm, shopFilter, userFilter]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 animate-fade-in">

        {/* Thermal print fallback banner */}
        {printFallbackMsg && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="mt-0.5">⚠️</span>
            <div className="flex-1 whitespace-pre-wrap">{printFallbackMsg}</div>
            <button onClick={() => setPrintFallbackMsg('')} className="ml-2 text-amber-600 hover:text-amber-900 font-bold">✕</button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Billing History</h1>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fetchData(searchTerm, page)}
              className="p-2 bg-white border border-gray-200 hover:border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 hover:text-indigo-600 transition-all flex items-center justify-center cursor-pointer"
              title="Refresh"
            >
              <RefreshIcon className="w-5 h-5 text-slate-500 hover:text-indigo-600" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
          <div className="w-full sm:flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Order #, Invoice #, Customer, Mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 pr-9 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full hover:bg-slate-100"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <CancelIcon />
                </button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-48">
            <MuiSelect
              label="Shop"
              value={shopFilter}
              onChange={(val) => {
                setShopFilter(val);
                // Note: fetchData here would capture stale shopFilter value;
                // the effect below handles the re-fetch (and page reset) after
                // state settles.
              }}
              options={[
                ...(isAdmin
                  ? [{ value: '', label: 'All Shops' }]
                  : (assignedShops.length > 1 ? [{ value: '', label: 'All My Shops' }] : [])
                ),
                ...assignedShops.map(shop => ({
                  value: shop.id ? String(shop.id) : '',
                  label: shop.shopName || `Shop ${shop.id}`
                }))
              ]}
              size="small"
            />
          </div>
          <div className="w-full sm:w-48">
            <MuiSelect
              label="User"
              value={userFilter}
              onChange={(val) => {
                setUserFilter(val);
              }}
              options={[
                { value: '', label: 'All Users' },
                ...users.map(u => ({
                  value: u.id != null ? String(u.id) : '',
                  label: u.fullName || u.username || `User ${u.id}`
                }))
              ]}
              size="small"
            />
          </div>
        </div>

        {/* ── Mobile card list (hidden on sm+) ─────────────────────────── */}
        {/* DUAL MAINTENANCE WARNING: This mobile card view mirrors the desktop table above.
            If you add new columns, actions, status types, or badges to the desktop table,
            you MUST also update the cards below — they are completely separate code paths. */}
        <div className="sm:hidden space-y-3 mb-4">
          {loading || !allReady ? (
            <ContentLoader message="Loading bills..." />
          ) : filteredSales.length === 0 ? (
            <p className="text-center text-gray-400 italic py-8 text-sm">No bills found matching your criteria.</p>
          ) : filteredSales.map(sale => {
            const displayOrderNo = sale.salesOrderNumber || sale.orderNumber || '—';
            const displayInvoice = sale.invoiceNo || sale.invoiceId || 'No Invoice';
            const displayAmount = sale.netAmount ?? sale.totalAmount;
            const displayStatus = sale.status || '—';
            const displayDate = sale.billingDate || sale.createdAt;
            const shopName = assignedShops.find(s => s.id?.toString() === sale.shopId?.toString())?.shopName || `Shop ${sale.shopId}`;
            return (
              <div key={sale.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2.5">

                {/* Row 1: date/time + status + payment mode */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{formatISTDate(displayDate)}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{formatISTTime(displayDate)}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${displayStatus === 'PAID' ? 'bg-green-100 text-green-700 border border-green-200' : displayStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700 border border-green-200' : displayStatus === 'CANCELLED' ? 'bg-red-100 text-red-700 border border-red-200' : displayStatus === 'RETURNED' ? 'bg-orange-100 text-orange-700 border border-orange-200' : displayStatus === 'PARTIALLY_RETURNED' ? 'bg-orange-50 text-orange-600 border border-orange-100' : displayStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                      {displayStatus}
                    </span>
                    {sale.paymentMode && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${sale.paymentMode === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : sale.paymentMode === 'ONLINE' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                        {sale.paymentMode}
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: labeled identifiers */}
                <div className="space-y-1 text-xs border-t border-gray-50 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-semibold w-16 shrink-0">Shop</span>
                    <span className="font-semibold text-gray-700 truncate">{shopName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-semibold w-16 shrink-0">Bill no</span>
                    <span className="font-bold text-sky-700 font-mono truncate">{displayInvoice}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 font-semibold w-16 shrink-0">Order no</span>
                    <span className="font-mono text-gray-600 truncate">{displayOrderNo}</span>
                  </div>
                  {(sale.customerName || sale.customerMobile) && (
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-semibold w-16 shrink-0">Customer</span>
                      <span className="text-gray-600 truncate">{sale.customerName || '—'}{sale.customerMobile ? ` · ${sale.customerMobile}` : ''}</span>
                    </div>
                  )}
                </div>

                {/* Row 3: price + edit + print buttons on same line */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-50">
                  <span className="text-base font-bold text-gray-900">₹{Number(displayAmount ?? 0).toFixed(2)}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleEditBill(sale)}
                      disabled={displayStatus === 'CANCELLED'}
                      className={`p-1.5 rounded-lg transition-all shadow-sm text-xs font-bold ${displayStatus === 'CANCELLED' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white'}`}
                      title="Edit Bill"
                    >✏️</button>
                    <button
                      onClick={() => handlePrint(sale)}
                      disabled={displayStatus === 'CANCELLED'}
                      className={`p-1.5 rounded-lg transition-all shadow-sm ${displayStatus === 'CANCELLED' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-gray-50 text-gray-600 hover:bg-indigo-600 hover:text-white'}`}
                      title={displayStatus === 'CANCELLED' ? 'Bill is cancelled' : 'Print Receipt'}
                    >🖨️</button>
                    {receiptConfig?.receivingPrint?.enabled &&
                      assignedShops.find(s => s.id?.toString() === sale.shopId?.toString())?.receivingPrintEnabled &&
                      !sale.receivingPrinted &&
                      displayStatus !== 'CANCELLED' && (
                        <button
                          onClick={() => handlePrintReceiving(sale)}
                          className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all shadow-sm text-xs font-bold"
                          title="Print Receiving Slip"
                        >📋</button>
                      )}
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Table (hidden on mobile, visible sm+) */}
        <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Date</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Bill / Invoice</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Customer</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Shop</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Amount</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Payment Mode</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase">Status</th>
                  <th className="p-4 text-xs font-bold text-gray-600 uppercase text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading || !allReady ? (
                  <tr>
                    <td colSpan={8}>
                      <ContentLoader message="Loading bills..." />
                    </td>
                  </tr>
                ) : filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-gray-400 italic">
                      No bills found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredSales.map(sale => {
                    const displayOrderNo = sale.salesOrderNumber || sale.orderNumber || '—';
                    const displayInvoice = sale.invoiceNo || sale.invoiceId || 'No Invoice';
                    const displayAmount = sale.netAmount ?? sale.totalAmount;
                    const displayStatus = sale.status || '—';
                    const displayDate = sale.billingDate || sale.createdAt;
                    return (
                      <tr key={sale.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="p-4">
                          <div className="text-sm font-medium text-gray-900">{formatISTDate(displayDate)}</div>
                          <div className="text-[10px] text-gray-400 font-mono">{formatISTTime(displayDate)}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm font-bold text-sky-700">{displayInvoice}</div>
                          <div className="text-xs text-gray-500">{displayOrderNo}</div>
                        </td>
                        <td className="p-4">
                          <div className="text-sm text-gray-900 font-medium">{sale.customerName || '—'}</div>
                          <div className="text-xs text-gray-500">{sale.customerMobile || ''}</div>
                        </td>
                        <td className="p-4">
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded-md font-medium text-gray-600">
                            {assignedShops.find(s => s.id?.toString() === sale.shopId?.toString())?.shopName || `Shop ${sale.shopId}`}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <div className="text-sm font-bold text-gray-900">₹{(sale.netAmount ?? sale.totalAmount ?? 0).toFixed(2)}</div>
                            {(sale.originalAmount && Math.abs(sale.originalAmount - (sale.netAmount ?? 0)) > 0.01) && (
                              <div className="text-[10px] text-gray-400 line-through">₹{sale.originalAmount.toFixed(2)}</div>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {sale.paymentMode ? (
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider w-fit flex items-center gap-1 ${sale.paymentMode === 'CASH' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : sale.paymentMode === 'ONLINE' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-purple-50 text-purple-700 border border-purple-100'}`}>
                              {sale.paymentMode}
                            </span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                          {sale.paymentMode === 'BOTH' && (
                            <div className="text-[10px] text-gray-500 mt-1">
                              Cash ₹{Number(sale.cashAmount ?? 0).toFixed(2)} · Online ₹{Number(sale.onlineAmount ?? 0).toFixed(2)}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1.5">
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wider w-fit block ${displayStatus === 'PAID' ? 'bg-green-100 text-green-700 border border-green-200' :
                              displayStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700 border border-green-200' :
                                displayStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                  displayStatus === 'CANCELLED' ? 'bg-red-100 text-red-700 border border-red-200' :
                                    displayStatus === 'RETURNED' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                                      displayStatus === 'PARTIALLY_RETURNED' ? 'bg-orange-50 text-orange-600 border border-orange-100' :
                                        'bg-gray-100 text-gray-600 border border-gray-200'
                              }`}>
                              {displayStatus}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleEditBill(sale)}
                              disabled={displayStatus === 'CANCELLED'}
                              className={`p-1.5 rounded-lg transition-all shadow-sm ${displayStatus === 'CANCELLED'
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                : 'bg-sky-50 text-sky-600 hover:bg-sky-600 hover:text-white'
                                }`}
                              title={displayStatus === 'CANCELLED' ? "Bill is already cancelled" : "Cancel / Return Bill"}
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handlePrint(sale)}
                              disabled={displayStatus === 'CANCELLED'}
                              className={`p-1.5 rounded-lg transition-all shadow-sm ${displayStatus === 'CANCELLED'
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-800 hover:text-white'
                                }`}
                              title={displayStatus === 'CANCELLED' ? 'Bill is cancelled' : 'Print Receipt'}
                            >
                              🖨️
                            </button>
                            {/* Receiving slip reprint — only shown when both gates pass and slip not yet printed */}
                            {receiptConfig?.receivingPrint?.enabled &&
                              assignedShops.find(s => s.id?.toString() === sale.shopId?.toString())?.receivingPrintEnabled &&
                              !sale.receivingPrinted &&
                              displayStatus !== 'CANCELLED' && (
                                <button
                                  onClick={() => handlePrintReceiving(sale)}
                                  className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-500 hover:text-white transition-all shadow-sm text-xs font-bold"
                                  title="Print Receiving Slip (not yet printed)"
                                >
                                  📋
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {!loading && totalElements > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 px-4 pb-3 border-t border-gray-100 bg-white rounded-b-xl">
            <p className="text-xs text-gray-500 font-medium">
              <span className="text-indigo-600 font-bold">{totalElements.toLocaleString()}</span> bills
              <span className="ml-2 text-gray-400">— page {page + 1} of {totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(0)}
                disabled={page === 0}
                className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page === 0}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i)
                .filter(p => p === 0 || p === totalPages - 1 || Math.abs(p - page) <= 1)
                .reduce<(number | '...')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === '...' ? (
                    <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      className={`w-7 h-7 text-xs rounded-lg border font-medium transition-colors ${page === p
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                    >
                      {(p as number) + 1}
                    </button>
                  )
                )}

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => goToPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      ` }} />
    </AppLayout>
  );
}