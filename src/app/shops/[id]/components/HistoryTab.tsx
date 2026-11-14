'use client';

import { formatISTDateTime } from '@/lib/dateUtils';
import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MuiSearchSelect } from '@/components/ui/MuiSearchSelect';
import { ContentLoader } from '@/components/ui/ContentLoader';

// Event types that represent a sale (or something that happened to one) and can be
// deep-linked to the Sales page's "Look Up Bill" flow via orderNo/invoiceNo.
const SALE_LOOKUP_EVENT_TYPES = new Set(['SALE', 'SALE_CANCELLED', 'SALE_PARTIALLY_RETURNED']);

const PAGE_SIZE = 10;

interface HistoryEvent {
  type: string;
  timestamp: string;
  description: string;
  metadata?: Record<string, any>;
}

interface HistoryData {
  events: HistoryEvent[];
}

interface Props {
  historyData: HistoryData | null;
  loading: boolean;
  users: any[];
}

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'SHOP_OPENED', label: 'Shop Opened' },
  { value: 'STAFF_ASSIGNED', label: 'Staff Assigned' },
  { value: 'STAFF_UNASSIGNED', label: 'Staff Unassigned' },
  { value: 'STOCK_ISSUE', label: 'Stock Issued' },
  { value: 'STOCK_UNISSUE', label: 'Stock Returned' },
  { value: 'SHIFT_OPENING_CASH', label: 'Opening Cash Added' },
  { value: 'SHIFT_FLOAT_ADDED', label: 'Float Cash Added' },
  { value: 'SALE', label: 'Sale' },
  { value: 'SALE_CANCELLED', label: 'Sale Cancelled' },
  { value: 'SALE_PARTIALLY_RETURNED', label: 'Partial Return' },
  { value: 'SHOP_CLOSED', label: 'Shop Closed' },
];


const EVENT_META: Record<string, { icon: string; label: string; bg: string; text: string; border: string }> = {
  SHOP_OPENED:            { icon: '🏪', label: 'Shop Opened',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  STAFF_ASSIGNED:         { icon: '👤', label: 'Staff Assigned',  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  STAFF_UNASSIGNED:       { icon: '🚪', label: 'Staff Unassigned',bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  STOCK_ISSUE:            { icon: '📦', label: 'Stock Issued',    bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  },
  STOCK_UNISSUE:          { icon: '🔄', label: 'Stock Returned',  bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
  SHIFT_OPENING_CASH:     { icon: '💵', label: 'Opening Cash Added', bg: 'bg-teal-50',  text: 'text-teal-700',    border: 'border-teal-200'    },
  SHIFT_FLOAT_ADDED:      { icon: '➕', label: 'Float Cash Added',   bg: 'bg-cyan-50',  text: 'text-cyan-700',    border: 'border-cyan-200'    },
  SALE:                   { icon: '💰', label: 'Sale',            bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200'   },
  SALE_CANCELLED:         { icon: '❌', label: 'Sale Cancelled',  bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  SALE_PARTIALLY_RETURNED:{ icon: '↩️', label: 'Partial Return',  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  SHOP_CLOSED:            { icon: '🔒', label: 'Shop Closed',     bg: 'bg-slate-100',  text: 'text-slate-800',   border: 'border-slate-300'   },
};

export default function HistoryTab({ historyData, loading, users }: Props) {
  const router = useRouter();
  const [filterType, setFilterType] = useState('');
  const [filterUsername, setFilterUsername] = useState('');
  const [filterReason, setFilterReason] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const events = historyData?.events ?? [];
    return events
      .filter(ev => {
        if (filterType && ev.type !== filterType) return false;
        if (filterReason) {
          const reason = (ev.metadata?.reason || '').toLowerCase();
          if (!reason.includes(filterReason.toLowerCase())) return false;
        }
        if (filterProduct) {
          const needle = filterProduct.toLowerCase();

          // STOCK_ISSUE/STOCK_UNISSUE/SALE_PARTIALLY_RETURNED carry a single
          // productName; SALE/SALE_CANCELLED carry a comma-joined productNames
          // string (an order can have multiple line items).
          const productText = String(
            ev.metadata?.productName ?? ev.metadata?.productNames ?? ''
          ).toLowerCase();

          if (!productText.includes(needle)) return false;
        }
        if (filterUsername) {
          const needle = filterUsername.toLowerCase();

          // Each event type stores "who did it" under a different metadata key
          // (or, for staff events, as a userId that needs resolving to a name).
          const actorFieldByType: Record<string, string> = {
            STAFF_ASSIGNED: 'assignedBy',
            STAFF_UNASSIGNED: 'unassignedBy',
            SALE: 'sellerName',
            SALE_CANCELLED: 'processedBy',
            SALE_PARTIALLY_RETURNED: 'processedBy',
            SHOP_OPENED: 'openedBy',
            SHIFT_OPENING_CASH: 'openedBy',
            SHIFT_FLOAT_ADDED: 'addedBy',
            SHOP_CLOSED: 'closedBy',
            STOCK_ISSUE: 'issuedBy',
            STOCK_UNISSUE: 'unissuedBy',
          };

          const actorField = actorFieldByType[ev.type];
          let matched = false;

          if (actorField && ev.metadata?.[actorField]) {
            matched = String(ev.metadata[actorField]).toLowerCase().includes(needle);
          }

          // Cancelled sales recorded before "cancelled by" was tracked have no processedBy —
          // keep matching them on the seller so older entries stay filterable.
          if (!matched && ev.type === 'SALE_CANCELLED' && ev.metadata?.sellerName) {
            matched = String(ev.metadata.sellerName).toLowerCase().includes(needle);
          }

          // Fallback: some events (e.g. staff assigned/unassigned) also carry a
          // userId referring to the staff member themselves — match on that too
          // so searching a staff member's own name still works.
          if (!matched && ev.metadata?.userId != null) {
            const user = users.find(u => u.id === ev.metadata.userId);
            const uname = (user?.username || user?.fullName || '').toLowerCase();
            matched = uname.includes(needle);
          }

          if (!matched) return false;
        }
        return true;
      })
      // Most recent event first
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [historyData, filterType, filterUsername, filterReason, filterProduct, users]);

  // Reset to page 1 whenever filters change or new data arrives
  useEffect(() => { setPage(1); }, [filterType, filterUsername, filterReason, filterProduct, historyData]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasActiveFilters = filterType || filterUsername || filterReason || filterProduct;

  if (loading) {
    return <ContentLoader message="Loading history..." />;
  }

  return (
    <div className="space-y-5">
      {/* Filter Bar */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Event Type */}
          <MuiSearchSelect
            label="Event Type"
            value={filterType}
            onChange={setFilterType}
            options={EVENT_TYPE_OPTIONS}
            searchPlaceholder="Search event type..."
            size="medium"
          />

          {/* Username search */}
          <input
            type="text"
            placeholder="Filter by username..."
            value={filterUsername}
            onChange={e => setFilterUsername(e.target.value)}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          {/* Movement Reason */}
          <input
            type="text"
            placeholder="Filter by reason..."
            value={filterReason}
            onChange={e => setFilterReason(e.target.value)}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

          {/* Product search */}
          <input
            type="text"
            placeholder="Filter by product name..."
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />

        </div>
        {hasActiveFilters && (
          <button
            onClick={() => { setFilterType(''); setFilterUsername(''); setFilterReason(''); setFilterProduct(''); }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-500 font-medium">
        {hasActiveFilters
          ? <>Showing <span className="text-indigo-600 font-bold">{filtered.length}</span> of {historyData?.events?.length ?? 0} events</>
          : <><span className="text-indigo-600 font-bold">{historyData?.events?.length ?? 0}</span> total events</>
        }
        {filtered.length > 0 && (
          <span className="ml-2 text-gray-400">— page {page} of {totalPages}</span>
        )}
      </p>

      {/* Timeline */}
      {filtered.length > 0 ? (
        <div className="relative border-l-2 border-indigo-100 ml-4 pl-8 space-y-8 py-2">
          {paginated.map((event, index) => {
            const meta = EVENT_META[event.type] || { icon: '📝', label: 'Activity', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

            const formattedDate = event.timestamp
              ? formatISTDateTime(event.timestamp)
              : 'Unknown Date';

            return (
              <div key={index} className="relative group">
                <div className={`absolute -left-[45px] top-1.5 w-7 h-7 rounded-full border-2 ${meta.border} ${meta.bg} flex items-center justify-center text-sm shadow-sm group-hover:scale-110 transition-transform z-10`}>
                  {meta.icon}
                </div>

                <div className="bg-white border border-gray-100 p-5 rounded-2xl hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase ${meta.bg} ${meta.text}`}>
                      {meta.label}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">📅 {formattedDate}</span>
                  </div>

                  <p className="text-sm font-semibold text-gray-800 mb-3">{event.description}</p>

                  {SALE_LOOKUP_EVENT_TYPES.has(event.type) && (() => {
                    // Prefer the bill's own invoice number when the event carries one
                    // (e.g. a partial return's billingInvoiceNumber); otherwise fall back
                    // to the sales order number — both are accepted by the lookup page.
                    const invoiceNo = event.metadata?.billingInvoiceNumber;
                    const orderNo = event.metadata?.orderNumber;
                    if (!invoiceNo && !orderNo) return null;
                    const params = new URLSearchParams({ tab: 'cancel' });
                    if (invoiceNo) params.set('invoiceNo', String(invoiceNo));
                    if (orderNo) params.set('orderNo', String(orderNo));
                    return (
                      <button
                        onClick={() => router.push(`/sales?${params.toString()}`)}
                        className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                      >
                        🧾 View Bill
                      </button>
                    );
                  })()}

                  {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 mt-2">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Details</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-gray-600">
                        {Object.entries(event.metadata).map(([key, value]: [string, any]) => {
                          // Skip category fields — not useful in this context
                          if (key === 'category' || key === 'categoryName' || key === 'categoryId') return null;

                          let displayKey = key;
                          let displayVal = String(value);

                          if (key === 'productId')      { displayKey = 'Product ID'; }
                          else if (key === 'productName')   { displayKey = 'Product Name'; }
                          else if (key === 'productNames')  { displayKey = 'Products'; }
                          else if (key === 'userId') {
                            displayKey = 'User';
                            const u = users.find(u => u.id === value);
                            if (u) displayVal = `${u.fullName} (${u.username})`;
                          }
                          else if (key === 'roleCode')      { displayKey = 'Assigned Role'; }
                          else if (key === 'amount')        { displayKey = 'Sale Amount'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'discountAmount'){ displayKey = 'Discount'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'refundAmount')  { displayKey = 'Refund Amount'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'mrp')           { displayKey = 'MRP'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'sellingPrice')  { displayKey = 'Selling Price'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'returnedQty')   { displayKey = 'Returned Qty'; }
                          else if (key === 'processedBy')   { displayKey = 'Processed By'; }
                          else if (key === 'shiftSessionId'){ displayKey = 'Shift'; displayVal = `#${value}`; }
                          else if (key === 'counterNumber') { displayKey = 'Counter'; }
                          else if (key === 'cashBefore')    { displayKey = 'Cash Total Before Addition'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'cashAdded')     { displayKey = 'Cash Added'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'cashAfter')     { displayKey = 'Cash Total After Addition'; displayVal = `₹${parseFloat(value).toFixed(2)}`; }
                          else if (key === 'denominations') { displayKey = 'Denominations'; }
                          else if (key === 'addedBy')       { displayKey = 'Added By'; }
                          else if (key === 'orderNumber')   { displayKey = 'Order Number'; }
                          else if (key === 'billingInvoiceNumber') { displayKey = 'Bill No'; }
                          else if (key === 'sellerName')    { displayKey = 'Seller Name'; }
                          else if (key === 'customerName')  { displayKey = 'Customer Name'; }
                          else if (key === 'customerMobile'){ displayKey = 'Customer Mobile'; }
                          else if (key === 'quantity')      { displayKey = 'Quantity'; }
                          else if (key === 'reason')        { displayKey = 'Reason'; }
                          else if (key === 'locationFrom')  { displayKey = 'From'; }
                          else if (key === 'locationTo')    { displayKey = 'To'; }
                          else if (key === 'leftAt')        { displayKey = 'Left At'; }
                          else if (key === 'closedAt')      { displayKey = 'Closed At'; }
                          else if (key === 'openedBy')      { displayKey = 'Opened By'; }
                          else if (key === 'closedBy')      { displayKey = 'Closed By'; }
                          else if (key === 'issuedBy')      { displayKey = 'Issued By'; }
                          else if (key === 'unissuedBy')    { displayKey = 'Unissued By'; }
                          else if (key === 'assignedBy')    { displayKey = 'Assigned By'; }
                          else if (key === 'unassignedBy')  { displayKey = 'Unassigned By'; }
                          else if (key === 'status')        { displayKey = 'Status'; }
                          else if (key === 'receivingPrintEnabledAtShop') {
                            // Shop-level toggle only — receipt printing also needs the event-level
                            // receivingPrint.enabled flag on, so this alone doesn't guarantee printing was live.
                            displayKey = 'Receipt Printing (Shop Setting)';
                            displayVal = value ? 'Enabled' : 'Disabled';
                          }
                          else if (key === 'type')          { return null; } // direction now shown via STOCK_ISSUE/STOCK_UNISSUE label

                          return (
                            <div key={key} className="flex justify-between sm:justify-start gap-4">
                              <span className="text-gray-400">{displayKey}:</span>
                              <span className="text-gray-800 break-all">{displayVal}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="text-5xl">📭</div>
          <h4 className="text-base font-bold text-gray-700">
            {hasActiveFilters ? 'No matching events' : 'No History Available'}
          </h4>
          <p className="text-sm text-gray-500 max-w-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more results.'
              : 'This shop does not have any recorded historical actions yet.'}
          </p>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && filtered.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              «
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>

            {/* Page number buttons — show at most 5 around current page */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
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
                    onClick={() => setPage(p as number)}
                    className={`w-7 h-7 text-xs rounded-lg border font-medium transition-colors ${
                      page === p
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
