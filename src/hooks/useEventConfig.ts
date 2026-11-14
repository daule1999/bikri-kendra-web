'use client';

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiClient } from '@/lib/api';
import { DEFAULT_RECEIPT_CONFIG, ReceiptEventConfig } from '@/lib/recieptConfig';
import {
    setEventConfig,
    clearEventConfig,
    selectEventConfig,
    selectEventConfigFetched,
    selectCachedEventId,
    selectEventConfigFetchedAt,
    CACHE_TTL_MS,
} from '@/store/slices/eventConfigSlice';
import { useActiveEvent } from './useActiveEvent';

export interface EventConfigResult {
    receiptConfig: ReceiptEventConfig;
    isFetched: boolean;
    refetch: () => void;
}

/**
 * Cache-first hook for event receipt configuration.
 *
 * - Reads from Redux on every render — zero API calls once cached.
 * - Fetches /api/sales-svc/events/{eventId} exactly ONCE per event per session.
 * - Automatically clears and re-fetches when the active event changes.
 *
 * shopName and orgName are NOT returned here — they come from the billing shop
 * at print time via resolveShopInfo(bill.shopId, assignedShops).
 */
export function useEventConfig(): EventConfigResult {
    const dispatch = useDispatch();
    const { eventId } = useActiveEvent();

    const cachedEventId = useSelector(selectCachedEventId);
    const isFetched = useSelector(selectEventConfigFetched);
    const fetchedAt = useSelector(selectEventConfigFetchedAt);
    const receiptConfig = useSelector(selectEventConfig);

    const fetchConfig = useCallback(async () => {
        if (!eventId) return;
        try {
            const res = await apiClient.get(`/events/${eventId}`);
            if (!res.ok) {
                console.warn('[useEventConfig] fetch failed, using defaults');
                return;
            }
            const data = await res.json();
            dispatch(setEventConfig({
                eventId: String(eventId),
                receiptConfig: data.receiptConfig || DEFAULT_RECEIPT_CONFIG,
            }));
        } catch (err) {
            console.error('[useEventConfig] Error:', err);
        }
    }, [eventId, dispatch]);

    useEffect(() => {
        if (!eventId) return;
        const isStale = cachedEventId !== String(eventId);
        const isExpired = !fetchedAt || (Date.now() - fetchedAt > CACHE_TTL_MS);
        if (isFetched && !isStale && !isExpired) return;
        if (isStale) dispatch(clearEventConfig());
        fetchConfig();
    }, [eventId, isFetched, cachedEventId, fetchedAt, fetchConfig, dispatch]);

    return { receiptConfig, isFetched, refetch: fetchConfig };
}
