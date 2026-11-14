'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';

import AppLayout from '@/components/layout/AppLayout';
import { ContentLoader } from '@/components/ui/ContentLoader';
import Link from 'next/link';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { REPORTS_PAGE_KEYS } from '@/lib/pageInitKeys';
import { RefreshIcon } from '@/components/ui/Icons';
import { apiClient } from '@/lib/api';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useShop } from '@/hooks/useShop';

// Simple in-memory cache for static master data to prevent redundant API fetches on every mount/load
const masterDataCache: {
  products: any[] | null;
  categories: any[] | null;
  users: any[] | null;
} = {
  products: null,
  categories: null,
  users: null,
};


export default function ReportsPage() {
  const { eventId } = useActiveEvent();
  const { assignedShops: rawAssignedShops, loading: shopsLoading, isAdmin, refreshShops } = useShop();

  const [activeTab, setActiveTab] = useState('audit');
  const [inventorySubTab, setInventorySubTab] = useState('issued');
  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');
  const [showExtraReport, setShowExtraReport] = useState(false);
  // ── Old fine-grained states kept for backward compat with UI render ──
  const [issuedInventory, setIssuedInventory] = useState<any[]>([]);

  const [currentStock, setCurrentStock] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Role-based Reports-page visibility scope, computed server-side (ReportScopeService) and
  // delivered via the reportScope page-init key. null on a field = unrestricted for that
  // dimension; a non-null (possibly empty) array means dropdowns/data should be filtered down
  // to those IDs. See ReportScopeDto for the exact rules per role.
  const [reportScope, setReportScope] = useState<{
    roles: string[] | null;
    allowedShopIds: number[] | null;
    allowedCategoryIds: number[] | null;
    visibleUserIds: number[] | null;
  } | null>(null);

  // Shops scoped by reportScope.allowedShopIds (null = unrestricted, i.e. use raw assigned shops
  // as-is). Shadows the raw `assignedShops` from useShop() so every existing dropdown/filter/
  // auto-select call site in this file below automatically respects the RBAC scope without
  // needing to be touched individually.
  const assignedShops = useMemo(() => {
    if (!reportScope || reportScope.allowedShopIds === null) return rawAssignedShops;
    const allowed = new Set(reportScope.allowedShopIds.map((id) => id.toString()));
    return rawAssignedShops.filter((s: any) => allowed.has(s.id?.toString()));
  }, [rawAssignedShops, reportScope]);

  const [soldAnalytics, setSoldAnalytics] = useState<any[]>([]);
  const [issuedSales, setIssuedSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // ── New backend-computed report states ────────────────────────────────
  const [salesReportRows, setSalesReportRows] = useState<any[]>([]);
  const [salesReportSummary, setSalesReportSummary] = useState<any>(null);
  const [inventoryReportIssued, setInventoryReportIssued] = useState<any[]>([]);
  const [inventoryReportStock, setInventoryReportStock] = useState<any[]>([]);
  const [financialReport, setFinancialReport] = useState<any[]>([]);
  const [auditReportRows, setAuditReportRows] = useState<any[]>([]);
  const [threeWayMatchData, setThreeWayMatchData] = useState<{ totalVarianceAmount: number; items: any[] }>({ totalVarianceAmount: 0, items: [] });

  // Financial Shift Auditing states
  const [financialHistory, setFinancialHistory] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedFinancialShopId, setSelectedFinancialShopId] = useState<string>('all');
  const [selectedFinancialStatus, setSelectedFinancialStatus] = useState<string>('all');
  const [selectedFinancialUserId, setSelectedFinancialUserId] = useState<string>('all');
  const [selectedFinancialCategoryId, setSelectedFinancialCategoryId] = useState<string>('all');
  const [selectedFinancialShiftId, setSelectedFinancialShiftId] = useState<string>('all');
  const [financialShiftsList, setFinancialShiftsList] = useState<any[]>([]);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [canReconcile, setCanReconcile] = useState(false);

  // Category and Shop filters for Sales reports
  const [selectedSalesShopId, setSelectedSalesShopId] = useState<string>('all');
  const [selectedSalesCategoryId, setSelectedSalesCategoryId] = useState<string>('all');

  // Category and Shop filters for Inventory reports
  const [selectedInventoryShopId, setSelectedInventoryShopId] = useState<string>('all');
  const [selectedInventoryCategoryId, setSelectedInventoryCategoryId] = useState<string>('all');

  // User filter for Audit reports
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string>('all');

  // Pagination for Specific Shop Counter in Reports
  const [financialPage, setFinancialPage] = useState(0);
  const [financialSize] = useState(10);
  const [hasMoreFinancial, setHasMoreFinancial] = useState(true);

  // Reconcile Modal State
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileShiftId, setReconcileShiftId] = useState<number | null>(null);
  const [reconcileComment, setReconcileComment] = useState('');

  // Audit Tab states
  const [selectedAuditCategoryId, setSelectedAuditCategoryId] = useState<string>('all');
  const [selectedAuditShopId, setSelectedAuditShopId] = useState<string>('all');
  const [selectedAuditShiftId, setSelectedAuditShiftId] = useState<string>('all');
  const [auditShiftsList, setAuditShiftsList] = useState<any[]>([]);
  const [auditReportData, setAuditReportData] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSubTab, setAuditSubTab] = useState<'shop_audit' | 'inventory_audit' | 'threeway'>('shop_audit');
  const [allStaffAssignments, setAllStaffAssignments] = useState<any[]>([]);

  // Memoized selectors for audit and 3-way match shift filtering.
  // User filtering is applied server-side (userId is sent as a query param in
  // fetchAuditReport, mirroring the Financial report) — the backend matches a row's
  // shift opener/closer/reconciler, anyone who billed a sale in that shift, or anyone
  // currently assigned to the shop as Cashier/Billing Operator/Shop Supervisor. Doing
  // this client-side previously required joining against auditShiftsList, which is
  // fetched with a 50-shift page cap per shop and only carried opener info as the
  // "supervisor" — silently hiding rows for closers/reconcilers/billers.
  const filteredAuditRows = useMemo(() => {
    let rows = auditReportData;

    // ── Shift filter (client-side) ────────────────────────────────────────────
    // Backend also receives shiftSessionId as a query param and re-fetches,
    // but applying it here too ensures the table updates correctly regardless
    // of backend support, and handles the case where auditReportData contains
    // all shifts (e.g. when the backend ignores the param).
    if (selectedAuditShiftId !== 'all') {
      rows = rows.filter(row => row.shiftSessionId?.toString() === selectedAuditShiftId);
    }

    return rows;
  }, [auditReportData, selectedAuditShiftId]);

  // Sort audit rows alphabetically by product name, then by SKU
  const sortedAuditRows = useMemo(() => {
    return [...filteredAuditRows].sort((a, b) => {
      const nameCompare = (a.productName || '').localeCompare(b.productName || '');
      if (nameCompare !== 0) return nameCompare;
      return (a.sku || a.productSku || '').localeCompare(b.sku || b.productSku || '');
    });
  }, [filteredAuditRows]);

  // Stock identity that must hold for every audit row:
  //   issued = remaining + sold - returned   (equivalently: issued - remaining = netQty)
  // A non-zero residual means stock left the counter without a matching sale (negative)
  // or more stock is on hand than the movements account for (positive).
  const stockImbalance = (row: any) => {
    const issued = row.issuedQty ?? 0;
    const remaining = row.remainingQty ?? 0;
    const sold = row.soldQty ?? 0;
    const returned = row.returnedQty ?? 0;
    return (remaining + sold - returned) - issued;
  };

  const filteredThreeWayMatchData = useMemo(() => {
    if (selectedAuditUserId === 'all') return threeWayMatchData;

    const matchMap: Record<number, {
      productId: number;
      productName: string;
      expectedSalesQty: number;
      actualInventoryDepletedQty: number;
      expectedSalesAmount: number;
      actualFinancialsCollected: number;
      qtyVariance: number;
      financialVariance: number;
    }> = {};

    // Inventory issued/remaining is keyed by (product, shop) with no shift
    // dimension, so the same pair must contribute its depletion only once —
    // otherwise a product sold across N shifts reports N x its real depletion.
    const countedInventoryKeys = new Set<string>();

    filteredAuditRows.forEach((row) => {
      const pId = row.productId;
      if (!matchMap[pId]) {
        matchMap[pId] = {
          productId: pId,
          productName: row.productName || `Product ${pId}`,
          expectedSalesQty: 0,
          actualInventoryDepletedQty: 0,
          expectedSalesAmount: 0,
          actualFinancialsCollected: 0,
          qtyVariance: 0,
          financialVariance: 0,
        };
      }
      const item = matchMap[pId];
      item.expectedSalesQty += (row.netQty || 0);
      const invDedupKey = `${row.productId}-${row.shopId}`;
      if (!countedInventoryKeys.has(invDedupKey)) {
        countedInventoryKeys.add(invDedupKey);
        const issued = row.issuedQty || 0;
        const remaining = row.remainingQty || 0;
        item.actualInventoryDepletedQty += Math.max(0, issued - remaining);
      }
      const collected = row.totalCollected || 0;
      item.actualFinancialsCollected += collected;
      // Expected value = net qty x selling price, never the collected amount — using
      // collected for both legs makes the comparison x === x and hides real gaps.
      item.expectedSalesAmount += (row.netQty || 0) * (row.sellingPrice || 0);
    });

    let totalVarianceAmount = 0;
    const items = Object.values(matchMap).map((item) => {
      item.qtyVariance = item.expectedSalesQty - item.actualInventoryDepletedQty;
      // Headline variance is the cash leg: collected vs expected. Negative = short
      // collected, positive = over collected.
      item.financialVariance = item.actualFinancialsCollected - item.expectedSalesAmount;
      totalVarianceAmount += item.financialVariance;
      return item;
    });

    const sortedItems = items.sort((a, b) => (a.productName || '').localeCompare(b.productName || ''));

    return {
      totalVarianceAmount,
      items: sortedItems
    };
  }, [filteredAuditRows, selectedAuditUserId, threeWayMatchData, products]);

  // Compute available users inside the selected or accessible shops
  const availableAuditUsers = useMemo(() => {
    const targetShopIds = selectedAuditShopId === 'all'
      ? assignedShops.map((s: any) => s.id.toString())
      : [selectedAuditShopId.toString()];

    const assignedUserIds = new Set<string>();
    allStaffAssignments.forEach((assignment: any) => {
      if (assignment.shopId && targetShopIds.includes(assignment.shopId.toString())) {
        if (assignment.userId) {
          assignedUserIds.add(assignment.userId.toString());
        }
      }
    });

    const shiftUserIds = new Set<string>();
    auditShiftsList.forEach(shift => {
      if (shift.openedByUserId) shiftUserIds.add(shift.openedByUserId.toString());
      if (shift.closedByUserId) shiftUserIds.add(shift.closedByUserId.toString());
      if (shift.reconciledByUserId) shiftUserIds.add(shift.reconciledByUserId.toString());
    });

    const usernamesInAudit = new Set<string>();
    auditReportData.forEach(row => {
      if (row.shopSupervisorUsername && row.shopSupervisorUsername !== 'N/A') {
        usernamesInAudit.add(row.shopSupervisorUsername.toLowerCase());
      }
    });

    const inShiftOrAssignment = users.filter(u =>
      assignedUserIds.has(u.id.toString()) ||
      shiftUserIds.has(u.id.toString()) ||
      (u.username && usernamesInAudit.has(u.username.toLowerCase()))
    );

    // Final RBAC gate: CASHIER/BILLING_OPERATOR only ever see themselves, SHOP_SUPERVISOR only
    // sees their shop team, everyone else is unrestricted. See ReportScopeDto.
    if (!reportScope || reportScope.visibleUserIds === null) return inShiftOrAssignment;
    const visible = new Set(reportScope.visibleUserIds.map((id) => id.toString()));
    return inShiftOrAssignment.filter(u => visible.has(u.id.toString()));
  }, [allStaffAssignments, auditShiftsList, auditReportData, selectedAuditShopId, assignedShops, users, reportScope]);

  // Reset selected audit user if they are no longer in the list of available users
  useEffect(() => {
    if (selectedAuditUserId !== 'all' && !availableAuditUsers.some(u => u.id.toString() === selectedAuditUserId)) {
      setSelectedAuditUserId('all');
    }
  }, [availableAuditUsers, selectedAuditUserId]);

  // Compute available users inside the selected or accessible shops for Financial reports
  const availableFinancialUsers = useMemo(() => {
    const targetShopIds = selectedFinancialShopId === 'all'
      ? (selectedFinancialCategoryId === 'all'
        ? assignedShops.map((s: any) => s.id.toString())
        : assignedShops.filter((s: any) => s.categoryId?.toString() === selectedFinancialCategoryId).map((s: any) => s.id.toString()))
      : [selectedFinancialShopId.toString()];

    const assignedUserIds = new Set<string>();
    allStaffAssignments.forEach((assignment: any) => {
      if (assignment.shopId && targetShopIds.includes(assignment.shopId.toString())) {
        if (assignment.userId) {
          assignedUserIds.add(assignment.userId.toString());
        }
      }
    });

    // Use financialShiftsList (the unpaginated /shifts/history fetch), not financialHistory —
    // the latter is only the current page of /reports/financial (size=10), so building the
    // dropdown from it would silently hide users whose shifts aren't on the loaded page.
    const shiftUserIds = new Set<string>();
    financialShiftsList.forEach((shift: any) => {
      let matchCategory = true;
      if (selectedFinancialCategoryId !== 'all') {
        const shopObj = assignedShops.find(shop => shop.id.toString() === shift.shopId?.toString());
        matchCategory = shopObj?.categoryId?.toString() === selectedFinancialCategoryId;
      }
      const matchShift = selectedFinancialShiftId === 'all' || shift.id?.toString() === selectedFinancialShiftId;

      if (matchCategory && matchShift) {
        if (shift.openedByUserId) shiftUserIds.add(shift.openedByUserId.toString());
        if (shift.closedByUserId) shiftUserIds.add(shift.closedByUserId.toString());
        if (shift.reconciledByUserId) shiftUserIds.add(shift.reconciledByUserId.toString());
      }
    });

    const inShiftOrAssignment = users.filter(u =>
      assignedUserIds.has(u.id.toString()) ||
      shiftUserIds.has(u.id.toString())
    );

    // Final RBAC gate: CASHIER/BILLING_OPERATOR only ever see themselves, SHOP_SUPERVISOR only
    // sees their shop team, everyone else is unrestricted. See ReportScopeDto.
    if (!reportScope || reportScope.visibleUserIds === null) return inShiftOrAssignment;
    const visible = new Set(reportScope.visibleUserIds.map((id) => id.toString()));
    return inShiftOrAssignment.filter(u => visible.has(u.id.toString()));
  }, [allStaffAssignments, financialShiftsList, selectedFinancialShopId, selectedFinancialCategoryId, selectedFinancialShiftId, assignedShops, users, reportScope]);

  // Reset selected financial user if they are no longer in the list of available financial users
  useEffect(() => {
    if (selectedFinancialUserId !== 'all' && !availableFinancialUsers.some(u => u.id.toString() === selectedFinancialUserId)) {
      setSelectedFinancialUserId('all');
    }
  }, [availableFinancialUsers, selectedFinancialUserId]);

  // Client-side filtering for Inventory Reports
  const filteredInventoryReportIssued = useMemo(() => {
    if (selectedInventoryCategoryId === 'all') return inventoryReportIssued;
    return inventoryReportIssued.filter(
      (item) => item.categoryId?.toString() === selectedInventoryCategoryId.toString()
    );
  }, [inventoryReportIssued, selectedInventoryCategoryId]);

  const filteredInventoryReportStock = useMemo(() => {
    if (selectedInventoryCategoryId === 'all') return inventoryReportStock;
    return inventoryReportStock.filter(
      (item) => item.categoryId?.toString() === selectedInventoryCategoryId.toString()
    );
  }, [inventoryReportStock, selectedInventoryCategoryId]);

  // ── Effect 1: One-time init on mount ──────────────────────────────────────
  // Reads localStorage synchronously; fetches static reference data once.
  useEffect(() => {
    if (activeTab === 'inventory' && inventorySubTab === 'stock') {
      fetchCurrentStock();
    }
  }, [activeTab, inventorySubTab, eventId]);

  useEffect(() => {
    // Single page-init call fetches all static reference data at once.
    // Shops are intentionally excluded — ShopContext already fetches them on mount.
    const initStaticData = async () => {
      try {
        const res = await apiClient.get(`/page-init?include=${REPORTS_PAGE_KEYS.join(',')}`);
        if (res.ok) {
          const data = await res.json();
          if (data.categories) {
            const items = Array.isArray(data.categories) ? data.categories : data.categories?.data ?? [];
            masterDataCache.categories = items;
            setCategories(items);
          }
          if (data.products) {
            const items = Array.isArray(data.products) ? data.products : data.products?.data ?? [];
            masterDataCache.products = items;
            setProducts(items);
          }
          if (data.users) {
            const items = Array.isArray(data.users) ? data.users : data.users?.data ?? [];
            masterDataCache.users = items;
            setUsers(items);
          }
          if (data.sales) setIssuedSales(Array.isArray(data.sales) ? data.sales : data.sales?.data ?? []);
          if (data.shopStaffAssignments) setAllStaffAssignments(Array.isArray(data.shopStaffAssignments) ? data.shopStaffAssignments : []);
          if (data.reportScope) setReportScope(data.reportScope);
        }
      } catch (e) {
        console.error('Error fetching page-init data for reports page', e);
        // Fallback to individual calls if page-init fails
        fetchProducts();
        fetchCategories();
        fetchUsers();
        fetchAllocations();
        fetchStaffAssignments();
      }
    };
    initStaticData();
  }, [eventId]);


  useEffect(() => {
    setLoading(shopsLoading)
  }, [shopsLoading])

  useEffect(() => {
    if (assignedShops && assignedShops.length === 1 && !isAdmin) {
      const singleShopId = assignedShops[0].id.toString();
      const singleCategoryId = assignedShops[0].categoryId?.toString();
      setSelectedFinancialShopId(singleShopId);
      setSelectedAuditShopId(singleShopId);
      if (singleCategoryId) {
        setSelectedFinancialCategoryId(singleCategoryId);
        setSelectedAuditCategoryId(singleCategoryId);
      }
    }
  }, [assignedShops, isAdmin]);

  useEffect(() => {
    const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : '';
    const username = typeof window !== 'undefined' ? localStorage.getItem('username') : '';
    const adminFlag = userRole === 'ADMIN' || username === 'admin' || username?.endsWith('_admin');
    const hasSupervisorRole = userRole === 'SHOP_SUPERVISOR';
    const hasCashierOrBillingRole = userRole === 'CASHIER' || userRole === 'BILLING_OPERATOR';
    setCanReconcile((adminFlag || hasSupervisorRole) && !hasCashierOrBillingRole);
    // products/categories/users are now loaded by the page-init effect above
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2: Tab / event switch ──────────────────────────────────────────
  // Fires when the active tab or eventId changes, or when financial filters change.
  // Uses a switch so only the relevant API is called — never more than one per change.
  useEffect(() => {
    switch (activeTab) {
      case 'sales':
        fetchSalesReport();
        break;

      case 'inventory':
        fetchInventoryReport();
        break;

      case 'financial':
        fetchFinancialShifts(selectedFinancialShopId, selectedFinancialCategoryId);
        fetchFinancialReport();
        break;

      case 'audit':
        // Audit report fetch is handled by Effect 3 (it has additional filter deps)
        break;
    }
  }, [
    activeTab,
    eventId,
    inventorySubTab,
    selectedFinancialShopId,
    selectedFinancialStatus,
    selectedFinancialUserId,
    financialPage,
    selectedSalesShopId,
    selectedSalesCategoryId,
    selectedInventoryShopId,
    selectedInventoryCategoryId,
    selectedFinancialCategoryId
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 2b: Financial tab — refresh when shops finish loading ──────────
  // Effect 2 no longer depends on shopsLoading (to avoid triple-firing the sales report).
  // That means after an event switch, the financial tab won't auto-refresh once the new
  // event's shops arrive. This targeted effect covers that specific gap: it fires only
  // when shops finish loading AND the user is already on the financial tab.
  useEffect(() => {
    if (shopsLoading || activeTab !== 'financial') return;
    fetchFinancialShifts(selectedFinancialShopId, selectedFinancialCategoryId);
    fetchFinancialReport();
  }, [shopsLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effect 3: Audit-tab filter changes ────────────────────────────────────
  // Separated from Effect 2 because audit has its own cascading filters
  // (category → shop → shift). This single effect owns all of them.
  // It does NOT cascade: it resets derived filters AND fires the API in one shot.
  // Guards:
  //   shopsLoading  — don't fire while shops are being fetched
  //   assignedShops — re-fire when shops actually arrive (initial render has
  //                   shopsLoading=false and assignedShops=[] before the first
  //                   fetch completes; adding assignedShops to deps covers that gap)
  useEffect(() => {
    if (activeTab !== 'audit' || shopsLoading || assignedShops.length === 0) return;

    // When category changes, clear dependent filters immediately (no extra effect needed)
    // When shop changes, reload available shifts
    fetchAuditShifts(selectedAuditShopId, selectedAuditCategoryId);

    // Fetch report with all current filter values in a single call
    fetchAuditReport();
  }, [activeTab, eventId, selectedAuditCategoryId, selectedAuditShopId, selectedAuditShiftId, selectedAuditUserId, shopsLoading, assignedShops]); // eslint-disable-line react-hooks/exhaustive-deps



  const fetchAuditShifts = async (shopId: string, categoryId: string) => {
    try {
      if (shopId === 'all') {
        const targetShops = categoryId === 'all'
          ? assignedShops
          : assignedShops.filter((s: any) => s.categoryId?.toString() === categoryId.toString());

        if (targetShops && targetShops.length > 0) {
          const shopIds = targetShops.map((s: any) => s.id).join(',');
          const response = await apiClient.get(`/shifts/history/bulk?shopIds=${shopIds}`);
          if (response.ok) {
            const data = await response.json();
            const shopMap = new Map(targetShops.map((s: any) => [s.id, s]));
            const decorated = data.map((shift: any) => {
              const shop: any = shopMap.get(shift.shopId) || shopMap.get(Number(shift.shopId));
              return { ...shift, shopName: shop?.shopName || 'Unknown', counterNumber: shop?.counterNumber || 'N/A' };
            });
            setAuditShiftsList(decorated.sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()));
          } else {
            setAuditShiftsList([]);
          }
        } else {
          setAuditShiftsList([]);
        }
      } else {
        const shop = assignedShops.find((s: any) => s.id === parseInt(shopId));
        const response = await apiClient.get(`/shifts/history/${shopId}`);
        if (response.ok) {
          const data = await response.json();
          const decorated = data.map((shift: any) => ({
            ...shift,
            shopName: shop?.shopName || 'Unknown',
            counterNumber: shop?.counterNumber || 'N/A'
          }));
          setAuditShiftsList(decorated.sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()));
        } else {
          setAuditShiftsList([]);
        }
      }
    } catch (e) {
      console.error('Error fetching audit shifts:', e);
    }
  };

  // ── New backend-driven fetch functions ───────────────────────────────────

  // Report endpoints only accept a single `shopId` (see ReportController.java) and have no
  // knowledge of reportScope — they return unfiltered data when shopId is omitted. So for a
  // scoped role (CASHIER/BILLING_OPERATOR/SHOP_SUPERVISOR), selecting "All" must NOT omit the
  // filter — it must resolve to their own accessible shop IDs and fetch each one, merged
  // client-side. Returns null when no looping is needed (a specific shop was chosen, or the
  // caller's role is unrestricted per ReportScopeDto, i.e. allowedShopIds === null).
  const getScopedShopIds = (selectedShopId: string, selectedCategoryId: string): string[] | null => {
    if (selectedShopId !== 'all') return null;
    if (!reportScope || reportScope.allowedShopIds === null) return null;
    const pool = selectedCategoryId === 'all'
      ? assignedShops
      : assignedShops.filter((s: any) => s.categoryId?.toString() === selectedCategoryId.toString());
    return pool.map((s: any) => s.id.toString());
  };

  // Sums the numeric fields of SalesReportSummaryDto across one summary per fetched shop.
  const mergeSalesSummaries = (summaries: any[]): any => {
    const merged = { totalIssued: 0, totalSold: 0, totalReturned: 0, totalNet: 0, totalCash: 0, totalOnline: 0, totalCollected: 0 };
    summaries.filter(Boolean).forEach((s) => {
      merged.totalIssued += Number(s.totalIssued) || 0;
      merged.totalSold += Number(s.totalSold) || 0;
      merged.totalReturned += Number(s.totalReturned) || 0;
      merged.totalNet += Number(s.totalNet) || 0;
      merged.totalCash += Number(s.totalCash) || 0;
      merged.totalOnline += Number(s.totalOnline) || 0;
      merged.totalCollected += Number(s.totalCollected) || 0;
    });
    return merged;
  };

  // Re-aggregates the 3-way-match variance items (same productId grouping logic as
  // filteredThreeWayMatchData above) across one threeWayMatch payload per fetched shop.
  const mergeThreeWayMatch = (matches: { totalVarianceAmount?: number; items?: any[] }[]) => {
    const matchMap: Record<string, any> = {};
    matches.forEach((m) => {
      (m?.items || []).forEach((item: any) => {
        const pId = item.productId;
        if (!matchMap[pId]) {
          matchMap[pId] = { ...item };
        } else {
          matchMap[pId].expectedSalesQty += item.expectedSalesQty || 0;
          matchMap[pId].actualInventoryDepletedQty += item.actualInventoryDepletedQty || 0;
          matchMap[pId].expectedSalesAmount += item.expectedSalesAmount || 0;
          matchMap[pId].actualFinancialsCollected += item.actualFinancialsCollected || 0;
          matchMap[pId].qtyVariance += item.qtyVariance || 0;
          matchMap[pId].financialVariance += item.financialVariance || 0;
        }
      });
    });
    const items = Object.values(matchMap);
    const totalVarianceAmount = items.reduce((sum: number, it: any) => sum + (it.financialVariance || 0), 0);
    return { totalVarianceAmount, items };
  };

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const scopedShopIds = getScopedShopIds(selectedSalesShopId, selectedSalesCategoryId);
      if (scopedShopIds !== null) {
        if (scopedShopIds.length === 0) {
          setSalesReportRows([]);
          setSalesReportSummary(null);
          setIssuedSales([]);
          return;
        }
        const results = await Promise.all(scopedShopIds.map(async (shopId) => {
          const params = new URLSearchParams();
          params.append('shopId', shopId);
          if (selectedSalesCategoryId !== 'all') params.append('categoryId', selectedSalesCategoryId);
          const res = await apiClient.get('/reports/sales?' + params.toString());
          return res.ok ? res.json() : { rows: [], summary: null };
        }));
        const mergedRows = results.flatMap((r) => r.rows || []);
        setSalesReportRows(mergedRows);
        setSalesReportSummary(mergeSalesSummaries(results.map((r) => r.summary)));
        setIssuedSales(mergedRows);
        return;
      }

      const params = new URLSearchParams();
      if (selectedSalesShopId !== 'all') params.append('shopId', selectedSalesShopId);
      if (selectedSalesCategoryId !== 'all') params.append('categoryId', selectedSalesCategoryId);
      const response = await apiClient.get('/reports/sales?' + params.toString());
      if (response.ok) {
        const data = await response.json();
        setSalesReportRows(data.rows || []);
        setSalesReportSummary(data.summary || null);
        // Backwards compat: populate issuedSales so existing download functions still work
        setIssuedSales(data.rows || []);
      }
    } catch (error) {
      console.error('Error fetching sales report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInventoryReport = async () => {
    setLoading(true);
    try {
      const scopedShopIds = getScopedShopIds(selectedInventoryShopId, selectedInventoryCategoryId);
      if (scopedShopIds !== null) {
        if (scopedShopIds.length === 0) {
          setInventoryReportIssued([]);
          setInventoryReportStock([]);
          setIssuedInventory([]);
          setCurrentStock([]);
          return;
        }
        const results = await Promise.all(scopedShopIds.map(async (shopId) => {
          const params = new URLSearchParams();
          params.append('shopId', shopId);
          if (selectedInventoryCategoryId !== 'all') params.append('categoryId', selectedInventoryCategoryId);
          const res = await apiClient.get('/inventory/reports?' + params.toString());
          return res.ok ? res.json() : { issued: [], stock: [] };
        }));
        const mergedIssued = results.flatMap((r) => r.issued || []);
        const mergedStock = results.flatMap((r) => r.stock || []);
        setInventoryReportIssued(mergedIssued);
        setInventoryReportStock(mergedStock);
        setIssuedInventory(mergedIssued);
        setCurrentStock(mergedStock);
        return;
      }

      const params = new URLSearchParams();
      if (selectedInventoryShopId !== 'all') params.append('shopId', selectedInventoryShopId);
      if (selectedInventoryCategoryId !== 'all') params.append('categoryId', selectedInventoryCategoryId);
      const response = await apiClient.get('/inventory/reports?' + params.toString());
      if (response.ok) {
        const data = await response.json();
        setInventoryReportIssued(data.issued || []);
        setInventoryReportStock(data.stock || []);
        // Backwards compat
        setIssuedInventory(data.issued || []);
        setCurrentStock(data.stock || []);
      }
    } catch (error) {
      console.error('Error fetching inventory report:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialReport = async () => {
    setFinancialLoading(true);
    setErrorMsg('');
    try {
      const scopedShopIds = getScopedShopIds(selectedFinancialShopId, selectedFinancialCategoryId);
      if (scopedShopIds !== null) {
        if (scopedShopIds.length === 0) {
          setFinancialReport([]);
          setHasMoreFinancial(false);
          setFinancialHistory([]);
          return;
        }
        // Pagination is inherently approximate here: each shop is paged independently with the
        // same page/size, then merged. Fine for the small shop counts scoped roles have; if a
        // SHOP_SUPERVISOR's team spans many shops with deep history, later pages may not line up
        // perfectly across shops. No rows are silently dropped on the current page either way.
        const results = await Promise.all(scopedShopIds.map(async (shopId) => {
          const params = new URLSearchParams();
          params.append('shopId', shopId);
          if (selectedFinancialStatus !== 'all') params.append('status', selectedFinancialStatus);
          if (selectedFinancialUserId !== 'all') params.append('userId', selectedFinancialUserId);
          params.append('page', financialPage.toString());
          params.append('size', financialSize.toString());
          const res = await apiClient.get('/reports/financial?' + params.toString());
          return res.ok ? res.json() : { shifts: [], hasMore: false };
        }));
        const mergedShifts = results.flatMap((r) => r.shifts || [])
          .sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime());
        const anyHasMore = results.some((r) => r.hasMore);
        setFinancialReport(mergedShifts);
        setHasMoreFinancial(anyHasMore);
        setFinancialHistory(mergedShifts);
        return;
      }

      const params = new URLSearchParams();
      if (selectedFinancialShopId !== 'all') params.append('shopId', selectedFinancialShopId);
      if (selectedFinancialStatus !== 'all') params.append('status', selectedFinancialStatus);
      if (selectedFinancialUserId !== 'all') params.append('userId', selectedFinancialUserId);
      params.append('page', financialPage.toString());
      params.append('size', financialSize.toString());
      const response = await apiClient.get('/reports/financial?' + params.toString());
      if (response.ok) {
        const data = await response.json();
        setFinancialReport(data.shifts || []);
        setHasMoreFinancial(data.hasMore || false);
        // Backwards compat
        setFinancialHistory(data.shifts || []);
      } else {
        setErrorMsg('Failed to load financial shift histories.');
      }
    } catch (error) {
      console.error('Error fetching financial report:', error);
      setErrorMsg('Failed to load financial shift histories.');
    } finally {
      setFinancialLoading(false);
    }
  };

  const fetchAuditReport = async () => {
    setAuditLoading(true);
    try {
      const scopedShopIds = getScopedShopIds(selectedAuditShopId, selectedAuditCategoryId);
      if (scopedShopIds !== null) {
        if (scopedShopIds.length === 0) {
          setAuditReportRows([]);
          setAuditReportData([]);
          setThreeWayMatchData({ totalVarianceAmount: 0, items: [] });
          return;
        }
        const results = await Promise.all(scopedShopIds.map(async (shopId) => {
          const params = new URLSearchParams();
          params.append('shopId', shopId);
          if (selectedAuditCategoryId !== 'all') params.append('categoryId', selectedAuditCategoryId);
          if (selectedAuditShiftId !== 'all') params.append('shiftSessionId', selectedAuditShiftId);
          if (selectedAuditUserId !== 'all') params.append('userId', selectedAuditUserId);
          const res = await apiClient.get('/reports/audit?' + params.toString());
          return res.ok ? res.json() : { auditRows: [], threeWayMatch: null };
        }));
        const mergedRows = results.flatMap((r) => r.auditRows || []);
        setAuditReportRows(mergedRows);
        setAuditReportData(mergedRows);
        setThreeWayMatchData(mergeThreeWayMatch(results.map((r) => r.threeWayMatch)));
        return;
      }

      const params = new URLSearchParams();
      if (selectedAuditShopId !== 'all') params.append('shopId', selectedAuditShopId);
      if (selectedAuditCategoryId !== 'all') params.append('categoryId', selectedAuditCategoryId);
      if (selectedAuditShiftId !== 'all') params.append('shiftSessionId', selectedAuditShiftId);
      if (selectedAuditUserId !== 'all') params.append('userId', selectedAuditUserId);
      const response = await apiClient.get('/reports/audit?' + params.toString());
      if (response.ok) {
        const data = await response.json();
        setAuditReportRows(data.auditRows || []);
        setAuditReportData(data.auditRows || []);
        const tm = data.threeWayMatch;
        setThreeWayMatchData({
          totalVarianceAmount: tm?.totalVarianceAmount ?? 0,
          items: tm?.items ?? []
        });
      }
    } catch (error) {
      console.error('Error fetching audit report:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  // ── Legacy generate functions (kept for audit shift list filter UI) ──────

  const generateAuditReport = fetchAuditReport;

  const downloadAuditReportExcel = () => {
    if (auditSubTab === 'threeway') {
      const csvRows = [];
      csvRows.push([
        'S.No.',
        'Product Name',
        'Expected Sales Qty (POS)',
        'Actual Inventory Depleted Qty',
        'Qty Variance',
        'Expected Sales Amount',
        'Actual Financials Collected',
        'Financial Variance'
      ].join(','));

      filteredThreeWayMatchData.items.forEach((item, index) => {
        const csvLine = [
          index + 1,
          `"${item.productName}"`,
          item.expectedSalesQty,
          item.actualInventoryDepletedQty,
          item.qtyVariance,
          item.expectedSalesAmount.toFixed(2),
          item.actualFinancialsCollected.toFixed(2),
          item.financialVariance.toFixed(2)
        ].join(',');
        csvRows.push(csvLine);
      });

      const totalExpectedQty = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.expectedSalesQty, 0);
      const totalDepletedQty = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.actualInventoryDepletedQty, 0);
      const totalQtyVariance = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.qtyVariance, 0);
      const totalExpectedAmt = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.expectedSalesAmount, 0);
      const totalCollectedAmt = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.actualFinancialsCollected, 0);
      const totalFinVariance = filteredThreeWayMatchData.totalVarianceAmount;

      // 8 columns total
      csvRows.push([
        '', // S.No column
        'Total',
        totalExpectedQty,
        totalDepletedQty,
        totalQtyVariance,
        totalExpectedAmt.toFixed(2),
        totalCollectedAmt.toFixed(2),
        totalFinVariance.toFixed(2)
      ].join(','));

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `3-way-match-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      return;

    } else if (auditSubTab === 'inventory_audit') {
      const csvRows = [];
      csvRows.push([
        'S.No.',
        'Product Name',
        'Total Issue',
        'Return Qty',
        'Sold Qty',
        'Issued Worth',
        'Rate',
        'Cash',
        'Online',
        'Total'
      ].join(','));

      sortedAuditRows.forEach((row, index) => {
        const csvLine = [
          index + 1,
          `"${row.productName}"`,
          row.issuedQty,
          row.remainingQty,
          row.netQty,
          ((row.issuedQty || 0) * (row.sellingPrice || 0)).toFixed(2),
          (row.sellingPrice || 0).toFixed(2),
          row.cashCollected.toFixed(2),
          row.onlineCollected.toFixed(2),
          row.totalCollected.toFixed(2)
        ].join(',');
        csvRows.push(csvLine);
      });

      const totalCash = filteredAuditRows.reduce((sum, r) => sum + r.cashCollected, 0);
      const totalOnline = filteredAuditRows.reduce((sum, r) => sum + r.onlineCollected, 0);
      const totalColl = filteredAuditRows.reduce((sum, r) => sum + r.totalCollected, 0);

      // 10 columns total
      csvRows.push([
        '', // S.No column
        'Total',
        '',
        '',
        '',
        filteredAuditRows.reduce((sum, r) => sum + (r.issuedQty || 0) * (r.sellingPrice || 0), 0).toFixed(2), // Issued Worth
        '',
        totalCash.toFixed(2),
        totalOnline.toFixed(2),
        totalColl.toFixed(2)
      ].join(','));

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inventory-audit-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      return;
    }

    // Default block (shop_audit)
    const csvRows = [];
    csvRows.push([
      'S.No.',
      'Category',
      'Shop Counter',
      'Shift',
      'Shop Supervisor',
      'Product Name',
      'Issued Qty',
      'Sold Qty',
      'Returned Qty',
      'Cancelled Qty',
      'Remaining Qty',
      'Net Qty',
      'Selling Price',
      'Cash Collected',
      'Online Collected',
      'Total Collected'
    ].join(','));

    sortedAuditRows.forEach((row, index) => {
      const shiftObj = auditShiftsList.find(s => s.id === row.shiftSessionId);
      // Prefer full name from backend, fall back to username, then shift lookup
      const rawSupervisor = row.shopSupervisorName
        || (row.shopSupervisorUsername && row.shopSupervisorUsername !== 'N/A' ? row.shopSupervisorUsername : null);
      const supervisorName = rawSupervisor
        || (shiftObj ? (users.find(u => u.id === shiftObj.openedByUserId)?.fullName || users.find(u => u.id === shiftObj.openedByUserId)?.username || `ID: ${shiftObj.openedByUserId}`) : null)
        || row.openedByUsername
        || (row.openedByUserId ? `ID: ${row.openedByUserId}` : 'N/A');
      const counterLabel = row.counterNumber && row.counterNumber !== 'N/A'
        ? `Counter ${row.counterNumber}`
        : 'N/A';
      const shiftLabel = row.shiftSessionId ? `Shift ${row.shiftSessionId}` : 'All Shifts';
      // Resolve category: use categoryId from row first (backend always sends it), fall back to product lookup
      const resolvedCategoryName = row.categoryName
        || (row.categoryId ? categories.find((c: any) => c.id === row.categoryId || c.id === parseInt(row.categoryId))?.name : null)
        || (() => {
          const product = products.find((p: any) => p.id === row.productId || p.id === parseInt(row.productId));
          return product ? categories.find((c: any) => c.id === product.categoryId)?.name : null;
        })()
        || 'N/A';

      const csvLine = [
        index + 1,
        `"${resolvedCategoryName}"`,
        `"${counterLabel}"`,
        `"${shiftLabel}"`,
        `"${supervisorName}"`,
        `"${row.productName}"`,
        row.issuedQty,
        row.soldQty,
        row.returnedQty,
        row.cancelledQty ?? 0,
        row.remainingQty,
        row.netQty,
        (row.sellingPrice || 0).toFixed(2),
        row.cashCollected.toFixed(2),
        row.onlineCollected.toFixed(2),
        row.totalCollected.toFixed(2)
      ].join(',');
      csvRows.push(csvLine);
    });

    const totalCash = filteredAuditRows.reduce((sum, r) => sum + r.cashCollected, 0);
    const totalOnline = filteredAuditRows.reduce((sum, r) => sum + r.onlineCollected, 0);
    const totalColl = filteredAuditRows.reduce((sum, r) => sum + r.totalCollected, 0);

    // 16 columns total
    csvRows.push([
      '', // S.No
      'Total',
      '', '', '', '',
      '', '', '', '', '',
      '', '', // Cancelled Qty, Net Qty
      totalCash.toFixed(2),
      totalOnline.toFixed(2),
      totalColl.toFixed(2)
    ].join(','));

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `shop-audit-report-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const fetchShops = async () => {
    await refreshShops()
  };

  const fetchAllocations = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/inventory/sales');
      if (response.ok) {
        const data = await response.json();
        setIssuedSales(data.data || data);
      }
    } catch (error) {
      console.error('Error fetching allocations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (force = false) => {
    if (!force && masterDataCache.users) {
      setUsers(masterDataCache.users);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.get('/users/allUsers');
      if (response.ok) {
        const data = await response.json();
        const items = data.data || data;
        masterDataCache.users = items;
        setUsers(items);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffAssignments = async () => {
    // Note: /shops-staff/allusers does not exist as a Next.js route.
    // Instead, fetch staff per shop from /shops-staff/[shopId] and merge.
    try {
      const shops = assignedShops;
      if (!shops || shops.length === 0) return;
      const all: any[] = [];
      await Promise.all(
        shops.map(async (shop: any) => {
          const res = await apiClient.get(`/shops-staff/${shop.id}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) all.push(...data);
          }
        })
      );
      setAllStaffAssignments(all);
    } catch (e) {
      console.error('Error fetching staff assignments:', e);
    }
  };

  const fetchFinancialShifts = async (shopId: string, categoryId: string) => {
    try {
      if (shopId === 'all') {
        const targetShops = categoryId === 'all'
          ? assignedShops
          : assignedShops.filter((s: any) => s.categoryId?.toString() === categoryId.toString());

        if (targetShops && targetShops.length > 0) {
          const shopIds = targetShops.map((s: any) => s.id).join(',');
          const response = await apiClient.get(`/shifts/history/bulk?shopIds=${shopIds}`);
          if (response.ok) {
            const data = await response.json();
            const shopMap = new Map(targetShops.map((s: any) => [s.id, s]));
            const decorated = data.map((shift: any) => {
              const shop: any = shopMap.get(shift.shopId) || shopMap.get(Number(shift.shopId));
              return { ...shift, shopName: shop?.shopName || 'Unknown', counterNumber: shop?.counterNumber || 'N/A' };
            });
            setFinancialShiftsList(decorated.sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()));
          } else {
            setFinancialShiftsList([]);
          }
        } else {
          setFinancialShiftsList([]);
        }
      } else {
        const shop = assignedShops.find((s: any) => s.id === parseInt(shopId));
        const response = await apiClient.get(`/shifts/history/${shopId}`);
        if (response.ok) {
          const data = await response.json();
          const decorated = data.map((shift: any) => ({
            ...shift,
            shopName: shop?.shopName || 'Unknown',
            counterNumber: shop?.counterNumber || 'N/A'
          }));
          setFinancialShiftsList(decorated.sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()));
        } else {
          setFinancialShiftsList([]);
        }
      }
    } catch (e) {
      console.error('Error fetching financial shifts:', e);
    }
  };

  const fetchProducts = async (force = false) => {
    if (!force && masterDataCache.products) {
      setProducts(masterDataCache.products);
      return;
    }
    try {
      const response = await apiClient.get('/products');
      if (response.ok) {
        const data = await response.json();
        const items = data.data || data;
        masterDataCache.products = items;
        setProducts(items);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchCategories = async (force = false) => {
    if (!force && masterDataCache.categories) {
      setCategories(masterDataCache.categories);
      return;
    }
    try {
      const response = await apiClient.get('/categories');
      if (response.ok) {
        const data = await response.json();
        const items = data.data || data;
        masterDataCache.categories = items;
        setCategories(items);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchCurrentStock = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/inventory/stocks');
      if (response.ok) {
        const stocksData = await response.json();
        const stocksList = stocksData.data || stocksData;

        const mappedStocks = stocksList.map((stock: any) => {
          const matchingSales = issuedSales.filter((s: any) => s.productId === stock.productId);
          const totalLiveQty = matchingSales.reduce((sum: number, s: any) => sum + (s.liveQuantity || 0), 0);
          return {
            ...stock,
            quantity: totalLiveQty
          };
        });
        setCurrentStock(mappedStocks);
      }
    } catch (error) {
      console.error('Error fetching current stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFinancialData = async () => {
    setFinancialLoading(true);
    setErrorMsg('');
    try {
      // 3. Fetch history
      if (selectedFinancialShopId === 'all') {
        if (assignedShops && assignedShops.length > 0) {
          const shopIds = assignedShops.map((s: any) => s.id).join(',');
          const response = await apiClient.get(`/shifts/history/bulk?shopIds=${shopIds}`);
          if (response.ok) {
            const data = await response.json();
            const shopMap = new Map(assignedShops.map((s: any) => [s.id, s]));
            const decorated = data.map((shift: any) => {
              const shop: any = shopMap.get(shift.shopId) || shopMap.get(Number(shift.shopId));
              return { ...shift, shopName: shop?.shopName || 'Unknown', counterNumber: shop?.counterNumber || 'N/A' };
            });
            setFinancialHistory(decorated.sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()));
          } else {
            setFinancialHistory([]);
          }
        } else {
          setFinancialHistory([]);
        }
      } else {
        const shopIdNum = parseInt(selectedFinancialShopId);
        const shop = assignedShops.find((s: any) => s.id === shopIdNum);
        const response = await apiClient.get(`/shifts/history/${shopIdNum}?page=${financialPage}&size=${financialSize}`);
        if (response.ok) {
          const data = await response.json();
          const decorated = data.map((shift: any) => ({
            ...shift,
            shopName: shop?.shopName || 'Unknown',
            counterNumber: shop?.counterNumber || 'N/A'
          }));
          setFinancialHistory(decorated.sort((a: any, b: any) => new Date(b.openedAt || 0).getTime() - new Date(a.openedAt || 0).getTime()));
          setHasMoreFinancial(data.length === financialSize);
        } else {
          setFinancialHistory([]);
        }
      }
    } catch (error) {
      console.error('Error fetching financial data:', error);
      setErrorMsg('Failed to load financial shift histories.');
    } finally {
      setFinancialLoading(false);
    }
  };

  const handleRefreshActiveTab = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'sales':
          await Promise.all([fetchAllocations(), fetchProducts(true), fetchShops()]);
          break;
        case 'inventory':
          switch (inventorySubTab) {
            case 'issued':
              await Promise.all([fetchAllocations(), fetchProducts(true)]);
              break;
            case 'stock':
              await Promise.all([fetchAllocations(), fetchProducts(true)]);
              await fetchCurrentStock();
              break;
            default:
              break;
          }
          break;
        case 'financial':
          await Promise.all([fetchUsers(true), fetchFinancialData(), fetchFinancialShifts(selectedFinancialShopId, selectedFinancialCategoryId), fetchStaffAssignments()]);
          break;
        case 'audit':
          await Promise.all([fetchAllocations(), fetchUsers(true), fetchProducts(true), fetchCategories(true), fetchShops(), fetchStaffAssignments()]);
          await fetchAuditShifts(selectedAuditShopId, selectedAuditCategoryId);
          await generateAuditReport();
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error refreshing active tab data:', error);
    } finally {
      setLoading(false);
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
        fetchFinancialData();
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

  const downloadFinancialCSV = async () => {
    try {
      // Fetch all pages to get complete data
      const params = new URLSearchParams();
      if (selectedFinancialShopId !== 'all') params.append('shopId', selectedFinancialShopId);
      if (selectedFinancialStatus !== 'all') params.append('status', selectedFinancialStatus);
      if (selectedFinancialUserId !== 'all') params.append('userId', selectedFinancialUserId);
      params.append('page', '0');
      params.append('size', '1000');
      const response = await apiClient.get('/reports/financial?' + params.toString());
      if (!response.ok) return;
      const data = await response.json();
      const shifts: any[] = data.shifts || [];

      const csvRows: string[] = [];
      csvRows.push([
        'S.No.',
        'Shift ID',
        'Counter No',
        'Shop Name',
        'Status',
        'Opened At',
        'Opened By',
        'Closed At',
        'Closed By',
        'Reconciled At',
        'Reconciled By',
        'Opening Cash Float',
        'Float Added',
        'Opening + Float Total',
        'Expected Sales Cash',
        'Expected Total Cash',
        'Expected Online',
        'Total (Cash + Online)',
        'Actual Cash counted',
        'Variance',
        'Reconciliation Audit Comment'
      ].join(','));

      shifts.forEach((shift, index) => {
        const variance = shift.variance ?? (shift.status === 'OPEN' ? 0 : (shift.actualClosingCash || 0) - (shift.expectedClosingCash || 0));
        const opUser = shift.openedByUsername || `ID: ${shift.openedByUserId}`;
        const clUser = shift.closedByUsername || (shift.closedByUserId ? `ID: ${shift.closedByUserId}` : 'N/A');
        const recUser = shift.reconciledByUsername || (shift.reconciledByUserId ? `ID: ${shift.reconciledByUserId}` : 'N/A');
        const recTime = shift.reconciledAt ? `"${new Date(shift.reconciledAt).toLocaleString()}"` : 'N/A';
        const comment = shift.reconciliationComment ? shift.reconciliationComment.replace(/"/g, '""') : '';

        csvRows.push([
          index + 1,
          shift.id,
          shift.counterNumber || 'N/A',
          `"${shift.shopName || 'Unknown'}"`,
          shift.status,
          shift.openedAt ? `"${new Date(shift.openedAt).toLocaleString()}"` : 'N/A',
          opUser,
          shift.closedAt ? `"${new Date(shift.closedAt).toLocaleString()}"` : 'N/A',
          clUser,
          recTime,
          recUser,
          (shift.openingCashBalance || 0).toFixed(2),
          (shift.cashAdditionsTotal || 0).toFixed(2),
          ((shift.openingCashBalance || 0) + (shift.cashAdditionsTotal || 0)).toFixed(2),
          (shift.expectedSalesCash || 0).toFixed(2),
          (shift.expectedClosingCash || 0).toFixed(2),
          (shift.expectedClosingOnline || 0).toFixed(2),
          ((shift.expectedClosingCash || 0) + (shift.expectedClosingOnline || 0)).toFixed(2),
          shift.status === 'OPEN' ? '0.00' : (shift.actualClosingCash || 0).toFixed(2),
          variance.toFixed(2),
          `"${comment}"`
        ].join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `shift-reconciliation-ledger-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading financial CSV:', error);
    }
  };

  const downloadCounterSalesExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSalesShopId !== 'all') params.append('shopId', selectedSalesShopId);
      if (selectedSalesCategoryId !== 'all') params.append('categoryId', selectedSalesCategoryId);
      const response = await apiClient.get('/reports/sales?' + params.toString());
      if (!response.ok) return;
      const data = await response.json();
      console.log('[downloadCounterSalesExcel] API response:', JSON.stringify(data.rows?.slice(0, 3)));
      const reportRows: any[] = data.rows || [];

      const rows: string[][] = [];
      rows.push(['S.No.', 'Counter No', 'Shop Name', 'Product', 'Issued Qty', 'Sold Qty', 'Remaining Stock', 'Selling Price', 'Sold Amount']);

      // Group by counterNumber
      const shopGroups: Record<string, any[]> = {};
      reportRows.forEach(sale => {
        const key = sale.counterNumber?.toString() || sale.shopId?.toString() || 'N/A';
        if (!shopGroups[key]) shopGroups[key] = [];
        shopGroups[key].push(sale);
      });

      let snCounter = 0;
      Object.entries(shopGroups).forEach(([counterKey, sales]) => {
        const firstRow = sales[0];
        const counterNo = firstRow.counterNumber || counterKey;
        const shopName = firstRow.shopName || 'N/A';
        let counterTotal = 0;

        sales.forEach(sale => {
          const product = products.find(p => p.id === parseInt(sale.productId));
          const issuedQty = sale.issuedQty || 0;
          const remainingQty = Math.max(0, sale.remainingQty || 0);
          const soldQty = sale.soldQty || 0;
          const sellingPrice = sale.sellingPrice || 0;
          const soldAmount = sale.totalCollected || (sellingPrice * soldQty);
          counterTotal += soldAmount;
          snCounter += 1;

          rows.push([
            snCounter.toString(),
            counterNo.toString(),
            shopName,
            sale.productName || 'Unknown',
            issuedQty.toString(),
            soldQty.toString(),
            remainingQty.toString(),
            (remainingQty < 0 ? 0 : remainingQty).toString(),
            product?.sellingPrice?.toString() || '0',
            soldAmount.toFixed(2)
          ]);
        });

        rows.push(['', `Counter ${counterNo} Total`, '', '', '', '', '', '', counterTotal.toFixed(2)]);
        rows.push([]);
      });

      const csvContent = rows.map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `counter-wise-sales-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading counter sales report:', error);
    }
  };

  const downloadCSV = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedInventoryShopId !== 'all') params.append('shopId', selectedInventoryShopId);
      if (selectedInventoryCategoryId !== 'all') params.append('categoryId', selectedInventoryCategoryId);
      const response = await apiClient.get('/inventory/reports?' + params.toString());
      if (!response.ok) return;
      const data = await response.json();

      if (inventorySubTab === 'issued') {
        const issued: any[] = data.issued || [];
        const csvRows = [['S.No.', 'Date', 'Product', 'Quantity (Issued)', 'Live Quantity', 'Shop Counter'].join(',')];
        issued.forEach((issue, index) => {
          const issueDate = (issue.createdAt || issue.saleDate)
            ? new Date(issue.createdAt || issue.saleDate).toLocaleDateString()
            : 'N/A';
          csvRows.push([
            index + 1,
            issueDate,
            `"${issue.productName || 'Unknown Product'}"`,
            issue.totalIssuedQty ?? 0,
            issue.liveQuantity ?? 0,
            `"${issue.shopName || issue.shopId || 'N/A'}"`
          ].join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `issued-inventory-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

      } else if (inventorySubTab === 'stock') {
        const stock: any[] = data.stock || [];
        const csvRows = [['S.No.', 'Product', 'Category', 'Live Inventory Stock', 'Total Issued Stock', 'Live Stock on Shops'].join(',')];
        stock.forEach((s, index) => {
          csvRows.push([
            index + 1,
            `"${s.productName || 'Unknown Product'}"`,
            `"${s.categoryName || 'Unknown Category'}"`,
            s.inventoryStock ?? 0,
            s.initialQuantity ?? 0,
            s.liveQuantity ?? 0
          ].join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `current-stock-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading inventory CSV:', error);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in-up p-4 sm:p-6">
        {/* ── Welcome Banner ── */}
        <section className="relative rounded-2xl p-6 sm:p-8 text-white"
          style={{ background: 'linear-gradient(135deg, #78350F 0%, #B45309 60%, #D97706 100%)' }}>
          <div className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #FDE68A 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#FDE68A' }}>Analytics & Insights</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reports & Analytics</h1>
            </div>
            <div className="flex gap-4 sm:gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{assignedShops.length}</p>
                <p className="text-xs mt-0.5" style={{ color: '#FDE68A' }}>Shops</p>
              </div>
              <div className="w-px" style={{ background: 'rgba(253,230,138,0.2)' }} />
              <div className="text-center">
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-xs mt-0.5" style={{ color: '#FDE68A' }}>Products</p>
              </div>
            </div>
          </div>
        </section>

        <div className="card min-w-0">
          {/* Tabs */}
          <div className="flex border-b overflow-x-auto text-sm" style={{ borderColor: 'var(--theme-border)' }}>
            <button
              onClick={() => setActiveTab('audit')}
              className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors"
              style={{
                borderBottom: activeTab === 'audit' ? '2px solid #D97706' : '2px solid transparent',
                color: activeTab === 'audit' ? '#B45309' : 'var(--theme-text-muted)'
              }}
            >
              Audit Reports
            </button>
            <button
              onClick={() => setActiveTab('financial')}
              className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors"
              style={{
                borderBottom: activeTab === 'financial' ? '2px solid #0284C7' : '2px solid transparent',
                color: activeTab === 'financial' ? '#0369A1' : 'var(--theme-text-muted)'
              }}
            >
              Financial Reports
            </button>
            <button
              onClick={() => setActiveTab('sales')}
              className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors"
              style={{
                borderBottom: activeTab === 'sales' ? '2px solid var(--theme-accent)' : '2px solid transparent',
                color: activeTab === 'sales' ? 'var(--theme-accent-dark)' : 'var(--theme-text-muted)'
              }}
            >
              Sales Reports
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors"
              style={{
                borderBottom: activeTab === 'inventory' ? '2px solid #7C3AED' : '2px solid transparent',
                color: activeTab === 'inventory' ? '#6D28D9' : 'var(--theme-text-muted)'
              }}
            >
              Inventory Reports
            </button>
            {showExtraReport && (
              <>
                <button
                  onClick={() => setActiveTab('reconciliation')}
                  className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors"
                  style={{
                    borderBottom: activeTab === 'reconciliation' ? '2px solid #10B981' : '2px solid transparent',
                    color: activeTab === 'reconciliation' ? '#059669' : 'var(--theme-text-muted)'
                  }}
                >
                  Reconciliation
                </button>
                <button
                  onClick={() => setActiveTab('live_operations')}
                  className="px-4 sm:px-6 py-3 whitespace-nowrap font-medium transition-colors"
                  style={{
                    borderBottom: activeTab === 'live_operations' ? '2px solid #EF4444' : '2px solid transparent',
                    color: activeTab === 'live_operations' ? '#DC2626' : 'var(--theme-text-muted)'
                  }}
                >
                  Live Operations
                </button>
              </>
            )}
          </div>

          <div className="p-4 sm:p-6">
            {/* Sales Reports Tab */}
            {activeTab === 'sales' && (
              <div>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 sm:mb-4 gap-2">
                  <h3 className="text-base sm:text-lg font-semibold">Counter-wise Sales Report</h3>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="sm:hidden flex rounded-lg border overflow-hidden">
                      <button
                        onClick={() => setMobileViewMode('card')}
                        className={`px-3 py-2 text-xs ${mobileViewMode === 'card' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
                      >
                        Card
                      </button>
                      <button
                        onClick={() => setMobileViewMode('table')}
                        className={`px-3 py-2 text-xs ${mobileViewMode === 'table' ? 'bg-green-600 text-white' : 'bg-white text-gray-700'}`}
                      >
                        Table
                      </button>
                    </div>
                    <button
                      onClick={downloadCounterSalesExcel}
                      disabled={issuedSales.length === 0}
                      className="flex-1 sm:flex-none w-full sm:w-auto bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="bg-white border rounded-xl p-4 sm:p-5 shadow-sm space-y-4 mb-6 relative z-20" style={{ borderColor: 'var(--theme-border)' }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Category</label>
                      <MuiSelect
                        value={selectedSalesCategoryId}
                        onChange={(val) => {
                          if (assignedShops.length === 1 && !isAdmin) {
                            setSelectedSalesShopId(assignedShops[0].id.toString());
                          } else {
                            setSelectedSalesShopId('all');
                          }
                          setSelectedSalesCategoryId(val);
                        }}
                        label="category"
                        options={[
                          { value: 'all', label: 'All Categories' },
                          ...(isAdmin
                            ? categories
                            : categories.filter(cat =>
                              assignedShops.some(shop => shop.categoryId?.toString() === cat.id.toString())
                            )
                          ).map(cat => ({
                            value: cat.id.toString(),
                            label: cat.name
                          }))
                        ]}
                        className="w-full text-slate-800 bg-white"
                        size="small"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Counter</label>
                      <MuiSelect
                        value={selectedSalesShopId}
                        onChange={(val) => setSelectedSalesShopId(val)}
                        label="shop"
                        options={
                          assignedShops.length === 1 && !isAdmin
                            ? assignedShops.map(shop => ({
                              value: shop.id.toString(),
                              label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                            }))
                            : [
                              { value: 'all', label: 'All Shop Counters' },
                              ...(selectedSalesCategoryId === 'all'
                                ? assignedShops
                                : assignedShops.filter(shop => shop.categoryId?.toString() === selectedSalesCategoryId.toString())
                              ).map(shop => ({
                                value: shop.id.toString(),
                                label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                              }))
                            ]
                        }
                        className="w-full text-slate-800 bg-white"
                        size="small"
                      />
                    </div>
                  </div>
                </div>

                {loading ? (
                  <ContentLoader message="Loading sales report..." />
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    {(() => {
                      // Group backend rows by counterNumber — no JS math, all values are from backend
                      const groups: Record<string, any[]> = {};
                      salesReportRows.forEach(row => {
                        const key = row.counterNumber?.toString() || 'N/A';
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(row);
                      });
                      const sortedEntries = Object.entries(groups).sort(([a], [b]) => parseInt(a) - parseInt(b));
                      if (sortedEntries.length === 0) {
                        return <div className="p-4 text-gray-500 text-center">No sales data found</div>;
                      }

                      return (
                        <>
                          {mobileViewMode === 'card' && (
                            <div className="sm:hidden space-y-3 p-3">
                              {
                                sortedEntries.map(([counterNo, rows]) => {
                                  return (
                                    <div key={counterNo} className="border rounded-lg p-2.5">
                                      <div className="font-semibold text-indigo-700 text-sm mb-2">
                                        Counter {counterNo} <span className="text-xs text-gray-500">({rows[0]?.shopName || ''})</span>
                                      </div>
                                      <div className="space-y-2">
                                        {
                                          rows.map((row) => (
                                            <div key={`${counterNo}-${row.productId}`} className="bg-gray-50 rounded p-2 text-xs">
                                              <div className="font-medium">{row.productName || 'Unknown Product'}</div>
                                              <div className="mt-1 flex justify-between"><span>Issued</span><span>{row.issuedQty ?? 0}</span></div>
                                              <div className="flex justify-between"><span>Sold</span><span>{row.soldQty ?? 0}</span></div>
                                              <div className="flex justify-between"><span>Remaining</span><span>{row.remainingQty ?? 0}</span></div>
                                            </div>
                                          ))
                                        }
                                      </div >
                                    </div >
                                  );
                                })
                              }
                            </div >
                          )}

                          <div className={`${mobileViewMode === 'table' ? 'block' : 'hidden'} sm:block`}>
                            <table className="w-full min-w-[820px] whitespace-nowrap">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="p-3 text-left text-sm">Sn</th>
                                  <th className="p-3 text-left text-sm">Product</th>
                                  <th className="p-3 text-left text-sm">Issued Qty</th>
                                  <th className="p-3 text-left text-sm">Sold Qty</th>
                                  <th className="p-3 text-left text-sm">Remaining</th>
                                </tr>
                              </thead>
                              <tbody>
                                {
                                  (() => {
                                    let sn = 0;
                                    return sortedEntries.map(([counterNo, rows]) => {
                                      return (
                                        <Fragment key={counterNo}>
                                          <tr className="bg-indigo-50">
                                            <td colSpan={5} className="p-3">
                                              <span className="font-semibold text-indigo-700">Counter {counterNo}</span>
                                              <span className="text-xs text-indigo-500 ml-2">({rows[0]?.shopName || ''})</span>
                                              <span className="text-xs text-gray-500 ml-2">{rows.length} product{rows.length > 1 ? 's' : ''}</span>
                                            </td>
                                          </tr>
                                          {
                                            rows.map((row) => {
                                              sn += 1;
                                              return (
                                                <tr key={`${counterNo}-${row.productId}-${row.shiftSessionId ?? 'all'}`} className="border-t">
                                                  <td className="p-3 text-sm text-gray-500">{sn}</td>
                                                  <td className="p-3 text-sm">{row.productName || 'Unknown'}</td>
                                                  <td className="p-3 text-sm">{row.issuedQty ?? 0}</td>
                                                  <td className="p-3 text-sm">{row.soldQty ?? 0}</td>
                                                  <td className="p-3 text-sm">
                                                    <span className={Number(row.remainingQty) <= 0 ? 'text-red-600 font-medium' : Number(row.remainingQty) <= 5 ? 'text-yellow-600 font-medium' : 'text-green-600 font-medium'}>
                                                      {row.remainingQty ?? 0}
                                                    </span>
                                                  </td>
                                                </tr>
                                              );
                                            })
                                          }
                                        </Fragment >
                                      );
                                    });
                                  })()
                                }
                                {
                                  salesReportSummary && (
                                    <tr className="border-t-2 bg-amber-50">
                                      <td className="p-3 text-sm font-bold"></td>
                                      <td className="p-3 text-sm font-bold">Grand Total</td>
                                      <td className="p-3 text-sm font-bold">{salesReportSummary.totalIssued}</td>
                                      <td className="p-3 text-sm font-bold">{salesReportSummary.totalSold}</td>
                                      <td className="p-3 text-sm font-bold">—</td>
                                    </tr>
                                  )
                                }
                              </tbody >
                            </table >
                          </div >
                        </>
                      );
                    })()}
                  </div >
                )}
              </div >
            )}


            {/* Inventory Reports Tab */}
            {
              activeTab === 'inventory' && (
                <div>
                  {/* Sub-tabs for Inventory Reports */}
                  <div className="flex mb-3 border-b overflow-x-auto text-sm">
                    <button
                      onClick={() => setInventorySubTab('issued')}
                      className={`px-3 py-1.5 whitespace-nowrap ${inventorySubTab === 'issued' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600'}`}
                    >
                      Issued Inventory
                    </button>
                    <button
                      onClick={() => setInventorySubTab('stock')}
                      className={`px-3 py-1.5 whitespace-nowrap ${inventorySubTab === 'stock' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600'}`}
                    >
                      Current Stock
                    </button>
                  </div>

                  {/* Filters */}
                  <div className="bg-white border rounded-xl p-4 sm:p-5 shadow-sm space-y-4 mb-6 relative z-20" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Category</label>
                        <MuiSelect
                          value={selectedInventoryCategoryId}
                          onChange={(val) => {
                            if (assignedShops.length === 1 && !isAdmin) {
                              setSelectedInventoryShopId(assignedShops[0].id.toString());
                            } else {
                              setSelectedInventoryShopId('all');
                            }
                            setSelectedInventoryCategoryId(val);
                          }}
                          label="category"
                          options={[
                            { value: 'all', label: 'All Categories' },
                            ...(isAdmin
                              ? categories
                              : categories.filter(cat =>
                                assignedShops.some(shop => shop.categoryId?.toString() === cat.id.toString())
                              )
                            ).map(cat => ({
                              value: cat.id.toString(),
                              label: cat.name
                            }))
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Counter</label>
                        <MuiSelect
                          value={selectedInventoryShopId}
                          onChange={(val) => setSelectedInventoryShopId(val)}
                          label="shop"
                          options={
                            assignedShops.length === 1 && !isAdmin
                              ? assignedShops.map(shop => ({
                                value: shop.id.toString(),
                                label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                              }))
                              : [
                                { value: 'all', label: 'All Shop Counters' },
                                ...(selectedInventoryCategoryId === 'all'
                                  ? assignedShops
                                  : assignedShops.filter(shop => shop.categoryId?.toString() === selectedInventoryCategoryId.toString())
                                ).map(shop => ({
                                  value: shop.id.toString(),
                                  label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                                }))
                              ]
                          }
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Issued Inventory Report */}
                  {inventorySubTab === 'issued' && (
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 sm:mb-4 gap-2">
                        <h3 className="text-base sm:text-lg font-semibold">Issued Inventory Report</h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <div className="sm:hidden flex rounded-lg border overflow-hidden">
                            <button onClick={() => setMobileViewMode('card')} className={`px-3 py-2 text-xs ${mobileViewMode === 'card' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'}`}>Card</button>
                            <button onClick={() => setMobileViewMode('table')} className={`px-3 py-2 text-xs ${mobileViewMode === 'table' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'}`}>Table</button>
                          </div>
                          <button
                            onClick={downloadCSV}
                            disabled={loading}
                            className="flex-1 sm:flex-none w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium transition-all shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>Download CSV</span>
                          </button>
                        </div>
                      </div>

                      {loading ? (
                        <ContentLoader message="Loading issued inventory..." />
                      ) : (
                        <div className="space-y-4">
                          {(() => {
                            // Group by shopId — totalIssuedQty already summed by backend
                            const groups: Record<string, any[]> = {};
                            filteredInventoryReportIssued.forEach(issue => {
                              const key = issue.shopId?.toString() || 'N/A';
                              if (!groups[key]) groups[key] = [];
                              groups[key].push(issue);
                            });
                            const sortedEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
                            return sortedEntries.length > 0 ? sortedEntries.map(([shopId, records]) => {
                              const shopName = records[0]?.shopName || '';
                              return (
                                <div key={shopId} className="border rounded-lg overflow-hidden">
                                  <div className="bg-purple-50 border-b px-4 py-2 flex items-center gap-2">
                                    <span className="font-semibold text-purple-700">{shopName || `Shop ${shopId}`}</span>
                                    <span className="ml-auto text-xs text-gray-500">{records.length} product{records.length > 1 ? 's' : ''}</span>
                                  </div>
                                  {mobileViewMode === 'card' ? (
                                    <div className="sm:hidden p-2.5 space-y-2">
                                      {records.map((issue, idx) => (
                                        <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                                          <div className="font-medium">{issue.productName || 'Unknown Product'}</div>
                                          <div className="mt-1 flex justify-between"><span>Total Issued Qty</span><span>{issue.totalIssuedQty ?? 0}</span></div>
                                          <div className="flex justify-between"><span>Live Qty</span><span>{issue.liveQuantity ?? 0}</span></div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                  <table className={`w-full min-w-[480px] ${mobileViewMode === 'table' ? 'table' : 'hidden'} sm:table`}>
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="p-3 text-left text-sm">Sn</th>
                                        <th className="p-3 text-left text-sm">Product</th>
                                        <th className="p-3 text-left text-sm">Total Issued Qty</th>
                                        <th className="p-3 text-left text-sm">Live Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {records.map((issue, idx) => (
                                        <tr key={idx} className="border-t hover:bg-gray-50">
                                          <td className="p-3 text-sm text-gray-500">{idx + 1}</td>
                                          <td className="p-3 text-sm">{issue.productName || 'Unknown'}</td>
                                          <td className="p-3 text-sm">{issue.totalIssuedQty ?? 0}</td>
                                          <td className="p-3 text-sm">{issue.liveQuantity ?? 0}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            }) : (
                              <div className="border rounded-lg p-4 text-gray-500 text-center">No issued inventory records found</div>
                            );
                          })()}
                        </div>
                      )}

                    </div>
                  )}

                  {/* Current Stock Report */}
                  {inventorySubTab === 'stock' && (
                    <div>
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-3 sm:mb-4 gap-2">
                        <h3 className="text-base sm:text-lg font-semibold">Current Stock Report</h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <div className="sm:hidden flex rounded-lg border overflow-hidden">
                            <button onClick={() => setMobileViewMode('card')} className={`px-3 py-2 text-xs ${mobileViewMode === 'card' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Card</button>
                            <button onClick={() => setMobileViewMode('table')} className={`px-3 py-2 text-xs ${mobileViewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Table</button>
                          </div>
                          <button
                            onClick={downloadCSV}
                            disabled={loading}
                            className="flex-1 sm:flex-none w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm font-medium transition-all shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            <span>Download CSV</span>
                          </button>
                        </div>
                      </div>

                      {loading ? (
                        <ContentLoader message="Loading current stock..." />
                      ) : (
                        <div className="space-y-4">
                          {(() => {
                            // Group by categoryName — status comes from backend, no JS status logic
                            const groups: Record<string, any[]> = {};
                            filteredInventoryReportStock.forEach(stock => {
                              const key = stock.categoryName || 'Uncategorized';
                              if (!groups[key]) groups[key] = [];
                              groups[key].push(stock);
                            });
                            const sortedEntries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
                            return sortedEntries.length > 0 ? sortedEntries.map(([categoryName, records]) => (
                              <div key={categoryName} className="border rounded-lg overflow-hidden">
                                <div className="bg-indigo-50 border-b px-4 py-2 flex items-center gap-2">
                                  <span className="font-semibold text-indigo-700">{categoryName}</span>
                                  <span className="ml-auto text-xs text-gray-500">{records.length} product{records.length > 1 ? 's' : ''}</span>
                                </div>
                                {mobileViewMode === 'card' ? (
                                  <div className="sm:hidden p-2.5 space-y-2">
                                    {records.map((stock, idx) => {
                                      return (
                                        <div key={idx} className="bg-gray-50 rounded p-2 text-xs">
                                          <div className="font-medium">{stock.productName || 'Unknown Product'}</div>
                                          <div className="mt-1 flex justify-between"><span>Live Inventory Stock</span><span>{stock.inventoryStock ?? 0}</span></div>
                                          <div className="mt-1 flex justify-between"><span>Total Issued Stock</span><span>{stock.initialQuantity ?? 0}</span></div>
                                          <div className="mt-1 flex justify-between"><span>Live Stock on Shops</span><span>{stock.liveQuantity ?? 0}</span></div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                <table className={`w-full min-w-[480px] ${mobileViewMode === 'table' ? 'table' : 'hidden'} sm:table`}>
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="p-3 text-left text-sm">Sn</th>
                                      <th className="p-3 text-left text-sm">Product</th>
                                      <th className="p-3 text-left text-sm">Live Inventory Stock</th>
                                      <th className="p-3 text-left text-sm">Total Issued Stock</th>
                                      <th className="p-3 text-left text-sm">Live Stock on Shops</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {records.map((stock, idx) => {
                                      return (
                                        <tr key={idx} className="border-t hover:bg-gray-50">
                                          <td className="p-3 text-sm text-gray-500">{idx + 1}</td>
                                          <td className="p-3 text-sm">{stock.productName || 'Unknown'}</td>
                                          <td className="p-3 text-sm">{stock.inventoryStock ?? 0}</td>
                                          <td className="p-3 text-sm">{stock.initialQuantity ?? 0}</td>
                                          <td className="p-3 text-sm">{stock.liveQuantity ?? 0}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )) : (
                              <div className="border rounded-lg p-4 text-gray-500 text-center">No stock records found</div>
                            );
                          })()}
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )
            }

            {/* Financial Reports Tab */}
            {
              activeTab === 'financial' && (
                <div className="space-y-6">
                  {/* ── Filters and Audit Actions ── */}
                  <div className="bg-white border rounded-xl p-4 sm:p-5 shadow-sm space-y-4 animate-fade-in relative z-20" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Shift Reconciliation Audit Ledger</h3>
                        <p className="text-xs text-slate-500">Track and audit cash drawer opening balances, expected values, actual counts, and drawer variances across counters.</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={downloadFinancialCSV}
                          disabled={financialHistory.length === 0}
                          className="text-xs font-semibold px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Export CSV
                        </button>
                        <button
                          onClick={() => fetchFinancialReport()}
                          className="text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border"
                        >
                          <RefreshIcon />
                          Refresh
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Category</label>
                        <MuiSelect
                          value={selectedFinancialCategoryId}
                          onChange={(val) => {
                            // Reset dependent filters inline
                            if (assignedShops.length === 1 && !isAdmin) {
                              setSelectedFinancialShopId(assignedShops[0].id.toString());
                            } else {
                              setSelectedFinancialShopId('all');
                            }
                            setSelectedFinancialShiftId('all');
                            setSelectedFinancialCategoryId(val);
                          }}
                          label="category"
                          options={[
                            { value: 'all', label: 'All Categories' },
                            ...(isAdmin
                              ? categories
                              : categories.filter(cat =>
                                assignedShops.some(shop => shop.categoryId?.toString() === cat.id.toString())
                              )
                            ).map(cat => ({
                              value: cat.id.toString(),
                              label: cat.name
                            }))
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Counter</label>
                        <MuiSelect
                          value={selectedFinancialShopId}
                          onChange={(val) => {
                            setFinancialPage(0);
                            setSelectedFinancialShiftId('all');
                            setSelectedFinancialShopId(val);
                          }}
                          label={`shop`}
                          options={
                            assignedShops.length === 1 && !isAdmin
                              ? assignedShops.map(shop => ({
                                value: shop.id.toString(),
                                label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                              }))
                              : [
                                { value: 'all', label: 'All Shop Counters' },
                                ...(selectedFinancialCategoryId === 'all'
                                  ? assignedShops
                                  : assignedShops.filter(shop => shop.categoryId?.toString() === selectedFinancialCategoryId.toString())
                                ).map(shop => ({
                                  value: shop.id.toString(),
                                  label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                                }))
                              ]
                          }
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Shift Session</label>
                        <MuiSelect
                          value={selectedFinancialShiftId}
                          onChange={(val) => setSelectedFinancialShiftId(val)}
                          label="shift"
                          options={[
                            { value: 'all', label: 'All Shift Sessions' },
                            ...financialShiftsList.map(shift => {
                              const openerUser = users.find(u => u.id === shift.openedByUserId)?.username || `ID: ${shift.openedByUserId}`;
                              const openDate = shift.openedAt ? new Date(shift.openedAt).toLocaleDateString() : '';
                              const shopInfo = selectedFinancialShopId === 'all' && shift.counterNumber
                                ? ` (Counter ${shift.counterNumber})`
                                : '';
                              return {
                                value: shift.id.toString(),
                                label: `Shift #${shift.id}${shopInfo} [${openDate}] - Opener: ${openerUser}`
                              };
                            })
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by User</label>
                        <MuiSelect
                          value={selectedFinancialUserId}
                          onChange={(val) => setSelectedFinancialUserId(val)}
                          label="user"
                          options={[
                            { value: 'all', label: 'All Users' },
                            ...availableFinancialUsers.map(u => ({
                              value: u.id.toString(),
                              label: `${u.username} (${u.roles?.[0] || 'USER'})`
                            }))
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Audit Status</label>
                        <MuiSelect
                          value={selectedFinancialStatus}
                          onChange={(val) => setSelectedFinancialStatus(val)}
                          label="Status"
                          options={[
                            { value: 'all', label: 'All Statuses' },
                            { value: 'OPEN', label: 'OPEN (Active Session)' },
                            { value: 'CLOSED', label: 'CLOSED (Awaiting Audit)' },
                            { value: 'RECONCILED', label: 'RECONCILED (Settled)' }
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Feedback Messages ── */}
                  {successMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm font-semibold flex items-center gap-2 shadow-sm animate-fade-in">
                      ✅ {successMsg}
                    </div>
                  )}
                  {errorMsg && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 text-sm font-semibold flex items-center gap-2 shadow-sm animate-pulse">
                      ⚠️ {errorMsg}
                    </div>
                  )}

                  {/* ── Key Performance Indicators (KPI Cards) ── */}
                  {(() => {
                    // Status and userId are now applied server-side by fetchFinancialReport
                    // (sent as query params), so financialHistory already only contains
                    // matching rows for those two. Category/shift still need to be filtered
                    // client-side since the backend endpoint doesn't support them.
                    const filtered = financialHistory.filter((s) => {
                      let matchCategory = true;
                      if (selectedFinancialCategoryId !== 'all') {
                        const shopObj = assignedShops.find(shop => shop.id.toString() === s.shopId?.toString());
                        matchCategory = shopObj?.categoryId?.toString() === selectedFinancialCategoryId;
                      }

                      const matchShift = selectedFinancialShiftId === 'all' || s.id?.toString() === selectedFinancialShiftId;

                      return matchCategory && matchShift;
                    });

                    const totalCount = filtered.length;
                    const totalExpected = filtered.reduce((sum, s) => sum + (s.expectedClosingCash || 0), 0);
                    const totalActual = filtered.reduce((sum, s) => sum + (s.actualClosingCash || 0), 0);
                    const activeShifts = filtered.filter(s => s.status === 'OPEN').length;

                    const closedOrReconciled = filtered.filter(s => s.status !== 'OPEN');
                    const discrepancy = closedOrReconciled.reduce((sum, s) => sum + ((s.actualClosingCash || 0) - (s.expectedClosingCash || 0)), 0);

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {/* Card 1: Total Shifts */}
                          <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Shifts</p>
                            <div className="mt-2 flex items-baseline justify-between">
                              <span className="text-2xl font-extrabold text-slate-800">{totalCount}</span>
                              {activeShifts > 0 && (
                                <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-medium flex items-center gap-1 animate-pulse">
                                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                  {activeShifts} Active
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card 2: Expected Cash flow */}
                          <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expected Cash</p>
                            <div className="mt-2 flex items-baseline justify-between">
                              <span className="text-2xl font-extrabold text-slate-800">₹{totalExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          {/* Card 3: Actual counted cash */}
                          <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Actual Cash</p>
                            <div className="mt-2 flex items-baseline justify-between">
                              <span className="text-2xl font-extrabold text-slate-800">₹{totalActual.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          {/* Card 4: Variance */}
                          <div className={`p-4 border rounded-xl shadow-sm flex flex-col justify-between transition-colors ${discrepancy < 0 ? 'bg-red-50/50 border-red-200' : discrepancy > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-emerald-50/40 border-emerald-200'
                            }`}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Net Variance</p>
                            <div className="mt-2 flex items-baseline justify-between">
                              <span className={`text-2xl font-extrabold ${discrepancy < 0 ? 'text-red-700' : discrepancy > 0 ? 'text-amber-700' : 'text-emerald-700'
                                }`}>
                                {discrepancy > 0 ? '+' : ''}₹{discrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${discrepancy < 0 ? 'bg-red-100 text-red-800 border-red-300' :
                                discrepancy > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                  'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                {discrepancy < 0 ? 'SHORTAGE' : discrepancy > 0 ? 'OVERAGE' : 'BALANCED'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* ── Ledger Table / Card List ── */}
                        {financialLoading ? (
                          <ContentLoader message="Loading shift audit history..." />
                        ) : filtered.length === 0 ? (
                          <div className="text-center py-12 bg-slate-50 border rounded-xl text-slate-500" style={{ borderColor: 'var(--theme-border)' }}>
                            <p className="font-semibold text-base">No shift audit logs found</p>
                            <p className="text-xs mt-1">Try expanding your counter filter or status selector.</p>
                          </div>
                        ) : (
                          <div className="space-y-4 animate-fade-in-up">
                            {/* Desktop view table */}
                            <div className="hidden md:block overflow-hidden bg-white border rounded-xl shadow-sm" style={{ borderColor: 'var(--theme-border)' }}>
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b text-xs font-bold text-slate-600 uppercase tracking-wider" style={{ borderColor: 'var(--theme-border)' }}>
                                    <th className="p-4">Sn</th>
                                    <th className="p-4">Shift Details</th>
                                    <th className="p-4">Counter</th>
                                    <th className="p-4 text-center">Opening + Float Cash</th>
                                    <th className="p-4 text-center">Expected Sales Cash</th>
                                    <th className="p-4 text-center">Expected Total Cash</th>
                                    <th className="p-4 text-center">Expected Online</th>
                                    <th className="p-4 text-center">Expected Total</th>
                                    <th className="p-4 text-center">Actual Total Cash</th>
                                    <th className="p-4 text-center">Variance</th>
                                    <th className="p-4 text-center">Status</th>
                                    <th className="p-4 text-center">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y text-slate-700" style={{ borderColor: 'var(--theme-border)' }}>
                                  {filtered.map((shift, idx) => {
                                    // All computed fields come from backend — no JS math
                                    const variance = shift.variance ?? ((shift.actualClosingCash || 0) - (shift.expectedClosingCash || 0));
                                    const opUser = shift.openedByUsername || `ID: ${shift.openedByUserId}`;
                                    const clUser = shift.closedByUsername || (shift.closedByUserId ? `ID: ${shift.closedByUserId}` : '');
                                    const recUser = shift.reconciledByUsername || (shift.reconciledByUserId ? `ID: ${shift.reconciledByUserId}` : '');

                                    return (
                                      <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors text-sm">
                                        <td className="p-4 text-slate-500">{idx + 1}</td>
                                        <td className="p-4">
                                          <div className="font-bold text-slate-900">Shift #{shift.id}</div>
                                          <div className="text-xxs text-slate-400 font-mono mt-0.5">
                                            Open: {new Date(shift.openedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} ({opUser})
                                          </div>
                                          {shift.closedAt && (
                                            <div className="text-xxs text-slate-400 font-mono">
                                              Close: {new Date(shift.closedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} {clUser && `(${clUser})`}
                                            </div>
                                          )}
                                          {shift.reconciledAt && (
                                            <div className="text-xxs text-indigo-500 font-mono mt-0.5">
                                              Audited: {new Date(shift.reconciledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} {recUser && `by ${recUser}`}
                                            </div>
                                          )}
                                          {shift.reconciliationComment && (
                                            <div className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1.5 max-w-xs break-words">
                                              💬 {shift.reconciliationComment}
                                            </div>
                                          )}
                                          {shift.workingStaff && shift.workingStaff.length > 0 && (
                                            <div className="mt-1.5 flex flex-wrap gap-1 max-w-xs">
                                              {shift.workingStaff.map((w: any) => (
                                                <span
                                                  key={w.userId}
                                                  title={`${w.role}${w.source === 'SOLD' ? ' — sold during this shift' : ' — assigned to shop, no sale recorded this shift'}`}
                                                  className={
                                                    w.source === 'SOLD'
                                                      ? 'text-xxs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                      : 'text-xxs font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 border-dashed'
                                                  }
                                                >
                                                  {w.username}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </td>
                                        <td className="p-4 font-medium">
                                          <div className="text-slate-900 font-semibold">Counter {shift.counterNumber}</div>
                                          <div className="text-xs text-slate-500">{shift.shopName}</div>
                                        </td>
                                        <td className="p-4 text-center font-mono font-medium">₹{((shift.openingCashBalance || 0) + (shift.cashAdditionsTotal || 0)).toFixed(2)}</td>
                                        <td className="p-4 text-center font-mono font-medium">₹{(shift.expectedSalesCash || 0).toFixed(2)}</td>
                                        <td className="p-4 text-center font-mono font-medium">₹{(shift.expectedClosingCash || 0).toFixed(2)}</td>
                                        <td className="p-4 text-center font-mono font-medium">₹{(shift.expectedClosingOnline || 0).toFixed(2)}</td>
                                        <td className="p-4 text-center font-mono font-bold">₹{((shift.expectedClosingCash || 0) + (shift.expectedClosingOnline || 0)).toFixed(2)}</td>
                                        <td className="p-4 text-center font-mono font-medium">
                                          {shift.status === 'OPEN' ? '—' : `₹${(shift.actualClosingCash || 0).toFixed(2)}`}
                                        </td>
                                        <td className="p-4 text-center font-mono font-bold">
                                          {shift.status === 'OPEN' ? (
                                            <span className="text-slate-400 font-medium text-xs">Active Shift</span>
                                          ) : (
                                            <span className={variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                                              {variance > 0 ? '+' : ''}₹{variance.toFixed(2)}
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-4 text-center">
                                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${shift.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            shift.status === 'CLOSED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                              'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                            {shift.status === 'OPEN' && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>}
                                            {shift.status}
                                          </span>
                                        </td>
                                        <td className="p-4 text-center">
                                          {shift.status === 'CLOSED' && canReconcile ? (
                                            <button
                                              onClick={() => handleReconcileShift(shift.id)}
                                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
                                            >
                                              Reconcile
                                            </button>
                                          ) : shift.status === 'RECONCILED' ? (
                                            <span className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                              Audited
                                            </span>
                                          ) : shift.status === 'OPEN' ? (
                                            <span className="text-xs text-slate-400 font-medium">In Progress</span>
                                          ) : (
                                            <span className="text-xs text-slate-400 font-medium">Locked</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Mobile view cards */}
                            <div className="md:hidden space-y-3">
                              {filtered.map((shift) => {
                                const variance = (shift.actualClosingCash || 0) - (shift.expectedClosingCash || 0);
                                const opUser = users.find(u => u.id === shift.openedByUserId)?.username || `ID: ${shift.openedByUserId}`;
                                const clUser = shift.closedByUserId ? (users.find(u => u.id === shift.closedByUserId)?.username || `ID: ${shift.closedByUserId}`) : '';
                                const recUser = shift.reconciledByUserId ? (users.find(u => u.id === shift.reconciledByUserId)?.username || `ID: ${shift.reconciledByUserId}`) : '';

                                return (
                                  <div key={shift.id} className="bg-white border rounded-xl p-4 shadow-sm space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <div className="font-bold text-slate-900 text-base">Shift #{shift.id}</div>
                                        <div className="text-xs text-slate-500">Counter {shift.counterNumber} - {shift.shopName}</div>
                                      </div>
                                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xxs font-bold border ${shift.status === 'OPEN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        shift.status === 'CLOSED' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                          'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                        {shift.status}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border">
                                      <div>
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Opening + Float</span>
                                        <span className="font-bold text-slate-800 font-mono">₹{((shift.openingCashBalance || 0) + (shift.cashAdditionsTotal || 0)).toFixed(2)}</span>
                                      </div>
                                      <div>
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Expected Sales Cash</span>
                                        <span className="font-bold text-slate-800 font-mono">₹{(shift.expectedSalesCash || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="mt-1">
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Expected Total Cash</span>
                                        <span className="font-bold text-slate-800 font-mono">₹{(shift.expectedClosingCash || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="mt-1">
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Expected Online</span>
                                        <span className="font-bold text-slate-800 font-mono">₹{(shift.expectedClosingOnline || 0).toFixed(2)}</span>
                                      </div>
                                      <div className="mt-1">
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Total</span>
                                        <span className="font-bold text-slate-800 font-mono">₹{((shift.expectedClosingCash || 0) + (shift.expectedClosingOnline || 0)).toFixed(2)}</span>
                                      </div>
                                      <div className="mt-1">
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Actual Cash</span>
                                        <span className="font-bold text-slate-800 font-mono">
                                          {shift.status === 'OPEN' ? '—' : `₹${(shift.actualClosingCash || 0).toFixed(2)}`}
                                        </span>
                                      </div>
                                      <div className="mt-1">
                                        <span className="text-slate-400 block text-xxs font-semibold uppercase">Variance</span>
                                        <span className="font-mono font-bold">
                                          {shift.status === 'OPEN' ? (
                                            <span className="text-slate-400 font-medium">In Progress</span>
                                          ) : (
                                            <span className={variance < 0 ? 'text-red-600' : variance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                                              {variance > 0 ? '+' : ''}₹{variance.toFixed(2)}
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-xxs text-slate-400 font-medium space-y-0.5">
                                      <div>Opened: {new Date(shift.openedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} ({opUser})</div>
                                      {shift.closedAt && <div>Closed: {new Date(shift.closedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} {clUser && `(${clUser})`}</div>}
                                      {shift.reconciledAt && (
                                        <div className="text-xxs text-indigo-600 font-semibold font-mono mt-0.5">
                                          Audited: {new Date(shift.reconciledAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} {recUser && `by ${recUser}`}
                                        </div>
                                      )}
                                      {shift.reconciliationComment && (
                                        <div className="text-xs text-amber-700 font-medium bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1.5 max-w-full break-words">
                                          💬 {shift.reconciliationComment}
                                        </div>
                                      )}
                                      {shift.workingStaff && shift.workingStaff.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          {shift.workingStaff.map((w: any) => (
                                            <span
                                              key={w.userId}
                                              title={`${w.role}${w.source === 'SOLD' ? ' — sold during this shift' : ' — assigned to shop, no sale recorded this shift'}`}
                                              className={
                                                w.source === 'SOLD'
                                                  ? 'text-xxs font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                  : 'text-xxs font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 border-dashed'
                                              }
                                            >
                                              {w.username}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {shift.status === 'CLOSED' && canReconcile && (
                                      <button
                                        onClick={() => handleReconcileShift(shift.id)}
                                        className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                                      >
                                        Reconcile Shift Drawer
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pagination Controls */}
                            {selectedFinancialShopId !== 'all' && filtered.length > 0 && (
                              <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold text-slate-500">
                                <div>
                                  Page <span className="text-slate-900 font-bold">{financialPage + 1}</span> (up to {financialSize} records)
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (financialPage > 0) {
                                        setFinancialPage(prev => prev - 1);
                                      }
                                    }}
                                    disabled={financialPage === 0}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-all active:scale-95 shadow-sm"
                                  >
                                    ◀ Previous
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (hasMoreFinancial) {
                                        setFinancialPage(prev => prev + 1);
                                      }
                                    }}
                                    disabled={!hasMoreFinancial}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white text-slate-700 transition-all active:scale-95 shadow-sm"
                                  >
                                    Next ▶
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )
            }
            {
              activeTab === 'audit' && (
                <div className="space-y-6">
                  {/* ── Filters and Actions ── */}
                  <div className="bg-white border rounded-xl p-4 sm:p-5 shadow-sm space-y-4 animate-fade-in relative z-20" style={{ borderColor: 'var(--theme-border)' }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-800">Shop & Shift Audit Report Ledger</h3>
                        <p className="text-xs text-slate-500">Cross-examine allocations, sold units, and precise cash/digital collections across counters and operational shifts.</p>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={downloadAuditReportExcel}
                          disabled={filteredAuditRows.length === 0}
                          className="text-xs font-semibold px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          Download CSV
                        </button>
                        <button
                          onClick={generateAuditReport}
                          className="text-xs font-semibold px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                        >
                          <RefreshIcon /> Refresh
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Category</label>
                        <MuiSelect
                          value={selectedAuditCategoryId}
                          onChange={(val) => {
                            // Reset dependent filters inline — prevents Effect 3 cascade firing
                            if (assignedShops.length === 1 && !isAdmin) {
                              setSelectedAuditShopId(assignedShops[0].id.toString());
                            } else {
                              setSelectedAuditShopId('all');
                            }
                            setSelectedAuditShiftId('all');
                            setSelectedAuditCategoryId(val);
                          }}
                          label="category"
                          options={[
                            { value: 'all', label: 'All Categories' },
                            ...(isAdmin
                              ? categories
                              : categories.filter(cat =>
                                assignedShops.some(shop => shop.categoryId?.toString() === cat.id.toString())
                              )
                            ).map(cat => ({
                              value: cat.id.toString(),
                              label: cat.name
                            }))
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Counter</label>
                        <MuiSelect
                          value={selectedAuditShopId}
                          onChange={(val) => {
                            setSelectedAuditShiftId('all');
                            setSelectedAuditShopId(val);
                          }}
                          label="shop"
                          options={
                            assignedShops.length === 1 && !isAdmin
                              ? assignedShops.map(shop => ({
                                value: shop.id.toString(),
                                label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                              }))
                              : [
                                { value: 'all', label: 'All Shop Counters' },
                                ...(selectedAuditCategoryId === 'all'
                                  ? assignedShops
                                  : assignedShops.filter(shop => shop.categoryId?.toString() === selectedAuditCategoryId.toString())
                                ).map(shop => ({
                                  value: shop.id.toString(),
                                  label: `Counter ${shop.counterNumber} - ${shop.shopName}`
                                }))
                              ]
                          }
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by Shift Session</label>
                        <MuiSelect
                          value={selectedAuditShiftId}
                          onChange={(val) => setSelectedAuditShiftId(val)}
                          label="shift"
                          options={[
                            { value: 'all', label: 'All Shift Sessions' },
                            ...auditShiftsList.map(shift => {
                              const openerUser = users.find(u => u.id === shift.openedByUserId)?.username || `ID: ${shift.openedByUserId}`;
                              const openDate = shift.openedAt ? new Date(shift.openedAt).toLocaleDateString() : '';
                              const shopInfo = selectedAuditShopId === 'all' && shift.counterNumber
                                ? ` (Counter ${shift.counterNumber})`
                                : '';
                              return {
                                value: shift.id.toString(),
                                label: `Shift #${shift.id}${shopInfo} [${openDate}] - Opener: ${openerUser}`
                              };
                            })
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Filter by User</label>
                        <MuiSelect
                          value={selectedAuditUserId}
                          onChange={(val) => setSelectedAuditUserId(val)}
                          label="user"
                          options={[
                            { value: 'all', label: 'All Users/Supervisors' },
                            ...availableAuditUsers.map(u => ({
                              value: u.id.toString(),
                              label: `${u.username} (${u.roles?.[0] || 'USER'})`
                            }))
                          ]}
                          className="w-full text-slate-800 bg-white"
                          size="small"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs for Audit Reports */}
                  <div className="flex border-b overflow-x-auto text-sm mb-4" style={{ borderColor: 'var(--theme-border)' }}>
                    <button
                      onClick={() => setAuditSubTab('shop_audit')}
                      className={`px-4 sm:px-6 py-2.5 whitespace-nowrap font-semibold transition-all border-b-2 ${auditSubTab === 'shop_audit'
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                        }`}
                    >
                      📋 Shop Audit Report
                    </button>
                    <button
                      onClick={() => setAuditSubTab('inventory_audit')}
                      className={`px-4 sm:px-6 py-2.5 whitespace-nowrap font-semibold transition-all border-b-2 ${auditSubTab === 'inventory_audit'
                        ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                        }`}
                    >
                      📋 Inventory Audit Report
                    </button>
                    <button
                      onClick={() => setAuditSubTab('threeway')}
                      className={`px-4 sm:px-6 py-2.5 whitespace-nowrap font-semibold transition-all border-b-2 ${auditSubTab === 'threeway'
                        ? 'border-emerald-600 text-emerald-600 bg-emerald-50/30'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                        }`}
                    >
                      ⚖️ 3-Way Match Report
                    </button>
                  </div>

                  {/* ── Report Table ── */}
                  {auditLoading ? (
                    <ContentLoader message="Aggregating transactional logs and allocations..." />
                  ) : filteredAuditRows.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 border rounded-xl text-slate-500" style={{ borderColor: 'var(--theme-border)' }}>
                      <p className="font-bold text-base">No audit ledger records</p>
                      <p className="text-xs mt-1">{`Select filters above to update.`}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-fade-in-up">
                      {auditSubTab === 'threeway' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {/* KPI 1: Expected POS Sales */}
                          <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expected POS Sales</p>
                            <div className="mt-2">
                              <span className="text-2xl font-extrabold text-slate-800">
                                ₹{filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.expectedSalesAmount, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* KPI 2: Actual Financials Collected */}
                          <div className="bg-white p-4 border rounded-xl shadow-sm flex flex-col justify-between" style={{ borderColor: 'var(--theme-border)' }}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actual Collected</p>
                            <div className="mt-2">
                              <span className="text-2xl font-extrabold text-slate-800">
                                ₹{filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.actualFinancialsCollected, 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          {/* KPI 3: Total Net Variance */}
                          <div className={`p-4 border rounded-xl shadow-sm flex flex-col justify-between transition-colors ${filteredThreeWayMatchData.totalVarianceAmount < 0 ? 'bg-red-50/50 border-red-200' : filteredThreeWayMatchData.totalVarianceAmount > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-emerald-50/40 border-emerald-200'
                            }`}>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Net Variance</p>
                            <div className="mt-2 flex items-baseline justify-between">
                              <span className={`text-2xl font-extrabold ${filteredThreeWayMatchData.totalVarianceAmount < 0 ? 'text-red-700' : filteredThreeWayMatchData.totalVarianceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                                }`}>
                                {filteredThreeWayMatchData.totalVarianceAmount > 0 ? '+' : ''}₹{filteredThreeWayMatchData.totalVarianceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${filteredThreeWayMatchData.totalVarianceAmount < 0 ? 'bg-red-100 text-red-800 border-red-300' :
                                filteredThreeWayMatchData.totalVarianceAmount > 0 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                  'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                {filteredThreeWayMatchData.totalVarianceAmount < 0 ? 'SHORTAGE' : filteredThreeWayMatchData.totalVarianceAmount > 0 ? 'OVERAGE' : 'BALANCED'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="overflow-hidden bg-white border rounded-xl shadow-sm" style={{ borderColor: 'var(--theme-border)' }}>
                        <div className="overflow-x-auto">
                          {auditSubTab === 'shop_audit' ? (
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                              <thead>
                                <tr className="bg-slate-50 border-b text-xs font-bold text-slate-600 uppercase tracking-wider" style={{ borderColor: 'var(--theme-border)' }}>
                                  <th className="p-4">Sn</th>
                                  <th className="p-4">Product Name</th>
                                  <th className="p-4 text-center">Total Issue</th>
                                  <th className="p-4 text-center">Sold Qty</th>
                                  <th className="p-4 text-center">Returned Qty</th>
                                  <th className="p-4 text-center">Cancelled Qty</th>
                                  <th className="p-4 text-center">Remaining Qty</th>
                                  <th className="p-4 text-center">Net Sold Qty</th>
                                  <th className="p-4 text-center">Rate</th>
                                  <th className="p-4 text-right">Cash</th>
                                  <th className="p-4 text-right">Online</th>
                                  <th className="p-4 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y text-slate-700 text-sm" style={{ borderColor: 'var(--theme-border)' }}>
                                {sortedAuditRows.map((row, idx) => {
                                  const imbalance = stockImbalance(row);
                                  return (
                                    <tr key={`${row.shopId}-${row.productId}-${row.shiftSessionId ?? 'all'}`} className={`transition-colors ${imbalance !== 0 ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50/50'}`}>
                                      <td className="p-4 text-slate-500 font-mono">{idx + 1}</td>
                                      <td className="p-4 font-semibold text-slate-900">
                                        {row.productName}
                                        {imbalance !== 0 && (
                                          <span
                                            className="ml-2 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300"
                                            title={`Stock mismatch: issued ${row.issuedQty ?? 0} vs remaining ${row.remainingQty ?? 0} + sold ${row.soldQty ?? 0} - returned ${row.returnedQty ?? 0} = ${(row.remainingQty ?? 0) + (row.soldQty ?? 0) - (row.returnedQty ?? 0)}`}
                                          >
                                            {imbalance > 0 ? '+' : ''}{imbalance} UNACCOUNTED
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-4 text-center font-mono">{row.issuedQty}</td>
                                      <td className="p-4 text-center font-mono">{row.soldQty}</td>
                                      <td className="p-4 text-center font-mono text-amber-700 font-medium">{row.returnedQty}</td>
                                      <td className="p-4 text-center font-mono text-rose-700 font-medium">{row.cancelledQty ?? 0}</td>
                                      <td className="p-4 text-center font-mono">
                                        <span className={row.remainingQty === 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                          {row.remainingQty}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center font-mono text-indigo-700 font-semibold">{row.netQty}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">₹{(row.sellingPrice || 0).toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono font-medium text-emerald-700">₹{row.cashCollected.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono font-medium text-sky-700">₹{row.onlineCollected.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono font-bold text-indigo-700">₹{row.totalCollected.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                                {/* Summary Bottom Line */}
                                {(() => {
                                  const totalIssued = filteredAuditRows.reduce((sum, r) => sum + r.issuedQty, 0);
                                  const totalRemaining = filteredAuditRows.reduce((sum, r) => sum + r.remainingQty, 0);
                                  const totalSold = filteredAuditRows.reduce((sum, r) => sum + r.soldQty, 0);
                                  const totalReturned = filteredAuditRows.reduce((sum, r) => sum + r.returnedQty, 0);
                                  const totalCancelled = filteredAuditRows.reduce((sum, r) => sum + (r.cancelledQty || 0), 0);
                                  const totalNet = filteredAuditRows.reduce((sum, r) => sum + r.netQty, 0);
                                  const totalCash = filteredAuditRows.reduce((sum, r) => sum + r.cashCollected, 0);
                                  const totalOnline = filteredAuditRows.reduce((sum, r) => sum + r.onlineCollected, 0);
                                  const totalColl = filteredAuditRows.reduce((sum, r) => sum + r.totalCollected, 0);

                                  return (
                                    <tr className="bg-slate-50/80 font-bold border-t-2" style={{ borderColor: 'var(--theme-border)' }}>
                                      <td className="p-4"></td>
                                      <td className="p-4 text-slate-900 font-extrabold">TOTAL COMPILATION</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalIssued}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalSold}</td>
                                      <td className="p-4 text-center font-mono text-amber-800">{totalReturned}</td>
                                      <td className="p-4 text-center font-mono text-rose-800">{totalCancelled}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalRemaining}</td>
                                      <td className="p-4 text-center font-mono text-indigo-900">{totalNet}</td>
                                      <td className="p-4 text-center font-mono text-slate-400">—</td>
                                      <td className="p-4 text-right font-mono text-emerald-800">₹{totalCash.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono text-sky-800">₹{totalOnline.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono text-indigo-900 text-base">₹{totalColl.toFixed(2)}</td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          ) : auditSubTab === 'inventory_audit' ? (
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                              <thead>
                                <tr className="bg-slate-50 border-b text-xs font-bold text-slate-600 uppercase tracking-wider" style={{ borderColor: 'var(--theme-border)' }}>
                                  <th className="p-4">Sn</th>
                                  <th className="p-4">Product Name</th>
                                  <th className="p-4 text-center">Total issue</th>
                                  <th className="p-4 text-center">Remaining Qty</th>
                                  <th className="p-4 text-center">Net Sold Qty</th>
                                  <th className="p-4 text-center">Issued Worth</th>
                                  <th className="p-4 text-center">Rate</th>
                                  <th className="p-4 text-right">Cash</th>
                                  <th className="p-4 text-right">Online</th>
                                  <th className="p-4 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y text-slate-700 text-sm" style={{ borderColor: 'var(--theme-border)' }}>
                                {sortedAuditRows.map((row, idx) => {
                                  const imbalance = stockImbalance(row);
                                  return (
                                    <tr key={`${row.shopId}-${row.productId}-${row.shiftSessionId ?? 'all'}`} className={`transition-colors ${imbalance !== 0 ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50/50'}`}>
                                      <td className="p-4 text-slate-500 font-mono">{idx + 1}</td>
                                      <td className="p-4 font-semibold text-slate-900">
                                        {row.productName}
                                        {imbalance !== 0 && (
                                          <span
                                            className="ml-2 align-middle text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300"
                                            title={`Stock mismatch: issued ${row.issuedQty ?? 0} vs remaining ${row.remainingQty ?? 0} + sold ${row.soldQty ?? 0} - returned ${row.returnedQty ?? 0} = ${(row.remainingQty ?? 0) + (row.soldQty ?? 0) - (row.returnedQty ?? 0)}`}
                                          >
                                            {imbalance > 0 ? '+' : ''}{imbalance} UNACCOUNTED
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-4 text-center font-mono">{row.issuedQty}</td>
                                      <td className="p-4 text-center font-mono">
                                        <span className={row.remainingQty === 0 ? 'text-rose-600 font-bold' : 'text-slate-700'}>
                                          {row.remainingQty}
                                        </span>
                                      </td>
                                      <td className="p-4 text-center font-mono text-indigo-700 font-semibold">{row.netQty}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">₹{((row.issuedQty || 0) * (row.sellingPrice || 0)).toFixed(2)}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">₹{(row.sellingPrice || 0).toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono font-medium text-emerald-700">₹{row.cashCollected.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono font-medium text-sky-700">₹{row.onlineCollected.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono font-bold text-indigo-700">₹{row.totalCollected.toFixed(2)}</td>
                                    </tr>
                                  );
                                })}
                                {/* Summary Bottom Line */}
                                {(() => {
                                  const totalIssued = filteredAuditRows.reduce((sum, r) => sum + r.issuedQty, 0);
                                  const totalIssuedAmount = filteredAuditRows.reduce((sum, r) => sum + (r.issuedQty || 0) * (r.sellingPrice || 0), 0);
                                  const totalRemaining = filteredAuditRows.reduce((sum, r) => sum + r.remainingQty, 0);
                                  const totalNet = filteredAuditRows.reduce((sum, r) => sum + r.netQty, 0);
                                  const totalCash = filteredAuditRows.reduce((sum, r) => sum + r.cashCollected, 0);
                                  const totalOnline = filteredAuditRows.reduce((sum, r) => sum + r.onlineCollected, 0);
                                  const totalColl = filteredAuditRows.reduce((sum, r) => sum + r.totalCollected, 0);

                                  return (
                                    <tr className="bg-slate-50/80 font-bold border-t-2" style={{ borderColor: 'var(--theme-border)' }}>
                                      <td className="p-4"></td>
                                      <td className="p-4 text-slate-900 font-extrabold">TOTAL COMPILATION</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalIssued}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalRemaining}</td>
                                      <td className="p-4 text-center font-mono text-indigo-900">{totalNet}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">₹{totalIssuedAmount.toFixed(2)}</td>
                                      <td className="p-4 text-center font-mono text-slate-400">—</td>
                                      <td className="p-4 text-right font-mono text-emerald-800">₹{totalCash.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono text-sky-800">₹{totalOnline.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono text-indigo-900 text-base">₹{totalColl.toFixed(2)}</td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          ) : (
                            <table className="w-full text-left border-collapse whitespace-nowrap">
                              <thead>
                                <tr className="bg-slate-50 border-b text-xs font-bold text-slate-600 uppercase tracking-wider" style={{ borderColor: 'var(--theme-border)' }}>
                                  <th className="p-4">Sn</th>
                                  <th className="p-4">Product Name</th>
                                  <th className="p-4 text-center">Expected Sales Qty (POS)</th>
                                  <th className="p-4 text-center">Actual Inventory Depleted Qty</th>
                                  <th className="p-4 text-center">Qty Variance</th>
                                  <th className="p-4 text-right">Expected Sales Amount</th>
                                  <th className="p-4 text-right">Actual Collected Amount</th>
                                  <th className="p-4 text-right">Financial Variance</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y text-slate-700 text-sm" style={{ borderColor: 'var(--theme-border)' }}>
                                {filteredThreeWayMatchData.items.map((row, idx) => (
                                  <tr key={row.productId} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4 text-slate-500 font-mono">{idx + 1}</td>
                                    <td className="p-4 font-semibold text-slate-900">{row.productName}</td>
                                    <td className="p-4 text-center font-mono">{row.expectedSalesQty}</td>
                                    <td className="p-4 text-center font-mono">{row.actualInventoryDepletedQty}</td>
                                    <td className={`p-4 text-center font-mono font-bold ${row.qtyVariance < 0 ? 'text-rose-600' : row.qtyVariance > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                                      {row.qtyVariance > 0 ? '+' : ''}{row.qtyVariance}
                                    </td>
                                    <td className="p-4 text-right font-mono text-slate-800">₹{row.expectedSalesAmount.toFixed(2)}</td>
                                    <td className="p-4 text-right font-mono text-emerald-700 font-medium">₹{row.actualFinancialsCollected.toFixed(2)}</td>
                                    <td className={`p-4 text-right font-mono font-bold ${row.financialVariance < 0 ? 'text-red-600' : row.financialVariance > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                                      {row.financialVariance > 0 ? '+' : ''}₹{row.financialVariance.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                                {/* 3-Way Match Summary Bottom Line */}
                                {(() => {
                                  const totalExpectedQty = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.expectedSalesQty, 0);
                                  const totalDepletedQty = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.actualInventoryDepletedQty, 0);
                                  const totalQtyVariance = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.qtyVariance, 0);
                                  const totalExpectedAmt = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.expectedSalesAmount, 0);
                                  const totalCollectedAmt = filteredThreeWayMatchData.items.reduce((sum, i) => sum + i.actualFinancialsCollected, 0);
                                  const totalFinVariance = filteredThreeWayMatchData.totalVarianceAmount;

                                  return (
                                    <tr className="bg-slate-50/80 font-bold border-t-2" style={{ borderColor: 'var(--theme-border)' }}>
                                      <td className="p-4"></td>
                                      <td className="p-4 text-slate-900 font-extrabold">TOTAL COMPILATION</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalExpectedQty}</td>
                                      <td className="p-4 text-center font-mono text-slate-800">{totalDepletedQty}</td>
                                      <td className={`p-4 text-center font-mono font-extrabold ${totalQtyVariance < 0 ? 'text-rose-800' : totalQtyVariance > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                                        {totalQtyVariance > 0 ? '+' : ''}{totalQtyVariance}
                                      </td>
                                      <td className="p-4 text-right font-mono text-slate-800">₹{totalExpectedAmt.toFixed(2)}</td>
                                      <td className="p-4 text-right font-mono text-emerald-800">₹{totalCollectedAmt.toFixed(2)}</td>
                                      <td className={`p-4 text-right font-mono font-extrabold text-base ${totalFinVariance < 0 ? 'text-red-800' : totalFinVariance > 0 ? 'text-emerald-800' : 'text-indigo-900'}`}>
                                        {totalFinVariance > 0 ? '+' : ''}₹{totalFinVariance.toFixed(2)}
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            }
            {/* Reconciliation Tab */}
            {
              showExtraReport && activeTab === 'reconciliation' && (
                <div className="space-y-6">
                  <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-100 mb-6">
                    <h3 className="text-xl font-bold text-emerald-900 mb-2">Reconciliation & Advanced Analytics</h3>
                    <p className="text-emerald-700 text-sm">
                      Access the master event settlement and granular 3-way match reconciliation reports to analyze physical inventory depletion against POS financial data.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">Master Settlement</h3>
                      <p className="text-slate-500 text-sm mb-6 h-10">
                        Event-wide financial reconciliation comparing expected POS sales to actual cash dropped by shop.
                      </p>
                      <Link href="/reports/master-settlement" className="inline-flex w-full items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                        View Master Settlement
                      </Link>
                    </div>

                    <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                      <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-4">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">3-Way Match Drilldown</h3>
                      <p className="text-slate-500 text-sm mb-6 h-10">
                        Granular, item-by-item breakdown showing the exact variance between POS sales and physical stock.
                      </p>
                      <Link href="/reports/3-way-match" className="inline-flex w-full items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
                        View 3-Way Match
                      </Link>
                    </div>
                  </div>
                </div>
              )
            }

            {/* Live Operations Tab */}
            {
              showExtraReport && activeTab === 'live_operations' && (
                <div className="space-y-6">
                  <div className="bg-red-50 rounded-xl p-6 border border-red-100 mb-6">
                    <h3 className="text-xl font-bold text-red-900 mb-2">Live Operations & Security</h3>
                    <p className="text-red-700 text-sm">
                      Access real-time snapshots, live cashier tallies, operator trust scores, and shift handover protocols to maintain immediate visibility and security across all shops.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">Live Snapshot</h3>
                      <p className="text-slate-500 text-xs mb-4 flex-grow">
                        Real-time delta view comparing active inventory depletion against POS registered sales.
                      </p>
                      <Link href="/reports/live-snapshot" className="inline-flex w-full items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
                        View Snapshot
                      </Link>
                    </div>

                    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mb-4">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">Live Tally-Up</h3>
                      <p className="text-slate-500 text-xs mb-4 flex-grow">
                        Cashier terminal verification comparing expected cash-in-till vs inventory value depleted.
                      </p>
                      <Link href="/reports/live-tally" className="inline-flex w-full items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors">
                        View Tally
                      </Link>
                    </div>

                    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                      <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mb-4">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">Operator Trust Score</h3>
                      <p className="text-slate-500 text-xs mb-4 flex-grow">
                        Historical reliability index tracking variances for individual cashiers over time.
                      </p>
                      <Link href="/reports/trust-score" className="inline-flex w-full items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors">
                        View Trust Score
                      </Link>
                    </div>

                    <div className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col h-full">
                      <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center mb-4">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mb-2">Shift Handover</h3>
                      <p className="text-slate-500 text-xs mb-4 flex-grow">
                        Secure protocol to execute blind cash counts during cashier handovers.
                      </p>
                      <Link href="/reports/handover" className="inline-flex w-full items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-lg text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors">
                        Execute Handover
                      </Link>
                    </div>
                  </div>
                </div>
              )
            }
          </div >
        </div >
      </div >

      {/* Premium Reconciliation Modal */}
      {
        reconcileModalOpen && (
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
        )
      }
    </AppLayout >
  );
}