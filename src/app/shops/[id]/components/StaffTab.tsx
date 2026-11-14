'use client';

import { useState } from 'react';
import { MuiSearchSelect } from '@/components/ui/MuiSearchSelect';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface Props {
  shopName: string;
  staff: any[];
  users: any[];
  onAssignSubmit: (userId: string) => Promise<void>;
  submitting: boolean;
  onUnassignSubmit: (userId: number) => Promise<void>;
  unassigning: boolean;
}

export default function StaffTab({
  shopName,
  staff,
  users,
  onAssignSubmit,
  submitting,
  onUnassignSubmit,
  unassigning,
}: Props) {
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [unassignTarget, setUnassignTarget] = useState<{ userId: number; name: string } | null>(null);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onAssignSubmit(selectedUserId);
      // only close on success — onAssignSubmit throws on failure
      setShowAssignModal(false);
      setSelectedUserId('');
    } catch {
      // parent already showed error toast — keep modal open so user can retry
    }
  };

  const handleUnassignConfirm = async () => {
    if (!unassignTarget) return;
    const { userId } = unassignTarget;
    setUnassignTarget(null);
    try {
      await onUnassignSubmit(userId);
    } catch {
      // parent handled error toast
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            <span className="font-bold text-gray-800">{staff.length}</span>{' '}
            staff member{staff.length !== 1 ? 's' : ''} assigned
          </p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Assign Staff
          </button>
        </div>

        {/* Staff table */}
        {staff.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-600">Full Name</th>
                  <th className="p-4 text-left font-semibold text-gray-600">Username</th>
                  <th className="p-4 text-left font-semibold text-gray-600">Role</th>
                  <th className="p-4 text-left font-semibold text-gray-600">Status</th>
                  <th className="p-4 text-left font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {staff.map((s, i) => {
                  const fullName = s.userDetails?.fullName || s.fullName || 'N/A';
                  const username = s.userDetails?.username || s.username || 'N/A';
                  const role = s.userDetails?.roles?.[0] ?? s.roleCode ?? s.role ?? 'N/A';
                  const isActive = s.isActive !== false;
                  const userId = s.userId ?? s.userDetails?.id ?? s.id;

                  return (
                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-medium text-gray-800">{fullName}</td>
                      <td className="p-4 text-gray-600">{username}</td>
                      <td className="p-4 text-gray-600">{role}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                          isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setUnassignTarget({ userId, name: fullName })}
                          disabled={unassigning}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title={`Unassign ${fullName} from this shop`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                          </svg>
                          Unassign
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <div className="text-5xl">👥</div>
            <h4 className="text-base font-bold text-gray-700">No staff assigned</h4>
            <p className="text-sm text-gray-500">Use the Assign Staff button to add team members to this shop.</p>
          </div>
        )}
      </div>

      {/* ── Assign Staff Modal ── */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 p-6 rounded-2xl w-full max-w-md shadow-2xl ring-1 ring-black/5">
            <h3 className="text-lg font-semibold mb-4">Assign User to {shopName}</h3>
            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <MuiSearchSelect
                label="User"
                value={selectedUserId}
                onChange={setSelectedUserId}
                options={users.map(u => ({
                  value: u.id,
                  label: `${u.fullName} (${u.username}) — ${u.roles?.[0] ?? ''}`
                }))}
                searchPlaceholder="Search by name or username..."
                required
              />

              {selectedUserId && (() => {
                const u = users.find(u => String(u.id) === String(selectedUserId));
                return u ? (
                  <div className="px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700 font-medium">
                    Role will be assigned as: <span className="font-bold">{u.roles?.[0] ?? 'N/A'}</span>
                  </div>
                ) : null;
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAssignModal(false); setSelectedUserId(''); }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedUserId || submitting}
                  className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Unassign Confirm Dialog ── */}
      <ConfirmDialog
        open={!!unassignTarget}
        title={`Unassign ${unassignTarget?.name}?`}
        message={`This will remove ${unassignTarget?.name} from ${shopName}. They can be reassigned later.`}
        confirmLabel="Unassign"
        cancelLabel="Keep Assigned"
        variant="warning"
        onConfirm={handleUnassignConfirm}
        onCancel={() => setUnassignTarget(null)}
      />
    </>
  );
}
