'use client';

import { useEffect, useRef, useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import UserControls from './components/UserControls';
import UserMobileCardStack from './components/UserMobileCardStack';
import UserModalsContainer from './components/UserModalsContainer';
import UserStatsBanner from './components/UserStatsBanner';
import UserTable from './components/UserTable';
import { apiClient } from '@/lib/api';
import { matchItems } from '@/lib/searchMatch';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { getMatchedEventRole } from './utils';

export default function UserPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allShops, setAllShops] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [shopFilter, setShopFilter] = useState<string>('ALL');
  const { eventId: currentEventId } = useActiveEvent();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchedRef = useRef(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditDetailsModal, setShowEditDetailsModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  const [createFormData, setCreateFormData] = useState({ username: '', email: '', mobile: '', password: '', fullName: '', role: '', eventId: '' });
  const [editFormData, setEditFormData] = useState({ email: '', mobile: '', fullName: '', password: '', role: '', eventId: '', shopId: '' });
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const fetchAllData = async () => {
    let enrichedUsers: any[] = [];
    try {
      // Fetch users directly from user-service — this bypasses sales-service UserClient
      // which has a roles type issue (UserDTO.roles) that requires a Docker rebuild.
      // User-service returns roles as string[] natively, so filters always work.
      const [usersRes, pageInitRes] = await Promise.all([
        apiClient.get('/users/allUsers'),
        apiClient.get('/page-init?include=roles,shopStaffAssignments,shops,events'),
      ]);

      let assignments: any[] = [];

      if (pageInitRes.ok) {
        const data = await pageInitRes.json();
        if (data.roles)  setRoles(Array.isArray(data.roles)  ? data.roles  : []);
        assignments = Array.isArray(data.shopStaffAssignments) ? data.shopStaffAssignments : [];
        if (data.shops)  setAllShops(Array.isArray(data.shops)  ? data.shops  : []);
        if (data.events) setAllEvents(Array.isArray(data.events) ? data.events : []);

        // page-init may return stale/empty shopStaffAssignments due to Redis caching.
        // Fall back to the dedicated bulk endpoint — single call, no N+1.
        if (assignments.length === 0) {
          try {
            const allStaffRes = await apiClient.get('/shops-staff/allusers');
            if (allStaffRes.ok) {
              const allStaff = await allStaffRes.json();
              if (Array.isArray(allStaff)) {
                assignments = allStaff
                  .filter((s: any) => s.isActive !== false)
                  .map((s: any) => ({ userId: s.userId, shopId: s.shopId, eventId: s.eventId }));
              }
            }
          } catch (e) {
            console.error('Bulk staff fetch failed:', e);
          }
        }
      } else {
        // page-init not yet deployed — fall back to individual endpoints
        const [rRes, sRes, eRes] = await Promise.all([
          apiClient.get('/roles'),
          apiClient.get('/shops'),
          apiClient.get('/events'),
        ]);
        if (rRes.ok) setRoles(await rRes.json());
        if (sRes.ok) setAllShops(await sRes.json());
        if (eRes.ok) {
          const ev = await eRes.json();
          setAllEvents(Array.isArray(ev) ? ev : ev.data ?? []);
        }
      }

      if (usersRes.ok) {
        const raw = await usersRes.json();
        const users: any[] = Array.isArray(raw) ? raw : [];
        // Scope shop assignments to the currently active event — a user can be assigned to
        // a different shop per event, and an unscoped map would silently pick whichever
        // assignment happened to come last from the backend, not the one relevant here.
        const scopedAssignments = currentEventId
          ? assignments.filter((a: any) => String(a.eventId) === String(currentEventId))
          : assignments;
        const assignMap = new Map(scopedAssignments.map((a: any) => [a.userId, a.shopId]));
        enrichedUsers = users.map((u: any) => ({
          ...u,
          shopId: assignMap.get(u.id) ?? null,
        }));
        setAllUsers(enrichedUsers);
      }
    } catch (e) { console.error(e); }
    return enrichedUsers;
  };

  const handleRefresh = async () => {
    setRoleFilter('ALL');
    setShopFilter('ALL');
    setSearchQuery('');
    await fetchAllData();
  };

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1); }, [searchQuery, roleFilter, shopFilter]);

  // Auto-reset shopFilter when the selected shop doesn't belong to the current event
  useEffect(() => {
    if (shopFilter === 'ALL' || shopFilter === 'NONE') return;
    if (!currentEventId || allShops.length === 0) return;
    const selectedShop = allShops.find((s: any) => String(s.id) === String(shopFilter));
    if (!selectedShop || String(selectedShop.eventId) !== String(currentEventId)) {
      setShopFilter('ALL');
    }
  }, [shopFilter, currentEventId, allShops]);

  useEffect(() => {
    // Guard against React 18 StrictMode double-invoking effects in development
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const init = async () => {
      const username = localStorage.getItem('username');
      const enrichedUsers = await fetchAllData();
      if (username && enrichedUsers.length > 0) {
        const matched = enrichedUsers.find(u => u.username === username);
        if (matched) setCurrentUser(matched);
      }
      setLoading(false);
    };
    init();
  }, []);

  const triggerSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setShowSuccessModal(true);
    fetchAllData();
  };

  const triggerError = (msg: string) => {
    setErrorMessage(msg);
    setShowErrorModal(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createFormData.role) {
      triggerError('Please select a role for the new user.');
      return;
    }
    try {
      const resp = await apiClient.post('/users/register', createFormData);
      if (resp.ok) {
        setShowCreateModal(false);
        triggerSuccess(`User ${createFormData.username} registered successfully`);
        setCreateFormData({ username: '', email: '', mobile: '', password: '', fullName: '', role: '', eventId: '' });
      } else {
        triggerError((await resp.json()).message || 'Registration failed');
      }
    } catch { triggerError('Network error'); }
  };

  const handleUpdateDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const username = editingUser.username;
    const admin = localStorage.getItem('username');

    // Guard: a role can only be assigned scoped to a specific event. If the Scope Event
    // dropdown is still "N/A" (unselected), the backend requires eventId and will reject
    // the request — catch that here with a clear message instead of sending it silently.
    if (editFormData.role && !editFormData.eventId) {
      triggerError('Select an event before assigning a role — this user is not currently assigned to the active event.');
      return;
    }

    try {
      // 1. Profile details update
      const profilePayload = {
        fullName: editFormData.fullName,
        email: editFormData.email,
        mobile: editFormData.mobile,
        ...(editFormData.password ? { password: editFormData.password } : {})
      };
      const profileResp = await apiClient.put(`/users/${username}`, profilePayload);
      if (!profileResp.ok) {
        triggerError((await profileResp.json()).message || 'Profile update failed');
        return;
      }

      // 2. Event & Role Alignment update (if changed)
      const originalMatched = getMatchedEventRole(editingUser, currentEventId);
      const originalRole = originalMatched?.roleName || '';
      const originalEventId = originalMatched?.eventId?.toString() || '';
      if (editFormData.role !== originalRole || editFormData.eventId !== originalEventId) {
        if (editFormData.role) {
          const rObj = roles.find(r => r.name === editFormData.role);
          if (rObj) {
            const roleResp = await apiClient.put('/users-role', { userId: editingUser.id, roleIds: [rObj.id || rObj.name], eventId: editFormData.eventId }, { 'X-Username': admin || '', 'X-Roles': 'ADMIN' });
            if (!roleResp.ok) {
              const msg = await roleResp.json().catch(() => null);
              triggerError(msg?.message || 'Role/event assignment update failed');
              return;
            }
          }
        }
      }

      // 3. Shop Assignment update (if changed)
      const originalShopId = editingUser.shopId?.toString() || '';
      if (editFormData.shopId !== originalShopId) {
        if (editFormData.shopId) {
          const shopResp = await apiClient.post('/shops-staff/assign', { shopId: parseInt(editFormData.shopId), userId: editingUser.id });
          if (!shopResp.ok) {
            const msg = await shopResp.json().catch(() => null);
            triggerError(msg?.message || 'Shop assignment update failed');
            return;
          }
        }
      }

      setShowEditDetailsModal(false);
      triggerSuccess(`Successfully updated configuration for user "${username}"`);
    } catch (err) {
      console.error(err);
      triggerError('Failed to save some configurations. Please check database connectivity.');
    }
  };

  const executeDeleteUser = async () => {
    if (!userToDelete) return;
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('username');
    const isLoggedInUserAdmin = !!(role === 'ADMIN' || name === 'admin' || name?.endsWith('_admin'));
    if (!isLoggedInUserAdmin) {
      triggerError("Only administrators can delete accounts.");
      setShowDeleteConfirm(false);
      return;
    }

    const userObj = allUsers.find(u => u.username === userToDelete);
    const hasAdminRole = userObj && (userObj.roles || []).some((r: string) => r.toUpperCase().includes('ADMIN'));
    const isNamedAdmin = userToDelete.toLowerCase() === 'admin' || userToDelete.endsWith('_admin');
    if (hasAdminRole || isNamedAdmin) {
      triggerError("Admin users cannot be deleted.");
      setShowDeleteConfirm(false);
      return;
    }

    const resp = await apiClient.delete(`/users/${userToDelete}`, { 'X-Username': localStorage.getItem('username') || '', 'X-Roles': 'ADMIN' });
    if (resp.ok) triggerSuccess(`Deleted account`);
    setShowDeleteConfirm(false);
  };

  const handleDeleteUserClick = (username: string) => {
    setUserToDelete(username);
    setShowDeleteConfirm(true);
  };

  const searchMatchedUsers = new Set(
    matchItems(searchQuery, allUsers, (u) => [u.username, u.fullName], Infinity)
  );

  const filteredUsers = allUsers.filter(user => {
    const match = searchMatchedUsers.has(user);
    let matchesRole = true;
    if (roleFilter !== 'ALL') {
      // Filter by the role paired with the currently active event, not any role the user
      // happens to hold for some other event.
      const matched = getMatchedEventRole(user, currentEventId);
      if (roleFilter === 'NONE') {
        matchesRole = !matched;
      } else {
        matchesRole = matched?.roleName === roleFilter;
      }
    }

    let matchesShop = true;
    if (shopFilter !== 'ALL') {
      if (shopFilter === 'NONE') {
        matchesShop = !user.shopId;
      } else {
        matchesShop = String(user.shopId) === String(shopFilter);
      }
    }

    return match && matchesRole && matchesShop;
  });

  const paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const totalAdmins = allUsers.filter(u => (u.roles || []).some((r: string) => r.toUpperCase().includes('ADMIN'))).length;

  const loggedInRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
  const loggedInUsername = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
  const isLoggedInUserAdmin = !!(loggedInRole === 'ADMIN' || loggedInUsername === 'admin' || loggedInUsername?.endsWith('_admin'));

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 px-4 sm:px-6 lg:px-8">
        <UserStatsBanner
          fullName={currentUser?.fullName}
          username={currentUser?.username}
          totalUsers={allUsers.length}
          adminCount={totalAdmins}
        />

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <UserControls
            searchQuery={searchQuery} setSearchQuery={setSearchQuery}
            roleFilter={roleFilter} setRoleFilter={setRoleFilter}
            roles={roles}
            onRefresh={handleRefresh} onCreateOpen={() => setShowCreateModal(true)}
            shopFilter={shopFilter} setShopFilter={setShopFilter}
            allShops={allShops}
            currentEventId={currentEventId}
          />

          {/* Desktop Table View */}
          <div className="hidden lg:block p-4 bg-slate-50/10">
            <UserTable
              paginatedUsers={paginatedUsers}
              isLoggedInUserAdmin={isLoggedInUserAdmin}
              roles={roles}
              allEvents={allEvents}
              allShops={allShops}
              currentEventId={currentEventId}
              setEditingUser={setEditingUser}
              setEditFormData={setEditFormData}
              setShowEditDetailsModal={setShowEditDetailsModal}
              handleDeleteUser={handleDeleteUserClick}
            />
          </div>

          {/* Mobile Grid View */}
          <div className="block lg:hidden">
            <UserMobileCardStack
              paginatedUsers={paginatedUsers}
              isLoggedInUserAdmin={isLoggedInUserAdmin}
              roles={roles}
              allEvents={allEvents}
              allShops={allShops}
              currentEventId={currentEventId}
              onDeleteTrigger={(u) => { setUserToDelete(u); setShowDeleteConfirm(true); }}
              onEditDetailsOpen={(u) => {
                const matched = getMatchedEventRole(u, currentEventId);
                setEditingUser(u);
                setEditFormData({
                  fullName: u.fullName || '',
                  email: u.email || '',
                  mobile: u.mobile || '',
                  password: '',
                  role: matched?.roleName || '',
                  eventId: matched?.eventId?.toString() || '',
                  shopId: u.shopId?.toString() || ''
                });
                setShowEditDetailsModal(true);
              }}
            />
          </div>
        </div>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-medium">
              <span className="text-indigo-600 font-bold">{filteredUsers.length}</span> users
              {filteredUsers.length !== allUsers.length && <> (filtered from {allUsers.length})</>}
              <span className="ml-2 text-gray-400">— page {currentPage} of {totalPages}</span>
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                «
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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
                      onClick={() => setCurrentPage(p as number)}
                      className={`w-7 h-7 text-xs rounded-lg border font-medium transition-colors ${
                        currentPage === p
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                »
              </button>
            </div>
          </div>
        )}

        <UserModalsContainer
          modalsState={{ showCreate: showCreateModal, setShowCreate: setShowCreateModal, showEdit: showEditDetailsModal, setShowEdit: setShowEditDetailsModal, showSuccess: showSuccessModal, setShowSuccess: setShowSuccessModal, showError: showErrorModal, setShowError: setShowErrorModal, showDelete: showDeleteConfirm, setShowDelete: setShowDeleteConfirm }}
          formsData={{ createData: createFormData, setCreateData: setCreateFormData, editData: editFormData, setEditData: setEditFormData }}
          messages={{ success: successMessage, error: errorMessage, userToDelete }}
          roles={roles}
          allEvents={allEvents}
          allShops={allShops}
          handlers={{ onCreateSubmit: handleCreateUser, onEditSubmit: handleUpdateDetailsSubmit, onDeleteExecute: executeDeleteUser, onDeleteCancel: () => setShowDeleteConfirm(false) }}
        />
      </div>
    </AppLayout>
  );
}