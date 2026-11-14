'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { buildBillSmsMessage, openSmsApp } from '@/lib/smsUtils';
import { hasNoValidItems, validateSaleForm } from './helpers/saleValidation';
import { useRouter, useSearchParams } from 'next/navigation';

import AppLayout from '@/components/layout/AppLayout';
import { BasketModal } from './components/BasketModal';
import { CancelReturnTab } from './components/CancelReturnTab';
import { CatalogTab } from './components/CatalogTab';
import { FeedbackModals } from './components/FeedbackModals';
import { MobileProductSearch } from './components/MobileProductSearch';
import { MuiSelect } from '@/components/ui/MuiSelect';
import { PaymentSection } from './components/PaymentSection';
import { SaleHeaderBanner } from './components/SaleHeaderBanner';
import { SaleItemRow } from './components/SaleItemRow';
import { SalePreviewModal } from './components/SalePreviewModal';
import { SaleSuccessSnackbar } from './components/SaleSuccessSnackbar';
import { SaleTabs } from './components/SaleTabs';
import { apiClient } from '@/lib/api';
import { generateUUID } from '@/lib/uuid';
import { getUserReceivingPrintPreference } from '@/lib/userPrintPreference';
import { logger } from '@/lib/logger';
import { printBillSmart } from '@/lib/centralPrint';
import { printDocuments } from '@/lib/printService';
import { resolveShopInfo } from '@/lib/resolveShopInfo';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { useCancelReturn } from './hooks/useCancelReturn';
import { useEventConfig } from '@/hooks/useEventConfig';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { useProductSearch } from './hooks/useProductSearch';
import { useRecentSold } from './hooks/useRecentSold';
import { recordRecent } from './helpers/recentSold';
import { useSaleForm } from './hooks/useSaleForm';
import { useShop } from '@/hooks/useShop';
import { useShopCatalog } from '@/app/sales/hooks/useShopCatalog';
import { useShopSetup } from './hooks/useShopSetup';

function SalesContent() {
  const { eventId, eventName } = useActiveEvent();
  const { receiptConfig, isFetched: configFetched } = useEventConfig();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { assignedShops, loading: shopsLoading, isAdmin, refreshShops } = useShop();

  const [activeTab, setActiveTab] = useState<'sale' | 'catalog' | 'cancel'>('sale');
  const [products, setProducts] = useState<any[]>([]);
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [isShopLocked, setIsShopLocked] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // Pay & Print already prints as part of that action — show a brief auto-dismissing
  // snackbar instead of the full success modal. Plain Checkout still always shows the modal.
  const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [errorRedirect, setErrorRedirect] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [billData, setBillData] = useState<any>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState<string>('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState<number | null>(null);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  const form = useSaleForm();

  // ── Basket state ──────────────────────────────────────────────────────────
  const [basketItems, setBasketItems] = useState<Record<string, { product: any; qty: number }>>({});
  const [showBasketModal, setShowBasketModal] = useState(false);

  // Load basket from sessionStorage whenever shopId changes (each shop has its own basket)
  useEffect(() => {
    const shopId = form.saleData.shopId;
    if (!shopId || shopId === 'ALL') {
      setBasketItems({});
      return;
    }
    try {
      const stored = sessionStorage.getItem(`basket_${shopId}`);
      setBasketItems(stored ? JSON.parse(stored) : {});
    } catch {
      setBasketItems({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.saleData.shopId]);

  // Persist basket to sessionStorage on every change
  useEffect(() => {
    const shopId = form.saleData.shopId;
    if (!shopId || shopId === 'ALL') return;
    const key = `basket_${shopId}`;
    if (Object.keys(basketItems).length === 0) {
      sessionStorage.removeItem(key);
    } else {
      try {
        sessionStorage.setItem(key, JSON.stringify(basketItems));
      } catch {
        // sessionStorage quota exceeded — fail silently
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basketItems]);

  const addToBasket = (product: any) => {
    const id = product.id.toString();
    setBasketItems(prev => {
      const current = prev[id]?.qty || 0;
      const maxStock = product.shopStock || 0;
      if (current >= maxStock) return prev; // cap at stock
      return { ...prev, [id]: { product, qty: current + 1 } };
    });
  };

  const removeFromBasket = (productId: string) => {
    setBasketItems(prev => {
      const current = prev[productId]?.qty || 0;
      if (current <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: { ...prev[productId], qty: current - 1 } };
    });
  };

  const clearBasket = () => setBasketItems({});

  const basketCount = Object.values(basketItems).reduce((sum, b) => sum + b.qty, 0);

  // Checkout: map basket → sale items, switch to Sale tab
  const handleBasketCheckout = () => {
    const items = Object.values(basketItems);
    if (items.length === 0) return;

    const newItems = items.map(({ product, qty }) => ({
      productId: product.id.toString(),
      productName: product.name,
      productSku: product.sku || '',
      quantity: qty.toString(),
      mrp: product.mrp?.toString() || '',
      sellingPrice: product.sellingPrice?.toString() || '',
      discount: product.discount?.toString() || '',
    }));

    const newSearches = items.map(({ product }) => product.name);

    form.setSaleData((prev: any) => ({
      ...prev,
      customerName: '',
      customerMobile: '',
      items: newItems,
    }));
    form.setProductSearches(newSearches);
    form.setShowProductDropdowns(new Array(newItems.length).fill(false));
    // Keep selectedIndices and dropdownOpenUpwards in sync with item count
    // so keyboard navigation and dropdown direction don't break after checkout
    form.setSelectedIndices(new Array(newItems.length).fill(-1));
    form.setDropdownOpenUpwards(new Array(newItems.length).fill(false));

    clearBasket();
    setShowBasketModal(false);
    setActiveTab('sale');
  };

  // Keep a ref to form.addItem to avoid stale closures in the global keyboard listener
  const addItemRef = useRef(form.addItem);
  addItemRef.current = form.addItem;

  // ── CASH auto-fill ────────────────────────────────────────────────────────
  // Keep cashReceived in sync with the running total while paymentMode is CASH.
  // Rules:
  //   1. Empty or was previously auto-filled → always update to new total.
  //   2. Cashier manually entered an amount that can NO LONGER cover the new total
  //      (e.g. total grew past their entry) → reset to new total so they know.
  //   3. Cashier manually entered an amount >= new total (e.g. ₹500 note, total ₹250)
  //      → keep their entry; the change display updates automatically.
  const prevCashAutoFill = useRef<string>('');
  const currentTotal = form.calculateTotal();
  useEffect(() => {
    if (form.saleData.paymentMode !== 'CASH') return;
    const { cashReceived } = form.saleData;
    const shouldUpdate =
      cashReceived === '' ||
      cashReceived === prevCashAutoFill.current ||
      parseFloat(cashReceived) < parseFloat(currentTotal); // manual entry can't cover new total
    if (shouldUpdate) {
      prevCashAutoFill.current = currentTotal;
      form.setSaleData((prev: any) => ({ ...prev, cashReceived: currentTotal }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTotal, form.saleData.paymentMode]);

  // Bug B fix: extracted as a reusable function so it can be called both on shop-change
  // and after a successful sale (stale invoice number was shown after checkout).
  const fetchNextInvoiceNumber = async (shopId: string) => {
    if (!shopId || shopId === 'ALL') { setNextInvoiceNumber(''); return; }
    try {
      const resp = await apiClient.get(`/invoice/next-number?shopId=${shopId}`);
      if (resp.ok) {
        const data = await resp.json();
        setNextInvoiceNumber(data.nextInvoiceNumber || '');
      }
    } catch (e) {
      logger.error('SALES_PAGE', 'Failed to fetch next invoice number', e);
    }
  };

  const cancelReturn = useCancelReturn();
  const isMobile = useIsMobile();

  const fetchProducts = async () => {
    try {
      const response = await apiClient.get('/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data.data || data);
      }
    } catch (error) {
      logger.error('SALES_PAGE', 'Error fetching global catalog', error);
    }
  };

  // ── Unified catalog hook (Option B) ──────────────────────────────────────
  // refreshCatalog calls GET /api/sales/retail/catalog/{shopId} which resolves
  // products, stocks, and the next invoice number in ONE backend request.
  // It is passed down to useShopSetup so shop-change also uses the single endpoint.
  const { refreshCatalog } = useShopCatalog({
    shopId: form.saleData.shopId,
    setProducts,
    setShopProducts,
    setNextInvoiceNumber,
  });

  useShopSetup({
    saleData: form.saleData,
    setSaleData: form.setSaleData,
    assignedShops, shopsLoading, isAdmin,
    setShopProducts,
    setErrorMessage, setErrorRedirect, setShowErrorModal,
    refreshShops, refreshCatalog, eventId, setIsShopLocked
  });

  const recentCounts = useRecentSold(form.saleData.shopId);
  const { getFilteredProducts, handleKeyDown } = useProductSearch(
    shopProducts, products, form.saleData,
    form.productSearches, form.selectedIndices,
    form.setSelectedIndices, form.showProductDropdowns, form.setShowProductDropdowns,
    recentCounts
  );

  const {
    handleBackspaceNavigation,
    handleFormKeyDown,
    handleQuantityKeyDown,
    handleAddItemKeyDown,
    handleDeleteRowShortcut,
    handlePrintButtonKeyDown,
    handleCashReceivedKeyDown,
    handleOnlineRefKeyDown,
    handleBothOnlineRefKeyDown,
    handleCustomerNameShiftTab,
    handleProductRowShiftTab,
  } = useKeyboardNavigation(form.saleData, form.addItem);

  // URL Query Interceptor
  useEffect(() => {
    const tab = searchParams.get('tab');
    const orderNo = searchParams.get('orderNo');
    const invoiceNo = searchParams.get('invoiceNo');
    if (tab === 'cancel') {
      setActiveTab('cancel');
      if (orderNo) cancelReturn.setCancelOrderNo(orderNo);
      if (invoiceNo) cancelReturn.setCancelInvoiceNo(invoiceNo);
      // Deep-linked from Billing page's Edit action — fire the lookup automatically
      // instead of making the user click "Look Up Bill" themselves.
      if (orderNo || invoiceNo) cancelReturn.setTriggerAutoLookup(true);
    }
  }, [searchParams, cancelReturn.setCancelInvoiceNo, cancelReturn.setCancelOrderNo, cancelReturn.setTriggerAutoLookup]);

  // Fullscreen Sync
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Thermal print fallback notification — shows when ESC/POS fails and browser dialog opens
  useEffect(() => {
    const handleThermalFallback = (e: Event) => {
      const reason = (e as CustomEvent<{ reason: string }>).detail?.reason ?? 'Unknown error';
      setErrorMessage(`Thermal print failed — switching to browser print dialog.\n\nReason: ${reason}\n\nCheck Printer Settings to fix the connection.`);
      setShowErrorModal(true);
    };
    window.addEventListener('thermalPrintFallback', handleThermalFallback);
    return () => window.removeEventListener('thermalPrintFallback', handleThermalFallback);
  }, []);

  // Global Alt+R shortcut — e.code is physical key, works on macOS (Option+R gives '®' in e.key)
  // Saves focused input value before keydown; if macOS IME still inserts a character,
  // the 'input' capture listener immediately restores the saved value via React's native setter.
  useEffect(() => {
    let savedEl: HTMLInputElement | HTMLTextAreaElement | null = null;
    let savedVal = '';

    const handleGlobalKey = (e: KeyboardEvent) => {
      // Ctrl+N / Cmd+N / F2 — Add Item (globally accessible POS shortcut)
      if (((e.ctrlKey || e.metaKey) && (e.code === 'KeyN' || e.key.toLowerCase() === 'n')) || e.key === 'F2') {
        e.preventDefault();
        e.stopImmediatePropagation();
        addItemRef.current();
        return;
      }

      // Ctrl+F / Cmd+F — toggle fullscreen (overrides browser find-in-page on the sales screen)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleFullscreen();
        return;
      }

      // Alt+P — Preview
      if (e.altKey && e.code === 'KeyP') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlePreviewClickRef.current();
        return;
      }

      // Alt+Shift+Enter — Pay & Print (submit sale and trigger receipt print)
      // e.code is used so the physical Enter key is matched regardless of OS locale.
      if (e.altKey && e.shiftKey && e.code === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        handlePayAndPrintRef.current();
        return;
      }

      if (e.altKey && e.code === 'KeyR') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          savedEl = el;
          savedVal = el.value;
        }
        handleRefreshStock();
      }
    };

    const handleInput = (e: Event) => {
      if (savedEl && e.target === savedEl) {
        // A character slipped through — restore the value React-compatibly
        const proto = savedEl instanceof HTMLTextAreaElement
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(savedEl, savedVal);
          savedEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        savedEl = null;
      }
    };

    document.addEventListener('keydown', handleGlobalKey, { capture: true });
    document.addEventListener('input', handleInput, { capture: true });
    return () => {
      document.removeEventListener('keydown', handleGlobalKey, { capture: true });
      document.removeEventListener('input', handleInput, { capture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRefreshing]);

  const handleRefreshStock = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const CatalogShopproduct = refreshCatalog();
      await CatalogShopproduct;
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err =>
        logger.warn('SALES_PAGE', `Error enabling fullscreen: ${err.message}`)
      );
      // Once the browser enters fullscreen the shop button gets tabIndex=-1.
      // Focus Customer Name so the user can start typing immediately.
      setTimeout(() => {
        const customerNameInput = document.querySelector<HTMLInputElement>('input[name="customerName"]');
        if (customerNameInput) customerNameInput.focus();
      }, 150);
    } else {
      document.exitFullscreen?.();
    }
  };

  useEffect(() => {
    if (mobileSearchOpen !== null) {
      const timer = setTimeout(() => {
        mobileSearchInputRef.current?.focus();
        mobileSearchInputRef.current?.select();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [mobileSearchOpen]);

  const closeMobileSearch = () => {
    if (mobileSearchOpen !== null) {
      form.setProductSearches(prev => {
        const copy = [...prev];
        copy[mobileSearchOpen] = form.saleData.items[mobileSearchOpen]?.productName || '';
        return copy;
      });
      setMobileSearchOpen(null);
    }
  };

  const handlePreviewClick = () => {
    const formEl = document.querySelector('form');
    if (formEl && !formEl.checkValidity()) { formEl.reportValidity(); return; }
    if (!validateSaleForm(form.saleData, setErrorMessage, setShowErrorModal)) return;
    setShowPreviewModal(true);
  };

  // Keep a ref to handlePreviewClick to avoid stale closures in the global keyboard listener
  const handlePreviewClickRef = useRef(handlePreviewClick);
  handlePreviewClickRef.current = handlePreviewClick;

  // Ref for Alt+Shift+Enter shortcut — triggers Pay & Print without a stale closure
  const handlePayAndPrintRef = useRef(() => { });
  // (assigned after handleSubmit is defined below)

  const handleSubmit = async (e: React.FormEvent | null, printFlag = false, smsFlag = false) => {
    if (e) e.preventDefault();
    if (!validateSaleForm(form.saleData, setErrorMessage, setShowErrorModal)) return;

    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      const total = parseFloat(form.calculateTotal());
      const shopId = form.saleData.shopId;

      // ── sessionStorage idempotency key ────────────────────────────────────
      // Persist the order number BEFORE the network call so that if the tab
      // crashes mid-flight the same orderNumber is reused on the next attempt.
      // The backend's INSERT IGNORE + UNIQUE(order_number) makes this safe.
      const storageKey = `pending_order_${shopId}`;
      let pendingOrderNumber = sessionStorage.getItem(storageKey);
      if (!pendingOrderNumber) {
        pendingOrderNumber = `SO-${generateUUID()}`;
        sessionStorage.setItem(storageKey, pendingOrderNumber);
      }

      const payload: any = {
        orderNumber: pendingOrderNumber,
        shopId: parseInt(shopId),
        customerName: form.saleData.customerName,
        customerMobile: form.saleData.customerMobile,
        items: form.saleData.items
          .filter((item: any) => item.productId)
          .map((item: any) => ({
            productId: parseInt(item.productId),
            productName: item.productName,
            productSku: item.productSku || '',
            quantity: parseInt(item.quantity),
            mrp: parseFloat(item.mrp),
            sellingPrice: parseFloat(item.sellingPrice),
            discount: parseFloat(item.discount) || 0
          })),
        paymentMode: form.saleData.paymentMode,
        amount: total
      };

      if (form.saleData.paymentMode === 'CASH') {
        const received = parseFloat(form.saleData.cashReceived) || total;
        payload.cashReceived = received;
        payload.changeGiven = Math.max(0, received - total);
      } else if (form.saleData.paymentMode === 'ONLINE') {
        payload.paymentReference = form.saleData.paymentReference;
      } else if (form.saleData.paymentMode === 'BOTH') {
        payload.cashAmount = parseFloat(form.saleData.cashAmount) || 0;
        payload.onlineAmount = parseFloat(form.saleData.onlineAmount) || 0;
        payload.paymentReference = form.saleData.paymentReference;
      }

      const response = await apiClient.post('/sales/retail/complete', payload, {
        'X-Idempotency-Key': pendingOrderNumber,
      });
      if (response.ok) {
        // Success — clear the pending key so the next sale gets a fresh order number
        sessionStorage.removeItem(storageKey);

        // CompleteSaleResponse: { order, stocks, nextInvoiceNumber }
        // Backward-compat: if backend hasn't deployed yet, result is a plain SalesOrder
        const result = await response.json();
        const billResult = result.order ?? result;

        // Count this sale in "Recent" (local now, server in background). Never blocks the sale.
        try {
          const sold: Record<string, number> = {};
          for (const it of form.saleData.items as any[]) {
            const q = Number(it.quantity) || 0;
            if (it.productId && q > 0) sold[String(it.productId)] = (sold[String(it.productId)] ?? 0) + q;
          }
          void recordRecent(form.saleData.shopId, sold);
        } catch { /* ignore */ }
        const updatedStocks: any[] = result.stocks ?? [];
        const updatedInvoiceNo: string = result.nextInvoiceNumber ?? '';

        // Snapshot payment from form.saleData NOW — before resetForm() clears it.
        // SalesOrder (billResult) has no payment fields; they live in sales_payment table.
        // Backend now echoes them in CompleteSaleResponse; form-data is the backward-compat fallback.
        const resolvedShopId = billResult.shopId ?? form.saleData.shopId;
        const paymentSnapshot = {
          paymentMode: billResult.paymentMode ?? form.saleData.paymentMode,
          cashReceived: billResult.cashReceived ?? (parseFloat(form.saleData.cashReceived) || 0),
          cashAmount: billResult.cashAmount ?? (parseFloat(form.saleData.cashAmount) || 0),
          onlineAmount: billResult.onlineAmount ?? (parseFloat(form.saleData.onlineAmount) || 0),
          paymentReference: billResult.paymentReference ?? (form.saleData.paymentReference ?? ''),
          // changeGiven = backend field name; change = legacy printBill field name
          change: billResult.changeGiven ?? (billResult.change ?? 0),
        };
        // Merge payment into the bill so the success-modal reprint button also has correct data
        const billForPrint = { ...billResult, ...paymentSnapshot };


        setReceiptData(billForPrint);
        setBillData(billForPrint);
        setSuccessMessage('Sale completed successfully!');
        // Pay & Print / Pay & SMS (printFlag/smsFlag) already act on the bill below —
        // a full "acknowledge the sale" modal is redundant there, so show the lighter
        // snackbar instead. Plain Checkout (neither flag) always gets the full modal.
        if (printFlag || smsFlag) {
          setShowSuccessSnackbar(true);
        } else {
          setShowSuccessModal(true);
        }
        if (smsFlag) {
          // Android-only action (button is gated at the PaymentSection level) — opens
          // the default SMS app with the bill summary, pre-filling the customer's
          // number when we have it on the order.
          const { shopName: smsShopName } = resolveShopInfo(resolvedShopId, assignedShops);
          openSmsApp(billForPrint.customerMobile, buildBillSmsMessage(billForPrint, smsShopName));
        }
        if (printFlag) {
          if (!configFetched) {
            console.warn('[PRINT] ⚠ event config not yet loaded at sale-completion — receipt may use default charsPerLine');
          }
          const { shopName, orgName, counterNumber } = resolveShopInfo(resolvedShopId, assignedShops);
          const currentShop = assignedShops.find(s => String(s.id) === String(resolvedShopId));
          console.log('[PRINT] auto-print on sale complete — configFetched=%s charsPerLine=%s',
            configFetched, receiptConfig?.thermalConfig?.charsPerLine ?? '(missing → default 32)');
          // Single entry point: prints the bill, and the receiving slip too when both gates pass.
          // Same route (central queue vs local) is chosen for both. Never breaks the post-sale flow.
          try {
            const username = typeof window !== 'undefined' ? localStorage.getItem('username') : null;
            const userReceivingPrintEnabled = getUserReceivingPrintPreference(username, resolvedShopId);
            await printDocuments(billForPrint, {
              shopName,
              orgName,
              counterNumber,
              eventName: eventName || undefined,
              config: receiptConfig,
              shop: currentShop ?? {},
              userReceivingPrintEnabled,
              isReprint: false,
              receivingAlreadyPrinted: (billForPrint as any).receivingPrinted,
            });
          } catch (e: any) {
            setSuccessMessage(`Sale completed, but print failed: ${e?.message || e}`);
          }
        }
        form.resetForm(shopId);

        // Update stocks and next invoice from consolidated response — no extra API calls.
        // Zero/negative-stock items are kept, not filtered — see useShopCatalog.ts.
        if (updatedStocks.length > 0) {
          setShopProducts(updatedStocks);
        }

        // Apply next invoice from completeSale response if present; otherwise refresh catalog
        // (one call covers stocks + products + invoice — replaces two separate fetches).
        if (updatedInvoiceNo) {
          setNextInvoiceNumber(updatedInvoiceNo);
          // If stocks were missing from the response too, run a background catalog refresh.
          if (updatedStocks.length === 0) {
            refreshCatalog();
          }
        } else {
          // No invoice in response — full catalog refresh as a safety net.
          refreshCatalog();
        }


        // NOTE: do NOT focus customerMobile here — FeedbackModals auto-focuses the Done
        // button at t=60ms. Focusing mobile at t=150ms would steal focus from the modal.
      } else {
        const err = await response.json().catch(() => ({}));
        // Map INSUFFICIENT_STOCK error code to a friendly message
        let rawMsg: string = typeof err.message === 'string' ? err.message : '';
        // Defensive: if the backend ever sends an embedded JSON body, unwrap its message.
        if (rawMsg.trim().startsWith('{')) {
          try {
            const inner = JSON.parse(rawMsg);
            rawMsg = inner.errorCode === 'INSUFFICIENT_STOCK' ? 'Inventory out of stock' : (inner.message || '');
          } catch { /* keep rawMsg */ }
        }
        if (/insufficient stock/i.test(rawMsg)) rawMsg = 'Inventory out of stock';
        const msg = err.errorCode === 'INSUFFICIENT_STOCK'
          ? 'Inventory out of stock'
          : (rawMsg || 'Failed to process sale.');
        setErrorMessage(msg);
        setShowErrorModal(true);
        // NOTE: keep sessionStorage key so the same orderNumber is reused on retry
      }
    } catch (error) {
      logger.error('SALES_PAGE', 'Submit error', error);
      setErrorMessage('Network error. Please try again.');
      setShowErrorModal(true);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Wire the Pay & Print ref now that handleSubmit is defined.
  // Must be outside useEffect so it updates every render (same pattern as handlePreviewClickRef).
  handlePayAndPrintRef.current = () => handleSubmit(null, true);

  // ── Allowed tabIndex values in the navigation sequence ──
  // ✅ FIX: Memoise this as a plain constant inside the render — it does NOT need to be
  // a useCallback. We only call it inside the onKeyDown handler which already re-creates
  // its closure on each render; making it a separate function adds no value.
  const getAllowedTabIndices = (): number[] => {
    const rowIndices = Array.from(
      { length: form.saleData.items.length },
      (_, i) => [10 + i * 3, 11 + i * 3, 12 + i * 3]   // product, qty, remove
    ).flat();
    // In fullscreen the shop (tabIndex=1) is set to -1 and skipped; sequence starts at 2.
    // In normal mode shop is tabIndex=1 and is the first stop.
    const baseIndices = isFullscreen ? [2, 3] : [1, 2, 3];
    // BOTH mode has 3 payment inputs (54 cash, 55 online-amount, 56 online-ref).
    // CASH/ONLINE only have one editable input (54). Keeping the list mode-aware
    // ensures the active trap jumps directly to 60 (Preview) after the last
    // payment input instead of trying to focus a non-existent tabIndex 55/56.
    const payInputs = form.saleData.paymentMode === 'BOTH' ? [54, 55, 56] : [54];
    return [...baseIndices, ...rowIndices, 50, 51, 52, 53, ...payInputs, 60, 61, 62];
  };

  return (
    <AppLayout hideNav={isFullscreen}>
      <div className="min-h-full flex flex-col px-2 sm:px-4 pb-2 sm:pb-4 pt-0 animate-fade-in-up">
        <SaleHeaderBanner
          shopId={form.saleData.shopId}
          assignedShops={assignedShops}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          isMobile={isMobile}
          nextInvoiceNumber={nextInvoiceNumber}
          onRefresh={handleRefreshStock}
          isRefreshing={isRefreshing}
          basketCount={activeTab === 'catalog' ? basketCount : 0}
          onOpenBasket={activeTab === 'catalog' ? () => setShowBasketModal(true) : undefined}
        />
        <div className="bg-white rounded-xl shadow-lg border border-sky-100 flex flex-col">
          <SaleTabs activeTab={activeTab} onTabChange={setActiveTab} isMobile={isMobile} />
          <div className="p-2 sm:p-4">

            {/* ── Tab 1: Sale ── */}
            {activeTab === 'sale' && (
              <div className={`flex flex-col pr-1 ${isFullscreen ? 'pb-4' : 'pb-24 sm:pb-0'}`}>
                <div className="mb-1 sm:mb-2 hidden sm:block">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowShortcuts(prev => !prev)}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <span>Keyboard Shortcuts</span>
                    <span>{showShortcuts ? '▲' : '▼'}</span>
                  </button>
                  {showShortcuts && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg p-2 mt-1">
                      <span><kbd className="bg-blue-200 px-1 rounded">Ctrl+N</kbd> Add Item</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Shift+↵</kbd> Checkout</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Alt+P</kbd> Preview</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Alt+R</kbd> Refresh Stock</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Ctrl+F</kbd> Fullscreen</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">↑↓</kbd> Navigate</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Enter</kbd> Select</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Tab</kbd> Next field</span>
                      <span><kbd className="bg-blue-200 px-1 rounded">Shift+Tab</kbd> Prev field</span>
                    </div>
                  )}
                </div>

                {/*
                  ────────────────────────────────────────────────────────────────
                  FORM — Tab trap is applied here.
                  ✅ FIX: The Tab trap now correctly exempts elements with tabIndex
                  that is -1 (i.e., those not in the allowed list) by checking the
                  activeElement's tabindex attribute. Elements that don't have a
                  tabindex attribute at all (tabIndex=0 by default) are also caught
                  and prevented from stealing focus.
                  ────────────────────────────────────────────────────────────────
                */}
                <form
                  onSubmit={handleSubmit}
                  onKeyDown={(e) => {
                    handleFormKeyDown(e, handlePreviewClick);

                    // ── Shift+Enter → Checkout (if enabled) ─────────────────────
                    // Mirrors the exact disabled condition of the Checkout button so
                    // the shortcut only fires when the button would also be clickable.
                    if (e.shiftKey && e.key === 'Enter') {
                      // hasStockOverdraft is no longer a blocking condition — overselling past
                      // counter stock is allowed (capped server-side by warehouse reserve).
                      const canCheckout =
                        !isSubmitting &&
                        form.isPaymentValid() &&
                        !hasNoValidItems(form.saleData);
                      if (canCheckout) {
                        e.preventDefault();
                        handleSubmit(null, false);
                      }
                    }

                    // ── Active Tab trap ──────────────────────────────────────────
                    // Manually jumps to the next/prev element in the allowed sequence,
                    // skipping disabled buttons. This fixes two bugs:
                    //   1. Passive trap couldn't move focus — it only blocked Tab from
                    //      leaving non-allowed elements but never moved it forward.
                    //   2. Element-level handlers (handleCashReceivedKeyDown etc.) called
                    //      e.preventDefault() then .focus(previewBtn) — but disabled
                    //      buttons silently ignore .focus(), leaving focus stuck forever.
                    // Checks !e.defaultPrevented so element-level handlers (quantity→addItem,
                    // print→point1, addItem→CASH expand) still take priority when they fire.
                    if (e.key === 'Tab' && !e.defaultPrevented) {
                      const allowed = getAllowedTabIndices(); // ascending order
                      const active = document.activeElement as HTMLElement | null;
                      const tabIndexAttr = active?.getAttribute('tabindex');
                      if (tabIndexAttr !== null) {
                        const currentIdx = parseInt(tabIndexAttr, 10);
                        const pos = allowed.indexOf(currentIdx);
                        if (pos === -1) {
                          // Outside our sequence — block Tab to keep focus inside the form
                          e.preventDefault();
                        } else if (!e.shiftKey) {
                          // Forward: walk ahead in the sequence, skip disabled buttons.
                          for (let i = pos + 1; i < allowed.length; i++) {
                            const el = document.querySelector<HTMLElement>(`[tabindex="${allowed[i]}"]`);
                            if (el && !(el as HTMLButtonElement).disabled) {
                              e.preventDefault();
                              el.focus();
                              return;
                            }
                          }
                          // ── WRAP-AROUND ──────────────────────────────────────────────
                          // No enabled element found ahead of the current position.
                          // The most common cause: all three action buttons (Preview/
                          // Checkout/Print at tabIndex 60-62) are disabled because there
                          // are no valid items yet or the payment isn't ready.
                          // Without this wrap, the loop exits with NO e.preventDefault(),
                          // the browser's native Tab fires, and focus escapes to the URL
                          // bar — causing the "Tab gets lost for 5-6 presses" bug.
                          for (let i = 0; i < pos; i++) {
                            const el = document.querySelector<HTMLElement>(`[tabindex="${allowed[i]}"]`);
                            if (el && !(el as HTMLButtonElement).disabled) {
                              e.preventDefault();
                              el.focus();
                              return;
                            }
                          }
                          // Absolute fallback — keep focus inside the form regardless.
                          e.preventDefault();
                        } else {
                          // Backward (Shift+Tab): walk back, skip disabled
                          for (let i = pos - 1; i >= 0; i--) {
                            const el = document.querySelector<HTMLElement>(`[tabindex="${allowed[i]}"]`);
                            if (el && !(el as HTMLButtonElement).disabled) {
                              e.preventDefault();
                              el.focus();
                              return;
                            }
                          }
                          // At first element: wrap backward to the last non-disabled element
                          // (mirrors the forward Print→Point1 loop, making Tab fully circular).
                          for (let i = allowed.length - 1; i > pos; i--) {
                            const el = document.querySelector<HTMLElement>(`[tabindex="${allowed[i]}"]`);
                            if (el && !(el as HTMLButtonElement).disabled) {
                              e.preventDefault();
                              el.focus();
                              return;
                            }
                          }
                          e.preventDefault(); // fallback: block escape
                        }
                      }
                    }
                  }}
                  className="flex flex-col space-y-4 mt-4"
                >
                  {/* ── Customer Details ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">

                    {/* Shop Select — tabIndex=1, wrapped with data-focusable for Print loop-back */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-1">
                      {/*
                        ✅ FIX: Add data-shop-locked attribute when isShopLocked is true.
                        focusPoint1() in useKeyboardNavigation reads this to decide whether
                        to focus shop or jump to customer name. This is more reliable than
                        querying disabled states inside the hook.
                      */}
                      <div
                        data-focusable="shop-select"
                        {...(isShopLocked ? { 'data-shop-locked': 'true' } : {})}
                      >
                        <MuiSelect
                          label="Shop"
                          value={form.saleData.shopId === 'ALL' ? '' : form.saleData.shopId}
                          onChange={(val) => form.resetForm(val)}
                          options={assignedShops.map(shop => ({
                            value: shop.id.toString(),
                            label: `${shop.shopName} - Counter ${shop.counterNumber}`,
                          }))}
                          disabled={isShopLocked}
                          required={true}
                          tabIndex={isFullscreen ? -1 : 1}
                        />
                      </div>
                    </div>

                    {/* Customer Name — tabIndex=2 */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-1 relative">
                      <div className="w-full relative transition-all duration-200 bg-transparent rounded-2xl border border-slate-200 hover:border-slate-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/15">
                        <span className="absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 text-slate-500 pointer-events-none select-none z-10">
                          Customer Name
                        </span>
                        <input
                          type="text"
                          name="customerName"
                          value={form.saleData.customerName}
                          onChange={(e) =>
                            form.setSaleData((prev: any) => ({ ...prev, customerName: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            // Shift+Tab on Customer Name → Shop
                            handleCustomerNameShiftTab(e);
                            handleBackspaceNavigation(e, 'customerName');
                          }}
                          className="w-full text-sm pl-4 pr-4 py-2.5 rounded-2xl bg-transparent text-slate-900 font-semibold focus:outline-none focus:ring-0 placeholder-transparent border-0"
                          placeholder="Customer Name"
                          tabIndex={2}
                        />
                      </div>
                    </div>

                    {/* Customer Mobile — tabIndex=3, optional but digits-only, exactly 10 chars */}
                    <div className="col-span-1 sm:col-span-2 md:col-span-1 relative">
                      {(() => {
                        const mob = form.saleData.customerMobile || '';
                        const hasError = mob.length > 0 && (!/^\d+$/.test(mob) || mob.length !== 10);
                        return (
                          <>
                            <div className={`w-full relative transition-all duration-200 bg-transparent rounded-2xl border hover:border-slate-400 focus-within:ring-2 ${hasError
                              ? 'border-red-400 focus-within:border-red-500 focus-within:ring-red-500/15'
                              : 'border-slate-200 focus-within:border-indigo-600 focus-within:ring-indigo-600/15'
                              }`}>
                              <span className={`absolute left-3 px-1 bg-white uppercase tracking-wider font-bold text-[10px] -top-2.5 pointer-events-none select-none z-10 ${hasError ? 'text-red-500' : 'text-slate-500'}`}>
                                Customer Mobile
                              </span>
                              <input
                                type="tel"
                                name="customerMobile"
                                value={mob}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  // Allow only digits; silently drop any non-digit character typed.
                                  // Still allows empty (field is optional).
                                  if (val === '' || /^\d+$/.test(val)) {
                                    // Cap at 10 digits
                                    if (val.length <= 10) {
                                      form.setSaleData((prev: any) => ({ ...prev, customerMobile: val }));
                                    }
                                  }
                                }}
                                onKeyDown={(e) => handleBackspaceNavigation(e, 'customerMobile')}
                                maxLength={10}
                                inputMode="numeric"
                                pattern="\d{10}"
                                className="w-full text-sm pl-4 pr-4 py-2.5 rounded-2xl bg-transparent text-slate-900 font-semibold focus:outline-none focus:ring-0 placeholder-transparent border-0"
                                placeholder="Customer Mobile"
                                tabIndex={3}
                              />
                            </div>
                            {hasError && (
                              <p className="text-[10px] text-red-500 font-semibold mt-1 pl-1">
                                {!/^\d+$/.test(mob) ? 'Digits only' : `${mob.length}/10 digits required`}
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ── Items List ── */}
                  <div className="flex flex-col">
                    <h4 className="text-xs sm:text-sm font-semibold mb-1 sm:mb-2">Items</h4>
                    <div className="pr-1 pb-4" data-items-scroll-container>
                      {form.saleData.items.map((item: any, index: number) => (
                        <SaleItemRow
                          key={index}
                          item={item}
                          index={index}
                          isMobile={isMobile}
                          saleData={form.saleData}
                          shopProducts={shopProducts}
                          isDropdownOpen={form.showProductDropdowns[index]}
                          productSearch={form.productSearches[index]}
                          selectedIdx={form.selectedIndices[index]}
                          getFilteredProducts={getFilteredProducts}
                          onSearchChange={(idx, val, el) => {
                            form.setProductSearches(prev => { const copy = [...prev]; copy[idx] = val; return copy; });
                            if (el) {
                              const rect = el.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              form.setDropdownOpenUpwards(prev => { const copy = [...prev]; copy[idx] = spaceBelow < 180; return copy; });
                            }
                            form.setShowProductDropdowns(prev => { const copy = [...prev]; copy[idx] = true; return copy; });
                            if (val === '') {
                              const newItems = [...form.saleData.items];
                              newItems[idx] = { ...newItems[idx], productId: '', productName: '', productSku: '', mrp: '', sellingPrice: '', discount: '' };
                              form.setSaleData({ ...form.saleData, items: newItems });
                            }
                          }}
                          onSelect={(idx, id) => {
                            const p = shopProducts.find(prod => prod.id.toString() === id) || products.find(prod => prod.id.toString() === id);
                            if (p) {
                              const newItems = [...form.saleData.items];
                              const desiredQty = (!newItems[idx].quantity || newItems[idx].quantity === '0') ? '1' : newItems[idx].quantity;
                              const stock = typeof p.shopStock === 'number' ? p.shopStock : null;
                              const quantity = stock !== null
                                ? Math.max(1, Math.min(parseInt(desiredQty) || 1, stock)).toString()
                                : desiredQty;
                              newItems[idx] = {
                                ...newItems[idx],
                                productId: p.id.toString(),
                                productName: p.name,
                                productSku: p.sku || '',
                                quantity,
                                mrp: p.mrp?.toString() || '',
                                sellingPrice: p.sellingPrice?.toString() || '',
                                discount: p.discount?.toString() || ''
                              };
                              form.setSaleData({ ...form.saleData, items: newItems });
                              form.setProductSearches(prev => { const copy = [...prev]; copy[idx] = p.name; return copy; });
                              form.setShowProductDropdowns(prev => { const copy = [...prev]; copy[idx] = false; return copy; });
                              form.setQtyPristine(prev => { const copy = [...prev]; copy[idx] = true; return copy; });
                            }
                          }}
                          onRemove={form.removeItem}
                          onUpdate={form.updateItem}
                          onKeyDown={(idx, e) => handleKeyDown(idx, e, (i, id) => {
                            const p = shopProducts.find(prod => prod.id.toString() === id) || products.find(prod => prod.id.toString() === id);
                            if (p) {
                              const newItems = [...form.saleData.items];
                              newItems[i] = { ...newItems[i], productId: p.id.toString(), productName: p.name, productSku: p.sku || '', quantity: '1', mrp: p.mrp?.toString() || '', sellingPrice: p.sellingPrice?.toString() || '' };
                              form.setSaleData({ ...form.saleData, items: newItems });
                              form.setProductSearches(prev => { const copy = [...prev]; copy[i] = p.name; return copy; });
                              form.setShowProductDropdowns(prev => { const copy = [...prev]; copy[i] = false; return copy; });
                              form.setQtyPristine(prev => { const copy = [...prev]; copy[i] = true; return copy; });
                            }
                          })}
                          onQuantityKeyDown={handleQuantityKeyDown}
                          onBackspace={handleBackspaceNavigation}
                          onDeleteRow={(idx, e) => handleDeleteRowShortcut(idx, e, form.removeItem)}
                          onProductRowShiftTab={handleProductRowShiftTab}
                          qtyIsPristine={form.qtyPristine[index]}
                          onQuantityFirstFocus={() => form.clearQtyPristine(index)}
                          setMobileSearchOpen={setMobileSearchOpen}
                          setMobileSearchQuery={setMobileSearchQuery}
                          setShowProductDropdowns={form.setShowProductDropdowns}
                          setProductSearches={form.setProductSearches}
                          updateDropdownDirection={(idx, el) => {
                            if (!el) return;
                            const rect = el.getBoundingClientRect();
                            const spaceBelow = window.innerHeight - rect.bottom;
                            form.setDropdownOpenUpwards(prev => { const copy = [...prev]; copy[idx] = spaceBelow < 180; return copy; });
                          }}
                        />
                      ))}
                    </div>

                    {/* Add Item + Refresh Stock buttons */}
                    <div className="flex items-center gap-2 mt-2 mb-2">
                      <button
                        type="button"
                        onClick={form.addItem}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); form.addItem(); }
                          handleAddItemKeyDown(e, form.setPaymentExpanded);
                        }}
                        disabled={!form.saleData.shopId || form.saleData.shopId === 'ALL'}
                        className="bg-sky-600 text-white px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg hover:bg-sky-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:ring-2 focus:ring-sky-300 transition-colors shadow-sm"
                        title="Ctrl+N/⌘+N or F2 to add item"
                        tabIndex={50}
                        data-add-item
                      >
                        + Add Item
                      </button>
                    </div>
                  </div>

                  {/* ── Payment Section ── */}
                  <PaymentSection
                    saleData={form.saleData}
                    setSaleData={form.setSaleData}
                    paymentExpanded={form.paymentExpanded}
                    setPaymentExpanded={form.setPaymentExpanded}
                    calculateTotal={form.calculateTotal}
                    calculateChange={form.calculateChange}
                    isPaymentValid={form.isPaymentValid()}
                    isSubmitting={isSubmitting}
                    hasNoValidItems={hasNoValidItems(form.saleData)}
                    onPay={() => {
                      if (validateSaleForm(form.saleData, setErrorMessage, setShowErrorModal)) handleSubmit(null, false);
                    }}
                    onPayAndPrint={() => {
                      if (validateSaleForm(form.saleData, setErrorMessage, setShowErrorModal)) handleSubmit(null, true);
                    }}
                    onPayAndSms={() => {
                      if (validateSaleForm(form.saleData, setErrorMessage, setShowErrorModal)) handleSubmit(null, false, true);
                    }}
                    onPreviewClick={handlePreviewClick}
                    isMobile={isMobile}
                    // Keyboard nav handlers — pass directly, no wrapper arrow functions needed
                    onPrintKeyDown={handlePrintButtonKeyDown}
                  // onCashReceivedKeyDown / onOnlineRefKeyDown / onBothOnlineRefKeyDown
                  // are intentionally NOT wired here. The active Tab trap on the form
                  // already handles Tab from payment inputs → first non-disabled action
                  // button, skipping disabled ones. Wiring these element-level handlers
                  // would call e.preventDefault() before the trap runs, blocking it.
                  />
                </form>
              </div>
            )}

            {/* ── Tab 2: Catalog ── */}
            {activeTab === 'catalog' && (
              <CatalogTab
                isMobile={isMobile}
                shopId={form.saleData.shopId}
                shopProducts={shopProducts}
                assignedShops={assignedShops}
                isAdmin={isAdmin}
                onShopChange={(id) => form.resetForm(id)}
                isFullscreen={isFullscreen}
                basketItems={basketItems}
                onAddToBasket={addToBasket}
                onRemoveFromBasket={removeFromBasket}
              />
            )}

            {/* ── Tab 3: Cancel/Return ── */}
            {activeTab === 'cancel' && (
              <CancelReturnTab {...cancelReturn} isFullscreen={isFullscreen} />
            )}
          </div>
        </div>

        <MobileProductSearch
          isMobile={isMobile}
          mobileSearchOpen={mobileSearchOpen}
          mobileSearchQuery={mobileSearchQuery}
          setMobileSearchQuery={setMobileSearchQuery}
          closeMobileSearch={closeMobileSearch}
          getFilteredProducts={getFilteredProducts}
          handleProductSearch={(idx, val) =>
            form.setProductSearches(prev => { const copy = [...prev]; copy[idx] = val; return copy; })
          }
          handleProductSelect={(idx, id) => {
            const p = products.find(prod => prod.id.toString() === id);
            if (p) {
              const newItems = [...form.saleData.items];
              newItems[idx] = {
                ...newItems[idx],
                productId: p.id.toString(),
                productName: p.name,
                productSku: p.sku || '',
                quantity: '1',
                mrp: p.mrp?.toString() || '',
                sellingPrice: p.sellingPrice?.toString() || ''
              };
              form.setSaleData({ ...form.saleData, items: newItems });
              form.setProductSearches(prev => { const copy = [...prev]; copy[idx] = p.name; return copy; });
            }
          }}
          setMobileSearchOpen={setMobileSearchOpen}
          mobileSearchInputRef={mobileSearchInputRef}
        />

        <BasketModal
          show={showBasketModal}
          basketItems={basketItems}
          onClose={() => setShowBasketModal(false)}
          onCheckout={handleBasketCheckout}
          onAdd={addToBasket}
          onRemove={removeFromBasket}
          hasSaleItems={form.saleData.items.some((item: any) => !!item.productId)}
        />

        <SalePreviewModal
          show={showPreviewModal}
          saleData={form.saleData}
          products={products}
          assignedShops={assignedShops}
          calculateTotal={form.calculateTotal}
          calculateChange={form.calculateChange}
          isSubmitting={isSubmitting}
          isPaymentValid={form.isPaymentValid()}
          onClose={() => setShowPreviewModal(false)}
          onSubmit={(printFlag) => { setShowPreviewModal(false); handleSubmit(null, printFlag); }}
          isMobile={isMobile}
        />

        <FeedbackModals
          showSuccessModal={showSuccessModal}
          successMessage={successMessage}
          receiptData={receiptData}
          billData={billData}
          onPrintBill={async (bill) => {
            console.log('[PRINT] "Print Bill" button clicked', { shopId: bill?.shopId, orderNo: bill?.salesOrderNumber || bill?.orderNumber });
            if (!configFetched) {
              console.warn('[PRINT] ⚠ event config not yet loaded — proceeding with defaults (charsPerLine may be 32)');
            }
            const { shopName, orgName, counterNumber } = resolveShopInfo(bill.shopId, assignedShops);
            const userConfig = { shopName, orgName, counterNumber, eventName: eventName || undefined, eventConfigPayload: receiptConfig };
            console.log('[PRINT] charsPerLine =', receiptConfig?.thermalConfig?.charsPerLine ?? '(missing → default 32)');
            logger.warn("[PRINT SUBMIT] 1", "Print Bill button clicked, userConfig", userConfig);
            logger.warn("[PRINT SUBMIT] 1", "Print Bill button clicked, bill", bill);
            try {
              const route = await printBillSmart(bill, userConfig);
              console.log('[PRINT] handler finished, route =', route);
              setSuccessMessage('Printing…');
            } catch (e: any) {
              console.error('[PRINT] handler error:', e);
              setSuccessMessage(`Print failed: ${e?.message || e}`);
            }
          }}
          onSendSms={(bill) => {
            // Android-first (per explicit scoping): opens the default SMS app with
            // the bill summary pre-filled, and the customer's number too if we have
            // it on the order — otherwise the user types the number in manually.
            const { shopName } = resolveShopInfo(bill?.shopId, assignedShops);
            const message = buildBillSmsMessage(bill, shopName);
            openSmsApp(bill?.customerMobile, message);
          }}
          onCloseSuccess={() => {
            setShowSuccessModal(false);
            // Focus customer mobile for the next sale after the modal is dismissed
            setTimeout(() => {
              document.querySelector<HTMLInputElement>('input[name="customerMobile"]')?.focus();
            }, 50);
          }}
          showErrorModal={showErrorModal}
          errorMessage={errorMessage}
          errorRedirect={errorRedirect}
          onCloseError={() => {
            setShowErrorModal(false);
            if (errorRedirect) {
              setErrorRedirect(false);
              router.push(`/shifts?shopId=${form.saleData.shopId}`);
            }
          }}
          isMobile={isMobile}
        />

        <SaleSuccessSnackbar
          visible={showSuccessSnackbar}
          message={successMessage}
          onViewReceipt={() => {
            setShowSuccessSnackbar(false);
            setShowSuccessModal(true);
          }}
          onDismiss={() => setShowSuccessSnackbar(false)}
        />
      </div>
    </AppLayout>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={
      <AppLayout>
        <div className="p-4 text-center mt-10">Loading Sales Dashboard...</div>
      </AppLayout>
    }>
      <SalesContent />
    </Suspense>
  );
}
