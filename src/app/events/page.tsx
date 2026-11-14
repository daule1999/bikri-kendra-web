'use client';

import {
  DEFAULT_RECEIPT_CONFIG,
  DEFAULT_RECEIVING_CONFIG,
  ReceiptEventConfig,
  ReceiptLineConfig,
  ReceivingReceiptConfig,
} from '@/lib/recieptConfig';
import { formatISTDate, toEventDateISO } from '@/lib/dateUtils';
import {
  useCreateEventMutation,
  useDeleteEventMutation,
  useGetEventsQuery,
  useUpdateEventMutation
} from '@/store/services/eventsApi';

import AppLayout from '@/components/layout/AppLayout';
import { MuiDatePicker } from '@/components/ui/MuiDatePicker';
import { clearEventConfig } from '@/store/slices/eventConfigSlice';
import { useDispatch } from 'react-redux';
import { useState } from 'react';

// ─── Date helpers ─────────────────────────────────────────────────────────────
// Extract YYYY-MM-DD from a backend IST datetime string for pre-filling the date picker
const toPickerDate = (s: string) => s ? s.split('T')[0] : '';

// ─── Form State ───────────────────────────────────────────────────────────────
interface EventFormState {
  // Core event fields
  eventName: string; eventType: string; description: string;
  location: string; startDate: string; endDate: string; isActive: boolean;


  // Currency
  rc_currencyDisplay: string; rc_currencyThermal: string;

  // Paper & margins
  rc_paperWidth: string; rc_contentWidth: string;
  rc_marginTop: string; rc_marginBottom: string;
  rc_marginLeft: string; rc_marginRight: string;
  rc_padding: string;

  // Receipt layout — matches exact print order:
  // 1. Header lines
  rc_headerLines: ReceiptLineConfig[];

  // 2. Transaction info toggles
  rc_showInvoiceNumber: boolean;
  rc_showSaleOrderNumber: boolean;
  rc_showDateTime: boolean;
  rc_dateTimeFormat: ReceiptEventConfig['dateTimeFormat'];
  rc_showCustomerName: boolean;
  rc_showCustomerMobile: boolean;
  rc_showSellerUserId: boolean;
  rc_showCounterNumber: boolean;

  // 3. Items
  rc_showReturnDetails: boolean;

  // 4. Payment section
  rc_showPaymentMode: boolean;
  rc_showCashBreakdown: boolean;
  rc_showPaymentReference: boolean;
  rc_showChange: boolean;

  // 5. Footer lines
  rc_footerLines: ReceiptLineConfig[];

  // Advanced: OS overrides
  rc_osEnabled: boolean;
  rc_macHtmlBottom: string; rc_macThermalFeed: number;
  rc_windowsHtmlBottom: string; rc_windowsThermalFeed: number;
  rc_linuxHtmlBottom: string; rc_linuxThermalFeed: number;

  // Advanced: Thermal — infoAlignment/paymentAlignment apply to BOTH the ESC/POS
  // renderer and the HTML/browser-print fallback (see generateDynamicCSS).
  rc_charsPerLine: number; rc_leftMarginSpaces: number; rc_bottomFeedLines: number;
  rc_infoAlignment: 'left' | 'center' | 'right';
  rc_paymentAlignment: 'left' | 'center' | 'right';

  // ── Receiving Print (rc2_ prefix to avoid collision with main receipt rc_) ──
  rc2_receivingEnabled: boolean;
  rc2_charsPerLine: number; rc2_leftMarginSpaces: number; rc2_bottomFeedLines: number;
  rc2_infoAlignment: 'left' | 'center' | 'right';
  rc2_paperWidth: string; rc2_contentWidth: string;
  rc2_marginTop: string; rc2_marginBottom: string; rc2_marginLeft: string; rc2_marginRight: string;
  rc2_padding: string;
  rc2_headerLines: ReceiptLineConfig[];
  rc2_showInvoiceNumber: boolean;
  rc2_showDateTime: boolean;
  rc2_dateTimeFormat: ReceivingReceiptConfig['dateTimeFormat'];
  rc2_showSellerUserId: boolean;
  rc2_footerLines: ReceiptLineConfig[];
}

const DEF = DEFAULT_RECEIPT_CONFIG;

const DEFAULT_FORM_STATE: EventFormState = {
  eventName: '', eventType: '', description: '',
  location: '', startDate: '', endDate: '', isActive: true,
  rc_currencyDisplay: DEF.currency.displaySymbol,
  rc_currencyThermal: DEF.currency.thermalFallback,
  rc_paperWidth: DEF.htmlConfig.paperWidth,
  rc_contentWidth: DEF.htmlConfig.contentWidth,
  rc_marginTop: DEF.htmlConfig.margins.top,
  rc_marginBottom: DEF.htmlConfig.margins.bottom,
  rc_marginLeft: DEF.htmlConfig.margins.left,
  rc_marginRight: DEF.htmlConfig.margins.right,
  rc_padding: DEF.htmlConfig.padding,
  // Layout
  rc_headerLines: DEF.headerLines.map(l => ({ ...l })),
  rc_showInvoiceNumber: DEF.showInvoiceNumber,
  rc_showSaleOrderNumber: DEF.showSaleOrderNumber,
  rc_showDateTime: DEF.showDateTime,
  rc_dateTimeFormat: DEF.dateTimeFormat,
  rc_showCustomerName: DEF.showCustomerName,
  rc_showCustomerMobile: DEF.showCustomerMobile,
  rc_showSellerUserId: DEF.showSellerUserId,
  rc_showCounterNumber: DEF.showCounterNumber ?? true,
  rc_showReturnDetails: DEF.showReturnDetails,
  rc_showPaymentMode: DEF.showPaymentMode,
  rc_showCashBreakdown: DEF.showCashBreakdown,
  rc_showPaymentReference: DEF.showPaymentReference,
  rc_showChange: DEF.showChange,
  rc_footerLines: DEF.footerLines.map(l => ({ ...l })),
  // OS
  rc_osEnabled: DEF.osOverrides.enabled,
  rc_macHtmlBottom: DEF.osOverrides.mac.htmlBottomMargin,
  rc_macThermalFeed: DEF.osOverrides.mac.thermalBottomFeedLines,
  rc_windowsHtmlBottom: DEF.osOverrides.windows.htmlBottomMargin,
  rc_windowsThermalFeed: DEF.osOverrides.windows.thermalBottomFeedLines,
  rc_linuxHtmlBottom: DEF.osOverrides.linux.htmlBottomMargin,
  rc_linuxThermalFeed: DEF.osOverrides.linux.thermalBottomFeedLines,
  // Thermal
  rc_charsPerLine: DEF.thermalConfig.charsPerLine,
  rc_leftMarginSpaces: DEF.thermalConfig.leftMarginSpaces,
  rc_bottomFeedLines: DEF.thermalConfig.bottomFeedLines,
  rc_infoAlignment: DEF.thermalConfig.infoAlignment ?? 'left',
  rc_paymentAlignment: DEF.thermalConfig.paymentAlignment ?? 'left',
  // Receiving print defaults
  rc2_receivingEnabled: DEFAULT_RECEIVING_CONFIG.enabled,
  rc2_charsPerLine: DEFAULT_RECEIVING_CONFIG.thermalConfig.charsPerLine,
  rc2_infoAlignment: DEFAULT_RECEIVING_CONFIG.thermalConfig.infoAlignment ?? 'left',
  rc2_leftMarginSpaces: DEFAULT_RECEIVING_CONFIG.thermalConfig.leftMarginSpaces,
  rc2_bottomFeedLines: DEFAULT_RECEIVING_CONFIG.thermalConfig.bottomFeedLines,
  rc2_paperWidth: DEFAULT_RECEIVING_CONFIG.htmlConfig.paperWidth,
  rc2_contentWidth: DEFAULT_RECEIVING_CONFIG.htmlConfig.contentWidth,
  rc2_marginTop: DEFAULT_RECEIVING_CONFIG.htmlConfig.margins.top,
  rc2_marginBottom: DEFAULT_RECEIVING_CONFIG.htmlConfig.margins.bottom,
  rc2_marginLeft: DEFAULT_RECEIVING_CONFIG.htmlConfig.margins.left,
  rc2_marginRight: DEFAULT_RECEIVING_CONFIG.htmlConfig.margins.right,
  rc2_padding: DEFAULT_RECEIVING_CONFIG.htmlConfig.padding,
  rc2_headerLines: DEFAULT_RECEIVING_CONFIG.headerLines.map(l => ({ ...l })),
  rc2_showInvoiceNumber: DEFAULT_RECEIVING_CONFIG.showInvoiceNumber,
  rc2_showDateTime: DEFAULT_RECEIVING_CONFIG.showDateTime,
  rc2_dateTimeFormat: DEFAULT_RECEIVING_CONFIG.dateTimeFormat,
  rc2_showSellerUserId: DEFAULT_RECEIVING_CONFIG.showSellerUserId,
  rc2_footerLines: DEFAULT_RECEIVING_CONFIG.footerLines.map(l => ({ ...l })),
};

// ─── Build typed ReceiptEventConfig from flat form state ──────────────────────
function buildReceiptConfig(f: EventFormState): ReceiptEventConfig {
  return {
    currency: { displaySymbol: f.rc_currencyDisplay, thermalFallback: f.rc_currencyThermal },
    osOverrides: {
      enabled: f.rc_osEnabled,
      mac: { htmlBottomMargin: f.rc_macHtmlBottom, thermalBottomFeedLines: f.rc_macThermalFeed },
      windows: { htmlBottomMargin: f.rc_windowsHtmlBottom, thermalBottomFeedLines: f.rc_windowsThermalFeed },
      linux: { htmlBottomMargin: f.rc_linuxHtmlBottom, thermalBottomFeedLines: f.rc_linuxThermalFeed },
    },
    htmlConfig: {
      paperWidth: f.rc_paperWidth, contentWidth: f.rc_contentWidth,
      margins: { top: f.rc_marginTop, bottom: f.rc_marginBottom, left: f.rc_marginLeft, right: f.rc_marginRight },
      padding: f.rc_padding,
    },
    thermalConfig: {
      charsPerLine: f.rc_charsPerLine, leftMarginSpaces: f.rc_leftMarginSpaces,
      bottomFeedLines: f.rc_bottomFeedLines,
      infoAlignment: f.rc_infoAlignment,
      paymentAlignment: f.rc_paymentAlignment,
    },
    headerLines: f.rc_headerLines,
    showInvoiceNumber: f.rc_showInvoiceNumber,
    showSaleOrderNumber: f.rc_showSaleOrderNumber,
    showDateTime: f.rc_showDateTime,
    dateTimeFormat: f.rc_dateTimeFormat,
    showCustomerName: f.rc_showCustomerName,
    showCustomerMobile: f.rc_showCustomerMobile,
    showSellerUserId: f.rc_showSellerUserId,
    showCounterNumber: f.rc_showCounterNumber,
    showReturnDetails: f.rc_showReturnDetails,
    showPaymentMode: f.rc_showPaymentMode,
    showCashBreakdown: f.rc_showCashBreakdown,
    showPaymentReference: f.rc_showPaymentReference,
    showChange: f.rc_showChange,
    footerLines: f.rc_footerLines,
    receivingPrint: {
      enabled: f.rc2_receivingEnabled,
      thermalConfig: {
        charsPerLine: f.rc2_charsPerLine,
        leftMarginSpaces: f.rc2_leftMarginSpaces,
        bottomFeedLines: f.rc2_bottomFeedLines,
        infoAlignment: f.rc2_infoAlignment,
      },
      htmlConfig: {
        paperWidth: f.rc2_paperWidth,
        contentWidth: f.rc2_contentWidth,
        margins: { top: f.rc2_marginTop, bottom: f.rc2_marginBottom, left: f.rc2_marginLeft, right: f.rc2_marginRight },
        padding: f.rc2_padding,
      },
      headerLines: f.rc2_headerLines,
      showInvoiceNumber: f.rc2_showInvoiceNumber,
      showDateTime: f.rc2_showDateTime,
      dateTimeFormat: f.rc2_dateTimeFormat,
      showSellerUserId: f.rc2_showSellerUserId,
      footerLines: f.rc2_footerLines,
    },
  };
}

// ─── Hydrate form from existing event ─────────────────────────────────────────
function hydrateFromEvent(event: any): EventFormState {
  const rc = event.receiptConfig as ReceiptEventConfig | undefined;
  const def = DEFAULT_FORM_STATE;
  return {
    eventName: event.eventName,
    eventType: event.eventType,
    description: event.description || '',
    location: event.location,
    startDate: toPickerDate(event.startDate),
    endDate: toPickerDate(event.endDate),
    isActive: event.isActive,
    rc_currencyDisplay: rc?.currency?.displaySymbol ?? def.rc_currencyDisplay,
    rc_currencyThermal: rc?.currency?.thermalFallback ?? def.rc_currencyThermal,
    rc_paperWidth: rc?.htmlConfig?.paperWidth ?? def.rc_paperWidth,
    rc_contentWidth: rc?.htmlConfig?.contentWidth ?? def.rc_contentWidth,
    rc_marginTop: rc?.htmlConfig?.margins?.top ?? def.rc_marginTop,
    rc_marginBottom: rc?.htmlConfig?.margins?.bottom ?? def.rc_marginBottom,
    rc_marginLeft: rc?.htmlConfig?.margins?.left ?? def.rc_marginLeft,
    rc_marginRight: rc?.htmlConfig?.margins?.right ?? def.rc_marginRight,
    rc_padding: rc?.htmlConfig?.padding ?? def.rc_padding,
    rc_headerLines: rc?.headerLines?.length
      ? rc.headerLines.map((l: any) => ({ ...l }))
      : def.rc_headerLines.map(l => ({ ...l })),
    rc_showInvoiceNumber: rc?.showInvoiceNumber ?? def.rc_showInvoiceNumber,
    rc_showSaleOrderNumber: rc?.showSaleOrderNumber ?? def.rc_showSaleOrderNumber,
    rc_showDateTime: rc?.showDateTime ?? def.rc_showDateTime,
    rc_dateTimeFormat: rc?.dateTimeFormat ?? def.rc_dateTimeFormat,
    rc_showCustomerName: rc?.showCustomerName ?? def.rc_showCustomerName,
    rc_showCustomerMobile: rc?.showCustomerMobile ?? def.rc_showCustomerMobile,
    rc_showSellerUserId: rc?.showSellerUserId ?? def.rc_showSellerUserId,
    rc_showCounterNumber: rc?.showCounterNumber ?? def.rc_showCounterNumber,
    rc_showReturnDetails: rc?.showReturnDetails ?? def.rc_showReturnDetails,
    rc_showPaymentMode: rc?.showPaymentMode ?? def.rc_showPaymentMode,
    rc_showCashBreakdown: rc?.showCashBreakdown ?? def.rc_showCashBreakdown,
    rc_showPaymentReference: rc?.showPaymentReference ?? def.rc_showPaymentReference,
    rc_showChange: rc?.showChange ?? def.rc_showChange,
    rc_footerLines: rc?.footerLines?.length
      ? rc.footerLines.map((l: any) => ({ ...l }))
      : def.rc_footerLines.map(l => ({ ...l })),
    rc_osEnabled: rc?.osOverrides?.enabled ?? def.rc_osEnabled,
    rc_macHtmlBottom: rc?.osOverrides?.mac?.htmlBottomMargin ?? def.rc_macHtmlBottom,
    rc_macThermalFeed: rc?.osOverrides?.mac?.thermalBottomFeedLines ?? def.rc_macThermalFeed,
    rc_windowsHtmlBottom: rc?.osOverrides?.windows?.htmlBottomMargin ?? def.rc_windowsHtmlBottom,
    rc_windowsThermalFeed: rc?.osOverrides?.windows?.thermalBottomFeedLines ?? def.rc_windowsThermalFeed,
    rc_linuxHtmlBottom: rc?.osOverrides?.linux?.htmlBottomMargin ?? def.rc_linuxHtmlBottom,
    rc_linuxThermalFeed: rc?.osOverrides?.linux?.thermalBottomFeedLines ?? def.rc_linuxThermalFeed,
    rc_charsPerLine: rc?.thermalConfig?.charsPerLine ?? def.rc_charsPerLine,
    rc_leftMarginSpaces: rc?.thermalConfig?.leftMarginSpaces ?? def.rc_leftMarginSpaces,
    rc_bottomFeedLines: rc?.thermalConfig?.bottomFeedLines ?? def.rc_bottomFeedLines,
    rc_infoAlignment: rc?.thermalConfig?.infoAlignment ?? def.rc_infoAlignment,
    rc_paymentAlignment: rc?.thermalConfig?.paymentAlignment ?? def.rc_paymentAlignment,
    // Receiving print — hydrate from stored config
    rc2_receivingEnabled: rc?.receivingPrint?.enabled ?? def.rc2_receivingEnabled,
    rc2_charsPerLine: rc?.receivingPrint?.thermalConfig?.charsPerLine ?? def.rc2_charsPerLine,
    rc2_infoAlignment: (rc?.receivingPrint?.thermalConfig as any)?.infoAlignment ?? def.rc2_infoAlignment,
    rc2_leftMarginSpaces: rc?.receivingPrint?.thermalConfig?.leftMarginSpaces ?? def.rc2_leftMarginSpaces,
    rc2_bottomFeedLines: rc?.receivingPrint?.thermalConfig?.bottomFeedLines ?? def.rc2_bottomFeedLines,
    rc2_paperWidth: rc?.receivingPrint?.htmlConfig?.paperWidth ?? def.rc2_paperWidth,
    rc2_contentWidth: rc?.receivingPrint?.htmlConfig?.contentWidth ?? def.rc2_contentWidth,
    rc2_marginTop: rc?.receivingPrint?.htmlConfig?.margins?.top ?? def.rc2_marginTop,
    rc2_marginBottom: rc?.receivingPrint?.htmlConfig?.margins?.bottom ?? def.rc2_marginBottom,
    rc2_marginLeft: rc?.receivingPrint?.htmlConfig?.margins?.left ?? def.rc2_marginLeft,
    rc2_marginRight: rc?.receivingPrint?.htmlConfig?.margins?.right ?? def.rc2_marginRight,
    rc2_padding: rc?.receivingPrint?.htmlConfig?.padding ?? def.rc2_padding,
    rc2_headerLines: rc?.receivingPrint?.headerLines?.length
      ? rc.receivingPrint.headerLines.map((l: any) => ({ ...l }))
      : def.rc2_headerLines.map(l => ({ ...l })),
    rc2_showInvoiceNumber: rc?.receivingPrint?.showInvoiceNumber ?? def.rc2_showInvoiceNumber,
    rc2_showDateTime: rc?.receivingPrint?.showDateTime ?? def.rc2_showDateTime,
    rc2_dateTimeFormat: rc?.receivingPrint?.dateTimeFormat ?? def.rc2_dateTimeFormat,
    rc2_showSellerUserId: rc?.receivingPrint?.showSellerUserId ?? def.rc2_showSellerUserId,
    rc2_footerLines: rc?.receivingPrint?.footerLines?.length
      ? rc.receivingPrint.footerLines.map((l: any) => ({ ...l }))
      : def.rc2_footerLines.map(l => ({ ...l })),
  };
}

// ─── Reusable line-array editor (header or footer) ───────────────────────────
function LineArrayEditor({
  lines,
  onChange,
  tokenHint,
}: {
  lines: ReceiptLineConfig[];
  onChange: (lines: ReceiptLineConfig[]) => void;
  tokenHint?: boolean;
}) {
  const update = (idx: number, patch: Partial<ReceiptLineConfig>) => {
    const next = [...lines];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const remove = (idx: number) => onChange(lines.filter((_, i) => i !== idx));
  const add = () => onChange([...lines, { text: '', bold: false, fontSize: '11px', alignment: 'center' }]);

  return (
    <div className="space-y-2">
      {tokenHint && (
        <p className="text-xs text-blue-600 bg-blue-50 rounded p-2">
          Tokens: <code>{'{{SHOP_NAME}}'}</code> <code>{'{{ORG_NAME}}'}</code> <code>{'{{EVENT_NAME}}'}</code> <code>{'{{DATE}}'}</code>
        </p>
      )}
      {lines.map((line, idx) => (
        <div key={idx} className="border rounded-lg p-2 space-y-2 bg-gray-50/60">
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-400 font-mono w-5 flex-shrink-0">L{idx + 1}</span>
            <input type="text" value={line.text} placeholder="Line text or {{TOKEN}}…"
              onChange={e => update(idx, { text: e.target.value })}
              className="flex-1 p-1.5 border rounded text-xs" />
            <button type="button" onClick={() => remove(idx)}
              className="text-red-400 hover:text-red-600 text-xs px-1 flex-shrink-0">✕</button>
          </div>
          <div className="flex gap-3 pl-5 flex-wrap items-center">
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={line.bold ?? false}
                onChange={e => update(idx, { bold: e.target.checked })} />
              Bold
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Size</span>
              <input type="text" value={line.fontSize ?? '11px'} placeholder="11px"
                onChange={e => update(idx, { fontSize: e.target.value })}
                className="w-14 p-1 border rounded text-xs" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Align</span>
              <select value={line.alignment ?? 'center'}
                onChange={e => update(idx, { alignment: e.target.value as ReceiptLineConfig['alignment'] })}
                className="p-1 border rounded text-xs">
                <option value="center">Center</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium">
        + Add line
      </button>
    </div>
  );
}

// ─── Toggle row helper ────────────────────────────────────────────────────────
function ToggleRow({ label, checked, onChange, disabled }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className={`flex items-center justify-between py-1.5 cursor-pointer ${disabled ? 'opacity-50' : ''}`}>
      <span className="text-xs text-gray-700">{label}</span>
      <div
        className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${checked ? 'bg-emerald-500' : 'bg-gray-300'}`}
        onClick={() => !disabled && onChange(!checked)}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const dispatch = useDispatch();
  const { data: events = [], isLoading, isFetching } = useGetEventsQuery();
  const [createEvent] = useCreateEventMutation();
  const [updateEvent] = useUpdateEventMutation();
  const [deleteEvent] = useDeleteEventMutation();

  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState<EventFormState>(DEFAULT_FORM_STATE);
  const [showReceiptConfig, setShowReceiptConfig] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const set = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const start = new Date(toEventDateISO(formData.startDate));
      const end = new Date(toEventDateISO(formData.endDate));
      if (end < start) {
        setErrorMessage('End date must not be before start date');
        setShowErrorModal(true);
        return;
      }
      // Event names must be unique (trimmed, case-insensitive). The backend enforces this too.
      const newName = (formData.eventName || '').trim().toLowerCase();
      if (!newName) {
        setErrorMessage('Event name is required');
        setShowErrorModal(true);
        return;
      }
      const duplicate = (events as any[]).some(
        (ev: any) =>
          (ev.eventName || '').trim().toLowerCase() === newName &&
          (!editingEvent || String(ev.id) !== String(editingEvent.id))
      );
      if (duplicate) {
        setErrorMessage('An event with this name already exists');
        setShowErrorModal(true);
        return;
      }
      // BUG-02 fix: only build & send receiptConfig on EDIT — not on CREATE.
      // The accordion UI is already hidden on create; this ensures the backend
      // also receives null so the event starts with no stored config (falls
      // back to client-side DEFAULT_RECEIPT_CONFIG at print time).
      const receiptConfig = editingEvent ? buildReceiptConfig(formData) : undefined;

      const payload = {
        eventName: formData.eventName,
        eventType: formData.eventType,
        description: formData.description,
        location: formData.location,
        startDate: toEventDateISO(formData.startDate),
        endDate: toEventDateISO(formData.endDate),
        isActive: formData.isActive,
        ...(receiptConfig !== undefined && { receiptConfig }),
      };

      if (editingEvent) {
        await updateEvent({ id: editingEvent.id, data: payload }).unwrap();
        // BUG-01 fix: clear the Redux eventConfig cache so useEventConfig
        // re-fetches fresh config on the next render. Without this, the Sales
        // and Billing pages would keep printing with the old config until the
        // user refreshes the page or switches events.
        dispatch(clearEventConfig());
      } else {
        await createEvent(payload).unwrap();
      }
      setSuccessMessage(`Event ${editingEvent ? 'updated' : 'created'} successfully`);
      setShowSuccessModal(true);
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      setErrorMessage(error?.data?.message || 'Failed to save event');
      setShowErrorModal(true);
    }
  };

  console.log('formData', formData);
  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData(hydrateFromEvent(event));
    setShowReceiptConfig(false);
    setShowModal(true);
  };

  const handleDeleteClick = (id: number | string) => { setDeletingId(id); setShowDeleteModal(true); };
  const handleDeleteConfirm = async () => {
    if (deletingId === null) return;
    setShowDeleteModal(false);
    try {
      await deleteEvent(deletingId).unwrap();
      setSuccessMessage('Event deleted successfully');
      setShowSuccessModal(true);
    } catch (error: any) {
      setErrorMessage(error?.data?.message || 'Failed to delete event');
      setShowErrorModal(true);
    } finally { setDeletingId(null); }
  };

  const resetForm = () => { setFormData(DEFAULT_FORM_STATE); setEditingEvent(null); setShowReceiptConfig(false); };
  const closeModal = () => { setShowModal(false); resetForm(); };
  const openCreateModal = () => { resetForm(); setShowModal(true); };

  const showingLoader = isLoading || isFetching;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 animate-fade-in-up p-4 sm:p-6">

        {/* ── Banner ── */}
        <section className="relative rounded-2xl p-6 sm:p-8 text-white"
          style={{ background: 'linear-gradient(135deg, #064E3B 0%, #047857 60%, #10B981 100%)' }}>
          <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: '#A7F3D0' }}>Campaigns & Activities</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Event Management</h1>
            </div>
            <div className="flex gap-4 sm:gap-6 items-center">
              <div className="text-center hidden sm:block">
                <p className="text-2xl font-bold">{events.length}</p>
                <p className="text-xs mt-0.5" style={{ color: '#A7F3D0' }}>Total Events</p>
              </div>
              <div className="hidden sm:block w-px h-10" style={{ background: 'rgba(167,243,208,0.2)' }} />
              <button onClick={openCreateModal}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-semibold text-emerald-700 hover:text-emerald-800 bg-white/90 hover:bg-white transition-all shadow-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Create Event
              </button>
            </div>
          </div>
        </section>

        {/* ── Table ── */}
        <div className="card overflow-hidden">
          {showingLoader ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <div className="h-4 bg-gray-200 rounded w-8" /><div className="h-4 bg-gray-200 rounded flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="sm:hidden p-3 space-y-3 bg-gray-50/50">
                {events.length > 0 ? events.map(event => (
                  <div key={event.id} className="border rounded-xl p-3.5 bg-white shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{event.eventName}</p>
                        <p className="text-xs text-gray-500 truncate">{event.eventType}</p>
                      </div>
                      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${event.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {event.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="mt-3 pt-3 border-t text-xs text-gray-600 space-y-1">
                      <p>📍 {event.location}</p>
                      <p>📅 {formatISTDate(event.startDate)} — {formatISTDate(event.endDate)}</p>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => handleEdit(event)} className="flex-1 bg-emerald-50 text-emerald-700 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-100">Edit</button>
                    </div>
                  </div>
                )) : <div className="text-center text-gray-500 text-sm py-4">No events found</div>}
              </div>

              {/* Desktop */}
              <table className="w-full hidden sm:table">
                <thead className="bg-gray-50">
                  <tr>
                    {['ID', 'Event Name', 'Type', 'Location', 'Start', 'End', 'Status', 'Actions'].map(h => (
                      <th key={h} className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.length > 0 ? events.map(event => (
                    <tr key={event.id} className="border-t hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 text-sm text-gray-500">#{event.id}</td>
                      <td className="p-4 text-sm font-semibold text-gray-900">{event.eventName}</td>
                      <td className="p-4 text-sm text-gray-600">{event.eventType}</td>
                      <td className="p-4 text-sm text-gray-600">{event.location}</td>
                      <td className="p-4 text-sm text-gray-600">{formatISTDate(event.startDate)}</td>
                      <td className="p-4 text-sm text-gray-600">{formatISTDate(event.endDate)}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${event.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                          {event.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        <button onClick={() => handleEdit(event)} className="text-emerald-600 hover:text-emerald-800">Edit</button>
                      </td>
                    </tr>
                  )) : <tr><td className="p-4 text-gray-500 text-center" colSpan={9}>No events found</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white/95 w-full max-w-lg h-[96vh] sm:h-auto sm:max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">

            {/* Header */}
            <div className="sticky top-0 bg-white border-b px-4 py-3 z-10">
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-2 sm:hidden" />
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-semibold">{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
                <button type="button" onClick={closeModal} className="text-gray-500 hover:text-gray-700 text-lg px-2 py-1 rounded">✕</button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

                {/* ── Core event fields ── */}
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Event Name *</label>
                  <input type="text" value={formData.eventName}
                    onChange={e => set('eventName', e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Event Type *</label>
                  <input type="text" value={formData.eventType}
                    onChange={e => set('eventType', e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm" required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Description</label>
                  <textarea value={formData.description}
                    onChange={e => set('description', e.target.value)}
                    className="w-full p-2.5 border rounded-lg h-16 text-sm" rows={2} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-0.5">Location *</label>
                  <input type="text" value={formData.location}
                    onChange={e => set('location', e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm" required />
                </div>
                <MuiDatePicker label="Start Date" value={formData.startDate}
                  onChange={val => set('startDate', val)} type="date" variant="mobile" required />
                <MuiDatePicker label="End Date" value={formData.endDate}
                  onChange={val => set('endDate', val)} type="date" variant="mobile" required />
                <label className="flex items-center text-sm cursor-pointer gap-2">
                  <input type="checkbox" checked={formData.isActive}
                    onChange={e => set('isActive', e.target.checked)} />
                  Active Event
                </label>

                {/* ── Receipt Configuration Accordion — edit mode only ── */}
                {editingEvent && (
                  <div className="border rounded-xl overflow-hidden">
                    <button type="button" onClick={() => setShowReceiptConfig(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors">
                      <span>🖨️ Receipt Configuration</span>
                      <span className="text-emerald-500 text-xs">{showReceiptConfig ? '▲ Collapse' : '▼ Expand'}</span>
                    </button>

                    {showReceiptConfig && (
                      <div className="px-4 py-4 space-y-5 text-sm border-t">

                        {/* ── Identity info (read-only) ── */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                          <p className="font-semibold mb-0.5">🏪 Shop &amp; Organisation</p>
                          <p><code>{'{{SHOP_NAME}}'}</code> → filled from the shop where the bill is made (Shop Name)</p>
                          <p><code>{'{{ORG_NAME}}'}</code> → filled from that shop's category (Category Name)</p>
                          <p className="mt-1 text-blue-500">Configure these in the Shops &amp; Categories management screens.</p>
                        </div>

                        {/* ── Currency ── */}
                        <div>
                          <p className="font-semibold text-gray-600 border-b pb-1 mb-2">💰 Currency Symbol</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500 block mb-0.5">Browser print (HTML)</label>
                              <input type="text" value={formData.rc_currencyDisplay} maxLength={5}
                                onChange={e => set('rc_currencyDisplay', e.target.value)}
                                placeholder="₹" className="w-full p-2 border rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-0.5">Thermal fallback (ESC/POS)</label>
                              <input type="text" value={formData.rc_currencyThermal} maxLength={5}
                                onChange={e => set('rc_currencyThermal', e.target.value)}
                                placeholder="Rs" className="w-full p-2 border rounded-lg text-sm" />
                            </div>
                          </div>
                        </div>

                        {/* ══ RECEIPT LAYOUT PREVIEW ══════════════════════════════ */}
                        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 text-center">Receipt Layout</p>

                          {/* ─ 1. HEADER LINES ─────────────────────────────── */}
                          <div className="mb-3">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">① Header Lines</span>
                              <span className="text-xs text-gray-400">Add as many as you want</span>
                            </div>
                            <LineArrayEditor
                              lines={formData.rc_headerLines}
                              onChange={lines => set('rc_headerLines', lines)}
                              tokenHint
                            />
                          </div>

                          <div className="border-t border-dashed border-gray-400 my-3" />

                          {/* ─ 2. TRANSACTION INFO ─────────────────────────── */}
                          <div className="mb-3">
                            <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">② Transaction Info</span>
                            <div className="mt-2 space-y-0.5 divide-y divide-gray-100 border rounded-lg bg-white px-3">
                              <ToggleRow label="Invoice Number"
                                checked={formData.rc_showInvoiceNumber}
                                onChange={v => set('rc_showInvoiceNumber', v)} />
                              <ToggleRow label="Sale Order Number"
                                checked={formData.rc_showSaleOrderNumber}
                                onChange={v => set('rc_showSaleOrderNumber', v)} />
                              <div className="py-1.5">
                                <ToggleRow label="Date / Time"
                                  checked={formData.rc_showDateTime}
                                  onChange={v => set('rc_showDateTime', v)} />
                                {formData.rc_showDateTime && (
                                  <div className="mt-1 pl-1">
                                    <label className="text-xs text-gray-500 block mb-0.5">Format</label>
                                    <select value={formData.rc_dateTimeFormat}
                                      onChange={e => set('rc_dateTimeFormat', e.target.value as EventFormState['rc_dateTimeFormat'])}
                                      className="w-full p-1.5 border rounded text-xs">
                                      <option value="locale">Locale (date + time)</option>
                                      <option value="date-locale">Locale (date only)</option>
                                      <option value="dd/mm/yyyy hh:mm">DD/MM/YYYY HH:MM</option>
                                      <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                                      <option value="iso">ISO 8601</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                              <ToggleRow label="Customer Name"
                                checked={formData.rc_showCustomerName}
                                onChange={v => set('rc_showCustomerName', v)} />
                              <ToggleRow label="Customer Mobile"
                                checked={formData.rc_showCustomerMobile}
                                onChange={v => set('rc_showCustomerMobile', v)} />
                              <ToggleRow label="Seller / User ID"
                                checked={formData.rc_showSellerUserId}
                                onChange={v => set('rc_showSellerUserId', v)} />
                              <ToggleRow label="Counter Number"
                                checked={formData.rc_showCounterNumber}
                                onChange={v => set('rc_showCounterNumber', v)} />
                            </div>
                          </div>

                          <div className="border-t border-dashed border-gray-400 my-3" />

                          {/* ─ 3. ITEMS ────────────────────────────────────── */}
                          <div className="mb-3">
                            <span className="text-xs font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">③ All Items</span>
                            <div className="mt-2 border rounded-lg bg-white px-3 divide-y divide-gray-100">
                              <ToggleRow label="Show return details (qty returned, net amount)"
                                checked={formData.rc_showReturnDetails}
                                onChange={v => set('rc_showReturnDetails', v)} />
                            </div>
                          </div>

                          <div className="border-t border-dashed border-gray-400 my-3" />

                          {/* ─ 4. GRAND TOTAL (always) ─────────────────────── */}
                          <div className="mb-3 text-center">
                            <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">④ Grand Total</span>
                            <p className="text-xs text-gray-400 mt-1">Always shown</p>
                          </div>

                          <div className="border-t border-dashed border-gray-400 my-3" />

                          {/* ─ 5. PAYMENT ──────────────────────────────────── */}
                          <div className="mb-3">
                            <span className="text-xs font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">⑤ Payment</span>
                            <div className="mt-2 space-y-0.5 divide-y divide-gray-100 border rounded-lg bg-white px-3">
                              <ToggleRow label="Payment Mode (CASH / ONLINE / BOTH)"
                                checked={formData.rc_showPaymentMode}
                                onChange={v => set('rc_showPaymentMode', v)} />
                              <ToggleRow label="Cash / Online breakdown (for BOTH)"
                                checked={formData.rc_showCashBreakdown}
                                onChange={v => set('rc_showCashBreakdown', v)}
                                disabled={!formData.rc_showPaymentMode} />
                              <ToggleRow label="Payment Reference (UPI/card ref)"
                                checked={formData.rc_showPaymentReference}
                                onChange={v => set('rc_showPaymentReference', v)}
                                disabled={!formData.rc_showPaymentMode} />
                              <ToggleRow label="Change amount"
                                checked={formData.rc_showChange}
                                onChange={v => set('rc_showChange', v)}
                                disabled={!formData.rc_showPaymentMode} />
                            </div>
                          </div>

                          <div className="border-t border-dashed border-gray-400 my-3" />

                          {/* ─ 6. FOOTER LINES ─────────────────────────────── */}
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">⑥ Footer Lines</span>
                              <span className="text-xs text-gray-400">Add as many as you want</span>
                            </div>
                            <LineArrayEditor
                              lines={formData.rc_footerLines}
                              onChange={lines => set('rc_footerLines', lines)}
                              tokenHint
                            />
                          </div>
                        </div>
                        {/* ══ END RECEIPT LAYOUT ══════════════════════════════ */}

                        {/* ── Receiving Print Config ── */}
                        <details className="border-2 border-amber-200 rounded-lg" open={formData.rc2_receivingEnabled}>
                          <summary className="px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 rounded-t-lg cursor-pointer select-none flex items-center gap-2">
                            🧾 Receiving Slip Config
                            <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${formData.rc2_receivingEnabled ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                              {formData.rc2_receivingEnabled ? 'ENABLED' : 'DISABLED'}
                            </span>
                          </summary>
                          <div className="px-3 pb-3 pt-2 space-y-3">
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                              When enabled here AND on a shop, a receiving slip prints automatically after every sale — no dialog.
                              Receiving slip shows: Bill No, Date, Seller, and items with SKU (no amounts).
                            </p>
                            <ToggleRow
                              label="Enable Receiving Print (event-level master switch)"
                              checked={formData.rc2_receivingEnabled}
                              onChange={v => set('rc2_receivingEnabled', v)}
                            />

                            {formData.rc2_receivingEnabled && (<>
                              {/* Transaction info toggles */}
                              <div className="space-y-1 border-t pt-2">
                                <span className="text-xs font-semibold text-gray-600 block mb-1">Transaction Info shown on slip</span>
                                <ToggleRow label="Bill Number" checked={formData.rc2_showInvoiceNumber} onChange={v => set('rc2_showInvoiceNumber', v)} />
                                <ToggleRow label="Date / Time" checked={formData.rc2_showDateTime} onChange={v => set('rc2_showDateTime', v)} />
                                {formData.rc2_showDateTime && (
                                  <select value={formData.rc2_dateTimeFormat}
                                    onChange={e => set('rc2_dateTimeFormat', e.target.value as EventFormState['rc2_dateTimeFormat'])}
                                    className="ml-6 p-1.5 border rounded text-xs w-48">
                                    <option value="locale">Full locale (default)</option>
                                    <option value="date-locale">Date only (locale)</option>
                                    <option value="dd/mm/yyyy hh:mm">DD/MM/YYYY HH:MM</option>
                                    <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                                    <option value="iso">ISO 8601</option>
                                  </select>
                                )}
                                <ToggleRow label="Seller Name" checked={formData.rc2_showSellerUserId} onChange={v => set('rc2_showSellerUserId', v)} />
                              </div>

                              {/* Header lines */}
                              <div className="border-t pt-2">
                                <span className="text-xs font-semibold text-gray-600 block mb-1">Header Lines</span>
                                <LineArrayEditor lines={formData.rc2_headerLines} onChange={lines => set('rc2_headerLines', lines)} tokenHint />
                              </div>

                              {/* Footer lines */}
                              <div className="border-t pt-2">
                                <span className="text-xs font-semibold text-gray-600 block mb-1">Footer Lines</span>
                                <LineArrayEditor lines={formData.rc2_footerLines} onChange={lines => set('rc2_footerLines', lines)} tokenHint />
                              </div>

                              {/* Advanced thermal */}
                              <details className="border rounded-lg">
                                <summary className="px-3 py-1.5 text-xs font-semibold text-gray-500 cursor-pointer select-none">⚙️ Advanced — Thermal &amp; Paper</summary>
                                <div className="px-3 pb-3 pt-2 space-y-2">
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Chars / Line</label>
                                      <select value={formData.rc2_charsPerLine}
                                        onChange={e => set('rc2_charsPerLine', Number(e.target.value))}
                                        className="w-full p-1.5 border rounded text-xs">
                                        <option value={44}>44 (80mm)</option>
                                        <option value={32}>32 (58mm)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Left Margin Sp.</label>
                                      <input type="number" min={0} max={10} value={formData.rc2_leftMarginSpaces}
                                        onChange={e => set('rc2_leftMarginSpaces', Number(e.target.value))}
                                        className="w-full p-1.5 border rounded text-xs" />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Feed Lines</label>
                                      <input type="number" min={0} max={20} value={formData.rc2_bottomFeedLines}
                                        onChange={e => set('rc2_bottomFeedLines', Number(e.target.value))}
                                        className="w-full p-1.5 border rounded text-xs" />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-0.5">Info Block Alignment (applies to thermal + HTML print)</label>
                                    <select value={formData.rc2_infoAlignment}
                                      onChange={e => set('rc2_infoAlignment', e.target.value as EventFormState['rc2_infoAlignment'])}
                                      className="w-40 p-1.5 border rounded text-xs">
                                      <option value="left">Left</option>
                                      <option value="center">Center</option>
                                      <option value="right">Right</option>
                                    </select>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Paper Width</label>
                                      <select value={formData.rc2_paperWidth}
                                        onChange={e => set('rc2_paperWidth', e.target.value)}
                                        className="w-full p-1.5 border rounded text-xs">
                                        <option value="80mm">80mm</option>
                                        <option value="58mm">58mm</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-500 block mb-0.5">Content Width</label>
                                      <input type="text" value={formData.rc2_contentWidth}
                                        onChange={e => set('rc2_contentWidth', e.target.value)}
                                        className="w-full p-1.5 border rounded text-xs" />
                                    </div>
                                  </div>
                                </div>
                              </details>
                            </>)}
                          </div>
                        </details>

                        {/* ── Advanced: Paper & Margins ── */}
                        <details className="border rounded-lg">
                          <summary className="px-3 py-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                            ⚙️ Advanced — Paper & Margins
                          </summary>
                          <div className="px-3 pb-3 pt-2 space-y-2">
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-1.5">
                              Always include a unit — e.g. <code>5mm</code> or <code>10px</code>, not just <code>5</code>.
                              A bare number is invalid CSS and gets silently ignored at print time, which looks like
                              "this setting does nothing."
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Paper Width</label>
                                <select value={formData.rc_paperWidth} onChange={e => set('rc_paperWidth', e.target.value)}
                                  className="w-full p-2 border rounded text-xs">
                                  <option value="80mm">80mm (standard)</option>
                                  <option value="58mm">58mm (narrow)</option>
                                  <option value="76mm">76mm</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Content Width</label>
                                <input type="text" value={formData.rc_contentWidth}
                                  onChange={e => set('rc_contentWidth', e.target.value)}
                                  placeholder="70mm" className="w-full p-2 border rounded text-xs" />
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {(['Top', 'Bottom', 'Left', 'Right'] as const).map(side => (
                                <div key={side}>
                                  <label className="text-xs text-gray-500 block mb-0.5">{side}</label>
                                  <input type="text"
                                    value={(formData as any)[`rc_margin${side}`]}
                                    onChange={e => set(`rc_margin${side}` as keyof EventFormState, e.target.value as any)}
                                    placeholder="5mm" className="w-full p-1.5 border rounded text-xs" />
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-0.5">Padding</label>
                              <input type="text" value={formData.rc_padding}
                                onChange={e => set('rc_padding', e.target.value)}
                                placeholder="5px" className="w-28 p-1.5 border rounded text-xs" />
                            </div>
                          </div>
                        </details>

                        {/* ── Advanced: OS Overrides ── */}
                        <details className="border rounded-lg">
                          <summary className="px-3 py-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                            🖥️ Advanced — OS Overrides
                          </summary>
                          <div className="px-3 pb-3 pt-2 space-y-2">
                            <label className="flex items-center gap-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={formData.rc_osEnabled}
                                onChange={e => set('rc_osEnabled', e.target.checked)} />
                              Enable OS-specific margin adjustments
                            </label>
                            {formData.rc_osEnabled && (
                              <table className="w-full text-xs border rounded overflow-hidden">
                                <thead className="bg-gray-100">
                                  <tr>
                                    <th className="p-2 text-left">OS</th>
                                    <th className="p-2 text-left">HTML Bottom</th>
                                    <th className="p-2 text-left">Feed Lines</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {[
                                    { label: '🍎 macOS', hk: 'rc_macHtmlBottom', fk: 'rc_macThermalFeed' },
                                    { label: '🪟 Windows', hk: 'rc_windowsHtmlBottom', fk: 'rc_windowsThermalFeed' },
                                    { label: '🐧 Linux', hk: 'rc_linuxHtmlBottom', fk: 'rc_linuxThermalFeed' },
                                  ].map(row => (
                                    <tr key={row.hk} className="border-t">
                                      <td className="p-2">{row.label}</td>
                                      <td className="p-2">
                                        <input type="text"
                                          value={(formData as any)[row.hk]}
                                          onChange={e => set(row.hk as keyof EventFormState, e.target.value as any)}
                                          className="w-20 p-1 border rounded text-xs" />
                                      </td>
                                      <td className="p-2">
                                        <input type="number" min={0} max={20}
                                          value={(formData as any)[row.fk]}
                                          onChange={e => set(row.fk as keyof EventFormState, Number(e.target.value) as any)}
                                          className="w-16 p-1 border rounded text-xs" />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </details>

                        {/* ── Advanced: Thermal ── */}
                        <details className="border rounded-lg">
                          <summary className="px-3 py-2 text-xs font-semibold text-gray-600 cursor-pointer select-none">
                            🖨️ Advanced — Thermal / ESC-POS
                          </summary>
                          <div className="px-3 pb-3 pt-2 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Chars / Line</label>
                                <select value={formData.rc_charsPerLine}
                                  onChange={e => set('rc_charsPerLine', Number(e.target.value))}
                                  className="w-full p-2 border rounded text-xs">
                                  <option value={44}>44 (80mm)</option>
                                  <option value={40}>40 (80mm wide)</option>
                                  <option value={32}>32 (58mm)</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Left Margin Sp.</label>
                                <input type="number" min={0} max={10} value={formData.rc_leftMarginSpaces}
                                  onChange={e => set('rc_leftMarginSpaces', Number(e.target.value))}
                                  className="w-full p-2 border rounded text-xs" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Bottom Feed Lines</label>
                                <input type="number" min={0} max={20} value={formData.rc_bottomFeedLines}
                                  onChange={e => set('rc_bottomFeedLines', Number(e.target.value))}
                                  className="w-full p-2 border rounded text-xs" />
                              </div>
                            </div>
                            <p className="text-[11px] text-gray-400">
                              The two alignment settings below apply to both thermal/ESC-POS
                              printing AND the browser/HTML print fallback.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Info Block Alignment</label>
                                <select value={formData.rc_infoAlignment}
                                  onChange={e => set('rc_infoAlignment', e.target.value as EventFormState['rc_infoAlignment'])}
                                  className="w-full p-2 border rounded text-xs">
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-0.5">Payment Block Alignment</label>
                                <select value={formData.rc_paymentAlignment}
                                  onChange={e => set('rc_paymentAlignment', e.target.value as EventFormState['rc_paymentAlignment'])}
                                  className="w-full p-2 border rounded text-xs">
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </details>

                      </div>
                    )}
                  </div>
                )}
                {/* end accordion */}

              </div>

              {/* Sticky submit */}
              <div className="sticky bottom-0 border-t bg-white px-4 py-3 flex gap-3">
                <button type="button" onClick={closeModal}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 text-sm font-semibold">
                  Cancel
                </button>
                <button type="submit"
                  disabled={!formData.eventName.trim() || !formData.eventType.trim() || !formData.location.trim() || !formData.startDate || !formData.endDate}
                  className="flex-1 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm (disabled — see handleDeleteClick) ── */}
      {false && showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-red-500 text-4xl mb-4">🗑</div>
            <h3 className="text-lg font-semibold mb-2">Delete Event?</h3>
            <p className="text-gray-600 mb-6 text-sm">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletingId(null); }}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg font-semibold hover:bg-gray-200">Cancel</button>
              <button onClick={handleDeleteConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg font-semibold hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <h3 className="text-lg font-semibold mb-2">Done!</h3>
            <p className="text-gray-600 mb-4 text-sm">{successMessage}</p>
            <button onClick={() => setShowSuccessModal(false)}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700">OK</button>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {showErrorModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-2xl text-center">
            <div className="text-red-600 text-4xl mb-4">✗</div>
            <h3 className="text-lg font-semibold mb-2">Error</h3>
            <p className="text-gray-600 mb-4 text-sm">{errorMessage}</p>
            <button onClick={() => setShowErrorModal(false)}
              className="bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700">OK</button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
