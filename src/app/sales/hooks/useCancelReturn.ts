import { useState } from 'react';

export function useCancelReturn() {
    const [cancelOrderNo, setCancelOrderNo] = useState('');
    const [cancelInvoiceNo, setCancelInvoiceNo] = useState('');
    const [cancelLookupResult, setCancelLookupResult] = useState<any>(null);
    const [cancelLookupLoading, setCancelLookupLoading] = useState(false);
    const [cancelLookupError, setCancelLookupError] = useState('');
    const [cancelAction, setCancelAction] = useState<'CANCEL' | 'RETURN'>('CANCEL');
    const [cancelReason, setCancelReason] = useState('');
    const [cancelSubmitting, setCancelSubmitting] = useState(false);
    const [cancelSuccess, setCancelSuccess] = useState('');
    const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
    // Set to true to have CancelReturnTab fire handleLookup() automatically once
    // (e.g. when arriving pre-filled from the Billing page's Edit link). The tab
    // resets it back to false immediately after triggering the lookup.
    const [triggerAutoLookup, setTriggerAutoLookup] = useState(false);

    return {
        cancelOrderNo, setCancelOrderNo,
        cancelInvoiceNo, setCancelInvoiceNo,
        cancelLookupResult, setCancelLookupResult,
        cancelLookupLoading, setCancelLookupLoading,
        cancelLookupError, setCancelLookupError,
        cancelAction, setCancelAction,
        cancelReason, setCancelReason,
        cancelSubmitting, setCancelSubmitting,
        cancelSuccess, setCancelSuccess,
        returnQtys, setReturnQtys,
        triggerAutoLookup, setTriggerAutoLookup
    };
}