'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { logger } from '@/lib/logger';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { INVENTORY_ISSUE_KEYS } from '@/lib/pageInitKeys';

const inventoryLogger = {
  info: (message: string, data?: any) => logger.info('INVENTORY', message, data),
  warn: (message: string, data?: any) => logger.warn('INVENTORY', message, data),
  error: (message: string, data?: any) => logger.error('INVENTORY', message, data),
  debug: (message: string, data?: any) => logger.debug('INVENTORY', message, data),
};

export { inventoryLogger };

// ── Types ──
export interface Category {
  id: number;
  name: string;
  description?: string;
  [key: string]: any;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  categoryId: number;
  mrp: number;
  sellingPrice: number;
  discount?: number;
  description?: string;
  minThreshold?: number;
  /** Whether the product is available for sale — controls visibility on the POS Sales page. */
  isActive?: boolean;
  [key: string]: any;
}

export interface Stock {
  id: number;
  productId: number;
  quantity: number;
  minQuantity?: number;
  [key: string]: any;
}

export interface Shop {
  id: number;
  shopName: string;
  counterNumber: number;
  categoryId?: number;
  [key: string]: any;
}

export interface User {
  id: number;
  username: string;
  [key: string]: any;
}

export interface SalesRecord {
  id?: number;
  productId: number;
  shopId: string;
  sellerUser: string;
  quantity: number;
  initialQuantity?: number;
  liveQuantity?: number;
  createdAt?: string;
  saleDate?: string;
  [key: string]: any;
}

export interface SoldAnalytic {
  productId: string;
  shopId: string;
  totalSold?: number;
  total_sold?: number;
  [key: string]: any;
}

// ── Context Value Type ──
interface InventoryContextValue {
  // Master data
  categories: Category[];
  products: Product[];
  stocks: Stock[];
  shops: Shop[];
  users: User[];
  salesRecords: SalesRecord[];
  soldAnalytics: SoldAnalytic[];

  // Fetchers (allow child components to refresh data)
  fetchCategories: () => Promise<void>;
  fetchProducts: () => Promise<void>;
  fetchStocks: () => Promise<void>;
  fetchShops: () => Promise<void>;
  fetchUsers: () => Promise<void>;
  fetchSalesRecords: () => Promise<void>;
  fetchSoldAnalytics: () => Promise<void>;

  // Notification helpers
  showSuccess: (message: string) => void;
  showError: (message: string) => void;

  // Notification state (consumed by layout-level modals)
  successMessage: string;
  showSuccessModal: boolean;
  setShowSuccessModal: (v: boolean) => void;
  errorMessage: string;
  showErrorModal: boolean;
  setShowErrorModal: (v: boolean) => void;

  // User context
  isAdminUser: boolean;
  currentUsername: string;
  eventId: string | null;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}

// ── Provider ──
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { eventId } = useActiveEvent();

  // Master data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]);
  const [soldAnalytics, setSoldAnalytics] = useState<SoldAnalytic[]>([]);

  // Notifications
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);

  // User
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');

  // ── Page-init: single aggregated fetch (replaces 7 individual calls on mount) ──
  const fetchPageData = useCallback(async () => {
    if (!eventId) {
      inventoryLogger.debug('Skipping fetchPageData: eventId is null');
      setStocks([]);
      setSalesRecords([]);
      setShops([]);
      setSoldAnalytics([]);
      return;
    }
    inventoryLogger.info('Fetching page-init data (single aggregated call)');
    try {
      const include = INVENTORY_ISSUE_KEYS.join(',');
      const response = await apiClient.get(`/page-init?include=${include}`);
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Page-init data fetched successfully', { keys: Object.keys(data) });
        if (data.categories) setCategories(data.categories);
        if (data.products) setProducts(data.products);
        if (data.users) setUsers(Array.isArray(data.users) ? data.users : data.users?.data ?? []);
        if (data.stocks) setStocks(data.stocks);
        if (data.sales) setSalesRecords(data.sales);
        if (data.shops) setShops(Array.isArray(data.shops) ? data.shops : data.shops?.data ?? []);
        if (data.productShopSales) setSoldAnalytics(data.productShopSales);
      } else {
        inventoryLogger.error('Failed to fetch page-init data', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching page-init data', error);
    }
  }, [eventId]);

  // ── Individual fetchers (kept for on-demand child-component refreshes) ──
  const fetchCategories = useCallback(async () => {
    inventoryLogger.info('Fetching categories from API');
    try {
      const response = await apiClient.get('/categories');
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Categories fetched successfully', { count: data.data?.length || data.length });
        setCategories(data.data || data);
      } else {
        inventoryLogger.error('Failed to fetch categories', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching categories', error);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    inventoryLogger.info('Fetching products from API');
    try {
      const response = await apiClient.get('/products');
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Products fetched successfully', { count: data.data?.length || data.length });
        setProducts(data.data || data);
      } else {
        inventoryLogger.error('Failed to fetch products', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching products', error);
    }
  }, []);

  const fetchStocks = useCallback(async () => {
    if (!eventId) {
      inventoryLogger.debug('Skipping fetchStocks: eventId is null');
      return;
    }
    inventoryLogger.info('Fetching stocks from API');
    try {
      const response = await apiClient.get('/inventory/stocks');
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Stocks fetched successfully', { count: data.data?.length || data.length });
        setStocks(data.data || data);
      } else {
        inventoryLogger.error('Failed to fetch stocks', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching stocks', error);
    }
  }, [eventId]);

  const fetchShops = useCallback(async () => {
    if (!eventId) {
      inventoryLogger.debug('Skipping fetchShops: eventId is null');
      return;
    }
    inventoryLogger.info('Fetching shops from API');
    try {
      const response = await apiClient.get('/shops');
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Shops fetched successfully', { count: data.data?.length || data.length });
        setShops(data.data || data);
      } else {
        inventoryLogger.error('Failed to fetch shops', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching shops', error);
    }
  }, [eventId]);

  const fetchUsers = useCallback(async () => {
    inventoryLogger.info('Fetching users from API');
    try {
      const response = await apiClient.get('/users/allUsers');
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Users fetched successfully', { count: data.data?.length || data.length });
        setUsers(data.data || data);
      } else {
        inventoryLogger.error('Failed to fetch users', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching users', error);
    }
  }, []);

  const fetchSalesRecords = useCallback(async () => {
    if (!eventId) {
      inventoryLogger.debug('Skipping fetchSalesRecords: eventId is null');
      return;
    }
    inventoryLogger.info('Fetching sales records from API');
    try {
      const response = await apiClient.get('/inventory/sales');
      if (response.ok) {
        const data = await response.json();
        inventoryLogger.info('Sales records fetched successfully', { count: data.data?.length || data.length });
        setSalesRecords(data.data || data);
      } else {
        inventoryLogger.error('Failed to fetch sales records', { status: response.status });
      }
    } catch (error) {
      inventoryLogger.error('Error fetching sales records', error);
    }
  }, [eventId]);

  const fetchSoldAnalytics = useCallback(async () => {
    if (!eventId) {
      inventoryLogger.debug('Skipping fetchSoldAnalytics: eventId is null');
      return;
    }
    try {
      const response = await apiClient.get('/sales/retail/analytics/product-shop-sales');
      if (response.ok) {
        const data = await response.json();
        setSoldAnalytics(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      inventoryLogger.error('Error fetching sold analytics', error);
    }
  }, [eventId]);

  // ── Notification helpers ──
  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setShowSuccessModal(true);
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  }, []);

  // ── Initial fetch — single aggregated call ──
  useEffect(() => {
    inventoryLogger.info('Initializing inventory data via page-init (eventId: ' + eventId + ')');
    fetchPageData();

    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');
    setIsAdminUser((userRole || '').toUpperCase() === 'ADMIN');
    setCurrentUsername(username || '');
  }, [eventId, fetchPageData]);

  const value: InventoryContextValue = {
    categories,
    products,
    stocks,
    shops,
    users,
    salesRecords,
    soldAnalytics,
    fetchCategories,
    fetchProducts,
    fetchStocks,
    fetchShops,
    fetchUsers,
    fetchSalesRecords,
    fetchSoldAnalytics,
    showSuccess,
    showError,
    successMessage,
    showSuccessModal,
    setShowSuccessModal,
    errorMessage,
    showErrorModal,
    setShowErrorModal,
    isAdminUser,
    currentUsername,
    eventId,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}
