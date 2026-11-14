'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { apiClient } from '@/lib/api';
import { useActiveEvent } from '@/hooks/useActiveEvent';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Shop {
  id: number;
  shopName: string;
  categoryId: number;
  categoryName: string;   // Joined from categories table by backend — used as orgName on receipts
  counterNumber: number;
  isActive: boolean;
  eventId: number;
  sellerUser: string;
  supervisor: string;
  /** Per-shop receiving slip toggle. Both this AND event.receivingPrint.enabled
   *  must be true before a receiving slip is printed after checkout. */
  receivingPrintEnabled?: boolean;
}

export interface ShopAssignment {
  userId: number;
  shopId: number;
  eventId: number;
  roleCode: string;
  isActive: boolean;
  /** When this assignment was created — used to order assignedShops so the
   *  most-recently-assigned shop is first (and becomes the default selection). */
  assignedAt?: string;
}

interface ShopContextValue {
  /** Array of full Shop objects the user is assigned to (or all shops for admins) */
  assignedShops: Shop[];
  /** The current active selected shop counter */
  selectedShop: Shop | null;
  /** Set the active selected shop counter */
  setSelectedShop: (shop: Shop | null) => void;
  /** Is the assignment list loading */
  loading: boolean;
  shopReady: boolean;
  /** Manually refresh shop assignments from backend */
  refreshShops: () => Promise<void>;
  /** Check if user is Admin/Accounts */
  isAdmin: boolean;
}

// ─── Context ────────────────────────────────────────────────────────────────

const ShopContext = createContext<ShopContextValue>({
  assignedShops: [],
  selectedShop: null,
  setSelectedShop: () => { },
  loading: false,
  shopReady: false,
  refreshShops: async () => { },
  isAdmin: false,
});

// ─── Provider ───────────────────────────────────────────────────────────────

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const { eventId } = useActiveEvent();
  const [assignedShops, setAssignedShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShopState] = useState<Shop | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [shopReady, setShopReady] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [credentialsSynced, setCredentialsSynced] = useState<boolean>(false);

  // Sync role and username on mount and role changes
  const syncUserCredentials = useCallback(() => {
    const role = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
    const user = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
    setUserRole(role);
    setUsername(user);
    setCredentialsSynced(true);
    const adminCheck = role === 'ADMIN' || role === 'ACCOUNTS' || user === 'admin' || user?.endsWith('_admin');
    setIsAdmin(adminCheck);
  }, []);

  useEffect(() => {
    syncUserCredentials();

    const handleRoleChange = () => {
      syncUserCredentials();
    };

    window.addEventListener('bikri-role-change', handleRoleChange);
    return () => window.removeEventListener('bikri-role-change', handleRoleChange);
  }, [syncUserCredentials]);

  const fetchAssignments = useCallback(async () => {
    const adminCheck = userRole === 'ADMIN' || userRole === 'ACCOUNTS' || username === 'admin' || username?.endsWith('_admin');

    if (!credentialsSynced) {
      return;
    }

    if (!eventId || !username) {
      setAssignedShops([]);
      setSelectedShopState(null);
      setShopReady(true);
      return;
    }

    setLoading(true);
    setShopReady(false);
    try {
      // 1. Grab the active event ID from your localized tracking key name
      const activeEventId = typeof window !== 'undefined'
        ? (localStorage.getItem('active_event_id') || localStorage.getItem('selectedEventId'))
        : null;

      // 2. Inject it explicitly into the manual apiClient configurations block
      const headers: Record<string, string> = activeEventId
        ? { 'X-Event-Id': activeEventId }
        : {};

      // 3. Pass the manual header mapping payload straight to the fetch execution thread
      const shopsRes = await apiClient.get('/shops', headers);
      if (!shopsRes.ok) {
        throw new Error('Failed to fetch shops');
      }
      const shopsData = await shopsRes.json();
      const allShops: Shop[] = Array.isArray(shopsData) ? shopsData : (shopsData.data || []);

      if (adminCheck) {
        // Admins have access to all shops
        setAssignedShops(allShops);

        // Default select first shop if none selected
        if (allShops.length > 0) {
          setSelectedShopState(prev => {
            if (prev && allShops.some(s => s.id === prev.id)) return prev;
            return allShops[0];
          });
        } else {
          setSelectedShopState(null);
        }
        return;
      }

      // 2. Fetch restricted user assignments
      const userRes = await apiClient.get(`/users/${username}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        const userId = userData.id;

        const staffRes = await apiClient.get(`/shops-staff/user/${userId}`, headers);
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          const assignments: ShopAssignment[] = Array.isArray(staffData)
            ? staffData
            : (staffData ? [staffData] : []);

          // Filter active assignments for the current event
          const activeEventAssignments = assignments.filter(
            a => a.isActive && String(a.eventId) === String(eventId)
          );

          // Match full shop objects, ordered by assignedAt descending so the
          // most-recently-assigned shop is first — that's what "Pre-select first
          // assigned shop" below then picks as the default across every MuiSelect
          // shop picker (Sales, Billing, Shifts, etc.) that reads assignedShops[0].
          const assignmentByShopId = new Map(
            activeEventAssignments.map(assign => [assign.shopId, assign])
          );
          const matchedShops = allShops
            .filter(shop => assignmentByShopId.has(shop.id))
            .sort((a, b) => {
              const aTime = assignmentByShopId.get(a.id)?.assignedAt;
              const bTime = assignmentByShopId.get(b.id)?.assignedAt;
              // Assignments without a timestamp (pre-existing rows from before
              // this field was tracked) sort last rather than crashing on Date parsing.
              const aMs = aTime ? new Date(aTime).getTime() : 0;
              const bMs = bTime ? new Date(bTime).getTime() : 0;
              return bMs - aMs;
            });

          setAssignedShops(matchedShops);

          // Pre-select most recently assigned shop (matchedShops[0] after the sort above)
          if (matchedShops.length > 0) {
            setSelectedShopState(prev => {
              if (prev && matchedShops.some(s => s.id === prev.id)) return prev;
              return matchedShops[0];
            });
          } else {
            setSelectedShopState(null);
          }
        } else {
          setAssignedShops([]);
          setSelectedShopState(null);
        }
      }
    } catch (err) {
      console.error('[ShopContext] Error loading assignments:', err);
      setAssignedShops([]);
      setSelectedShopState(null);
    } finally {
      setLoading(false);
      setShopReady(true);
    }
  }, [eventId, username, userRole, credentialsSynced]);

  // Sync on eventId change
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const setSelectedShop = useCallback((shop: Shop | null) => {
    setSelectedShopState(shop);
  }, []);

  return (
    <ShopContext.Provider value={{
      assignedShops,
      selectedShop,
      setSelectedShop,
      loading,
      shopReady,
      refreshShops: fetchAssignments,
      isAdmin,
    }}>
      {children}
    </ShopContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useShop() {
  return useContext(ShopContext);
}
