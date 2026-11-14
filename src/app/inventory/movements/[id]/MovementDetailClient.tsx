'use client';

import { useLegacyParams } from '@/lib/routeParams';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { useInventory } from '../../context/InventoryContext';
import { canViewStockMovementHistory, canModifyStockMovementHistory } from '@/lib/auth';

interface Movement {
  id: number;
  productId: number;
  eventId: number;
  shopId: number | null;
  username: string;
  movementType: 'IN' | 'OUT' | 'ADJUSTMENT' | 'TRANSFER';
  quantity: number;
  reason: string;
  locationFrom: string;
  locationTo: string;
  movementDate: string;
  relatedMovementId: number | null;
  status: 'ACTIVE' | 'EDITED' | 'ROLLED_BACK';
}

const statusBadge: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-600 border-green-200',
  EDITED: 'bg-amber-50 text-amber-600 border-amber-200',
  ROLLED_BACK: 'bg-red-50 text-red-600 border-red-200',
};

// Only these movementType changes are accepted by the backend for edit — both sides of the
// change must be a MAIN-only type (IN/OUT/ADJUSTMENT), never introducing/removing TRANSFER.
const MAIN_ONLY_TYPES = ['IN', 'OUT', 'ADJUSTMENT'];

export default function MovementDetailPage() {
  const params = useLegacyParams();
  const router = useRouter();
  const { products, shops, stocks, salesRecords } = useInventory();
  const id = params?.id as string;

  const [canView, setCanView] = useState<boolean | null>(null);
  const [canModify, setCanModify] = useState(false);
  const [movement, setMovement] = useState<Movement | null>(null);
  const [related, setRelated] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editType, setEditType] = useState('');

  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  useEffect(() => {
    setCanView(canViewStockMovementHistory());
    setCanModify(canModifyStockMovementHistory());
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/inventory/stock-movements/${id}`);
      if (res.ok) {
        const body = await res.json();
        const data = body.data || body;
        setMovement(data.movement);
        setRelated(data.relatedMovements || []);
      } else if (res.status === 404) {
        setError('Movement not found.');
      } else if (res.status === 403) {
        setError('You do not have permission to view this movement.');
      } else {
        setError('Failed to load movement detail.');
      }
    } catch (e) {
      setError('Network error while loading movement detail.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (canView) load();
  }, [canView, load]);

  const productName = (pid: number) => products.find((p) => p.id === pid)?.name || `#${pid}`;
  const shopLabel = (sid: number | null) => {
    if (!sid) return '—';
    const shop = shops.find((s) => s.id === sid);
    return shop ? `${shop.shopName} (Counter ${shop.counterNumber})` : `Shop #${sid}`;
  };

  // Live MAIN warehouse balance for this product — same `stocks` list the Inventory/Stock
  // tab uses, so this always matches what that page currently shows.
  const mainLiveStock = (pid: number) => stocks.find((s) => s.productId === pid)?.quantity;

  // Live counter balance for this product at the shop this movement touched — same
  // aggregation IssueRecordsList uses when grouping counter records by product, so it
  // matches what the Issue tab currently shows for that counter.
  const shopLiveStock = (pid: number, sid: number) => {
    const matches = salesRecords.filter(
      (s) => s.productId === pid && parseInt(s.shopId) === sid
    );
    if (matches.length === 0) return undefined;
    return matches.reduce((sum, s) => sum + (s.liveQuantity ?? s.quantity ?? 0), 0);
  };

  const startEdit = () => {
    if (!movement) return;
    setEditQty(String(movement.quantity));
    setEditReason(movement.reason || '');
    setEditType(movement.movementType);
    setActionError('');
    setEditing(true);
  };

  const submitEdit = async () => {
    if (!movement) return;
    setActionLoading(true);
    setActionError('');
    try {
      const payload: any = {
        quantity: editQty !== '' ? parseInt(editQty, 10) : null,
        reason: editReason,
        movementType: editType !== movement.movementType ? editType : null,
      };
      const res = await apiClient.patch(`/inventory/stock-movements/${movement.id}`, payload);
      if (res.ok) {
        setEditing(false);
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.message || 'Failed to save changes.');
      }
    } catch (e) {
      setActionError('Network error while saving changes.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitRollback = async () => {
    if (!movement) return;
    setActionLoading(true);
    setActionError('');
    try {
      const res = await apiClient.post(`/inventory/stock-movements/${movement.id}/rollback`, {});
      if (res.ok) {
        setShowRollbackConfirm(false);
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionError(err.message || 'Failed to roll back this movement.');
      }
    } catch (e) {
      setActionError('Network error while rolling back this movement.');
    } finally {
      setActionLoading(false);
    }
  };

  if (canView === false) {
    return <div className="p-8 text-center text-gray-500">You do not have permission to view movement history.</div>;
  }
  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }
  if (error || !movement) {
    return (
      <div className="p-8 text-center text-red-500">
        {error || 'Movement not found.'}
        <div className="mt-4">
          <button onClick={() => router.back()} className="text-indigo-600 font-semibold">← Go back</button>
        </div>
      </div>
    );
  }

  const isShopTouching = movement.shopId != null;
  const isActive = movement.status === 'ACTIVE';
  const backHref = isShopTouching ? '/inventory/issue/history' : '/inventory/stock/history';

  return (
    <div className="w-full bg-white sm:rounded-2xl sm:border border-indigo-50 p-3 sm:p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] animate-fade-in-up max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-3">
          <div className="bg-indigo-100 text-indigo-700 p-2 rounded-xl">🧾</div>
          Movement #{movement.id}
        </h3>
        <button onClick={() => router.push(backHref)} className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">
          ← Back to History
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Field label="Product" value={productName(movement.productId)} />
        <Field label="Shop / Counter" value={shopLabel(movement.shopId)} />
        <Field label="Type" value={movement.movementType} />
        <Field label="Quantity" value={String(movement.quantity)} />
        <Field label="From → To" value={`${movement.locationFrom} → ${movement.locationTo}`} mono />
        <Field label="Reason" value={movement.reason} />
        <Field label="Recorded By" value={movement.username} />
        <Field label="Date" value={new Date(movement.movementDate).toLocaleString()} />
        <div>
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Status</p>
          <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${statusBadge[movement.status]}`}>
            {movement.status}
          </span>
        </div>
      </div>

      <div className={`grid gap-3 mb-6 ${isShopTouching ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <LiveStockCard
          label="Live Stock in Inventory (MAIN)"
          value={mainLiveStock(movement.productId)}
        />
        {isShopTouching && (
          <LiveStockCard
            label={`Live Stock in Shop (${shopLabel(movement.shopId)})`}
            value={shopLiveStock(movement.productId, movement.shopId as number)}
          />
        )}
      </div>

      {actionError && <div className="p-3 mb-4 bg-red-50 text-red-600 text-sm rounded-xl">{actionError}</div>}

      {canModify && isActive && !editing && (
        <div className="flex gap-3 mb-6">
          <button
            onClick={startEdit}
            className="px-5 py-2.5 bg-sky-50 border border-sky-200 text-sky-700 rounded-xl text-sm font-bold hover:bg-sky-100"
          >
            Edit
          </button>
          <button
            onClick={() => { setActionError(''); setShowRollbackConfirm(true); }}
            className="px-5 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100"
          >
            Rollback
          </button>
        </div>
      )}
      {canModify && !isActive && (
        <p className="text-xs text-gray-400 mb-6">
          This movement has already been {movement.status.toLowerCase().replace('_', ' ')} and can no longer be edited or rolled back directly — see the related entry below.
        </p>
      )}

      {editing && (
        <div className="border border-sky-100 bg-sky-50/50 rounded-xl p-4 mb-6 space-y-3">
          <h4 className="font-bold text-sky-800 text-sm">Edit Movement</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500">Quantity</label>
              <input
                type="number"
                min={editType === 'ADJUSTMENT' ? undefined : '1'}
                value={editQty}
                onChange={(e) => setEditQty(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm mt-1"
              />
              {editType !== 'ADJUSTMENT' && (
                <p className="text-[10px] text-gray-400 mt-1">Negative quantity is only allowed for ADJUSTMENT.</p>
              )}
            </div>
            <div>
              <MuiSelect
                label="Type"
                value={editType}
                onChange={(val) => setEditType(val)}
                disabled={isShopTouching}
                size="small"
                options={
                  isShopTouching
                    ? [{ value: movement.movementType, label: movement.movementType }]
                    : MAIN_ONLY_TYPES.map((t) => ({ value: t, label: t }))
                }
              />
              {isShopTouching && (
                <p className="text-[10px] text-gray-400 mt-1">Type cannot be changed on a movement that touches a shop counter.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Reason</label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-sm mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={submitEdit}
              disabled={actionLoading}
              className="px-5 py-2 bg-sky-600 text-white rounded-xl text-sm font-bold hover:bg-sky-700 disabled:opacity-50"
            >
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {showRollbackConfirm && (
        <div className="border border-red-100 bg-red-50/50 rounded-xl p-4 mb-6 space-y-3">
          <h4 className="font-bold text-red-800 text-sm">Confirm Rollback</h4>
          <p className="text-sm text-red-700">
            This will move {movement.quantity} unit(s) of {productName(movement.productId)} back
            from <span className="font-mono">{movement.locationTo}</span> to{' '}
            <span className="font-mono">{movement.locationFrom}</span>, and mark this movement as
            ROLLED_BACK. This cannot be undone directly — a further rollback would be needed.
          </p>
          <div className="flex gap-3 justify-end">
            <button onClick={() => setShowRollbackConfirm(false)} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
              Cancel
            </button>
            <button
              onClick={submitRollback}
              disabled={actionLoading}
              className="px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading ? 'Rolling back...' : 'Confirm Rollback'}
            </button>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-bold text-gray-700 text-sm mb-3">Related Movements</h4>
        {related.length === 0 ? (
          <p className="text-sm text-gray-400">No related movements found.</p>
        ) : (
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-50">
            {related.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/inventory/movements/${r.id}`)}
                className="p-3 flex justify-between items-center hover:bg-gray-50 cursor-pointer text-sm"
              >
                <div>
                  <span className="font-semibold text-gray-800">#{r.id}</span>{' '}
                  <span className="text-gray-500">{r.movementType} · {r.quantity} · {r.reason}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${statusBadge[r.status]}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-sm font-semibold text-gray-800 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

/** Current live balance snapshot, shown alongside a movement's (fixed, historical) quantity
 * so it's clear this number can differ from what the movement itself moved — other
 * movements before/after this one, or edits/rollbacks, can have shifted it since. */
function LiveStockCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
      <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-black text-indigo-700">
        {value !== undefined ? value : <span className="text-sm font-semibold text-gray-400">Unknown</span>}
      </p>
    </div>
  );
}
