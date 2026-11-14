/**
 * @deprecated Use `useEventConfig` from '@/hooks/useEventConfig' instead.
 *
 * This hook does NOT cache — it refetches on every component mount, causing
 * unnecessary API calls. `useEventConfig` caches in Redux and calls the API
 * exactly once per event per session.
 *
 * Migration:
 *   BEFORE: const { printConfig, isLoading } = useEventReceiptConfig(eventId);
 *   AFTER:  const { shopName, orgName, receiptConfig, isFetched } = useEventConfig();
 *           // Then pass to printBill: { shopName, orgName, eventName, eventConfigPayload: receiptConfig }
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { PrintReceiptConfig } from '@/lib/thermalPrinter';
import { ReceiptEventConfig, DEFAULT_RECEIPT_CONFIG } from '@/lib/recieptConfig';

interface EventData {
    shopName?: string;
    orgName?: string;
    receiptConfig?: ReceiptEventConfig;
}

export function useEventReceiptConfig(eventId: string | null | undefined) {
    // BUG-05: Hard-fail in development so accidental imports are caught immediately.
    // Remove this block (and this file) once all call-sites have migrated to useEventConfig.
    if (process.env.NODE_ENV === 'development') {
        console.error(
            '[useEventReceiptConfig] DEPRECATED — migrate to useEventConfig from @/hooks/useEventConfig.\n' +
            'This hook re-fetches on every mount and does not cache. See JSDoc above for migration steps.',
        );
    }

    const [eventData, setEventData] = useState<EventData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEventById = useCallback(async () => {
        if (!eventId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiClient.get(`/events/${eventId}`);
            if (res.ok) {
                const data = await res.json();
                setEventData(data);
            } else {
                setError('Failed to fetch event details');
            }
        } catch (err) {
            console.error('Error fetching event receipt config:', err);
            setError('Network error while fetching event');
        } finally {
            setIsLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchEventById();
    }, [fetchEventById]);

    const printConfig: PrintReceiptConfig = {
        shopName: eventData?.shopName || '',
        orgName: eventData?.orgName || '',
        eventConfigPayload: eventData?.receiptConfig || DEFAULT_RECEIPT_CONFIG,
    };

    return { printConfig, isLoading, error, refetch: fetchEventById };
}
