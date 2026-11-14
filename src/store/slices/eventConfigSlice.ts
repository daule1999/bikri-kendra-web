'use client';

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { ReceiptEventConfig, DEFAULT_RECEIPT_CONFIG } from '@/lib/recieptConfig';

const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes — re-fetch to pick up config changes

interface EventConfigState {
    eventId:       string | null;
    receiptConfig: ReceiptEventConfig;
    isFetched:     boolean;   // true = API already called for this eventId; use cache
    fetchedAt:     number | null;  // epoch ms — for TTL staleness check
}

const initialState: EventConfigState = {
    eventId:       null,
    receiptConfig: DEFAULT_RECEIPT_CONFIG,
    isFetched:     false,
    fetchedAt:     null,
};

export const eventConfigSlice = createSlice({
    name: 'eventConfig',
    initialState,
    reducers: {
        setEventConfig: (
            state,
            action: PayloadAction<{
                eventId:       string;
                receiptConfig: ReceiptEventConfig;
            }>
        ) => {
            state.eventId       = action.payload.eventId;
            state.receiptConfig = action.payload.receiptConfig;
            state.isFetched     = true;
            state.fetchedAt     = Date.now();
        },

        clearEventConfig: (state) => {
            state.eventId       = null;
            state.receiptConfig = DEFAULT_RECEIPT_CONFIG;
            state.isFetched     = false;
            state.fetchedAt     = null;
        },
    },
});

export const { setEventConfig, clearEventConfig } = eventConfigSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectEventConfig        = (s: RootState) => s.eventConfig.receiptConfig;
export const selectEventConfigFetched = (s: RootState) => s.eventConfig.isFetched;
export const selectCachedEventId      = (s: RootState) => s.eventConfig.eventId;
export const selectEventConfigFetchedAt = (s: RootState) => s.eventConfig.fetchedAt;
export { CACHE_TTL_MS };
