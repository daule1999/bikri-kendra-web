import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { eventsApi } from './services/eventsApi';
import { authSlice } from './slices/authSlice';
import { eventConfigSlice } from './slices/eventConfigSlice';
import type { AuthState } from './types/auth';

/**
 * Factory instead of a module-level singleton. This matters now that
 * StoreProvider seeds per-request SSR data (preloadedAuth, from cookies read
 * in app/layout.tsx): a shared singleton store would risk one user's
 * server-rendered auth state leaking into another concurrent request on the
 * same Node process. Each call creates one fresh, independent store —
 * StoreProvider.tsx creates exactly one per mount via useRef.
 */
export const makeStore = (preloadedAuth?: Partial<AuthState>) => {
    const store = configureStore({
        reducer: {
            auth:        authSlice.reducer,
            eventConfig: eventConfigSlice.reducer,
            [eventsApi.reducerPath]: eventsApi.reducer,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware()
                .concat(eventsApi.middleware),
        ...(preloadedAuth && {
            // Merge onto the slice's own default initial state (which already
            // reads localStorage when running in the browser) rather than
            // replacing it outright, so fields we don't explicitly preload
            // (accessToken, activeEvent, etc.) keep their normal behavior.
            preloadedState: {
                auth: { ...authSlice.getInitialState(), ...preloadedAuth },
            },
        }),
    });

    setupListeners(store.dispatch);
    return store;
};

// Type definitions for use throughout your application
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
