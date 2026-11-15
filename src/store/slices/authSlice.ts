import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { AuthState } from '../types/auth';
import { EventItem } from '../types/events';
import { setBooleanCookie, setStringCookie } from '@/lib/cookies';
import { sessionStore } from '@/core/auth/session-store';

// PHASE 1 COMPAT: reducers below write localStorage directly; tell the core
// session store to re-read after the current dispatch finishes.
const syncCore = () => { if (typeof window !== 'undefined') queueMicrotask(() => sessionStore.sync()); };

// SSR protection initial fallback helper since Next.js processes partial code during server builds
const getStorageItem = (key: string): string | null => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
    }
    return null;
};

const initialState: AuthState = {
    // The real tokens are HttpOnly cookies; Redux only tracks whether a session exists.
    accessToken: getStorageItem('hasSession') === '1' ? 'cookie-session' : null,
    username: getStorageItem('username'),
    userRole: getStorageItem('userRole'),
    activeEventId: getStorageItem('active_event_id'),
    activeEventName: getStorageItem('active_event_name'),
    activeEvent: null, // Populated upon manual selection or bootstrap
    // localStorage stores strings, so we parse the raw value explicitly
    mustResetPassword: getStorageItem('mustResetPassword') === 'true'
        ? true
        : getStorageItem('mustResetPassword') === 'false'
            ? false
            : null,
};

// Backfill the routing cookies from whatever is already in localStorage.
// Needed the first time this code runs on a browser that logged in *before*
// middleware.ts existed — without this, a pre-existing valid session would
// have no has_session cookie yet and middleware would wrongly redirect it
// to '/' on the next protected-page load. Cheap and idempotent: runs once
// per module load and just re-asserts the current truth each time.
if (typeof window !== 'undefined') {
    setBooleanCookie('has_session', !!initialState.accessToken);
    setBooleanCookie('must_reset', initialState.mustResetPassword === true);
    setStringCookie('session_username', initialState.username);
    setStringCookie('session_role', initialState.userRole);
}

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        // Invoke immediately upon completing your Login Handshake
        setSession: (state, action: PayloadAction<{ username: string; userRole: string; mustResetPassword?: boolean }>) => {
            syncCore();
            state.accessToken = 'cookie-session';
            state.username = action.payload.username;
            state.userRole = action.payload.userRole;
            // Default to false when not provided (e.g. token refresh paths)
            state.mustResetPassword = action.payload.mustResetPassword ?? false;

            localStorage.setItem('hasSession', '1');
            localStorage.setItem('username', action.payload.username);
            localStorage.setItem('userRole', action.payload.userRole);
            // Store as string — localStorage only supports strings
            localStorage.setItem('mustResetPassword', String(action.payload.mustResetPassword ?? false));

            // Mirror into routing cookies so middleware.ts can redirect
            // server-side on the next load instead of RouteGuard blocking
            // client-side render.
            setBooleanCookie('has_session', true);
            setBooleanCookie('must_reset', action.payload.mustResetPassword ?? false);
            setStringCookie('session_username', action.payload.username);
            setStringCookie('session_role', action.payload.userRole);
        },

        // Tenant Selection Module — Handles Multi-Tenant persistence and updates Redux memory
        setTenantEvent: (state, action: PayloadAction<EventItem>) => {
            const stringId = String(action.payload.id);
            state.activeEventId = stringId;
            state.activeEventName = action.payload.eventName;
            state.activeEvent = action.payload;

            localStorage.setItem('active_event_id', stringId);
            localStorage.setItem('active_event_name', action.payload.eventName);
        },

        // Clears workspace variables to safely switch events or log out
        clearTenantEvent: (state) => {
            state.activeEventId = null;
            state.activeEventName = null;
            state.activeEvent = null;

            localStorage.removeItem('active_event_id');
            localStorage.removeItem('active_event_name');
        },

        // Silent access-token renewal — updates ONLY the token pair, leaving
        // username/userRole/mustResetPassword/tenant selection untouched.
        // Used by lib/tokenRefresh.ts so a background refresh can never
        // accidentally clobber unrelated session state.
        // (token renewal is handled server-side by the Worker; nothing to store here)

        // Mark password reset as complete (called from security page on success)
        clearMustResetPassword: (state) => {
            syncCore();
            state.mustResetPassword = false;
            localStorage.setItem('mustResetPassword', 'false');
            setBooleanCookie('must_reset', false);
        },

        // Clears all authentication footprints from state and browser storage on logout
        purgeSession: (state) => {
            syncCore();
            state.accessToken = null;
            state.username = null;
            state.userRole = null;
            state.activeEventId = null;
            state.activeEventName = null;
            state.activeEvent = null;
            state.mustResetPassword = null;

            localStorage.clear();
            setBooleanCookie('has_session', false);
            setBooleanCookie('must_reset', false);
            setStringCookie('session_username', null);
            setStringCookie('session_role', null);
        }
    }
});

export const { setSession, setTenantEvent, clearTenantEvent, clearMustResetPassword, purgeSession } = authSlice.actions;

// ─── Highly Optimized Selectors ─────────────────────────────────────────────
export const selectCurrentTenantId = (state: RootState) => state.auth.activeEventId;
export const selectCurrentTenantName = (state: RootState) => state.auth.activeEventName || 'No Event Selected';
export const selectActiveEventData = (state: RootState) => state.auth.activeEvent;
export const selectIsAuthenticated = (state: RootState) => !!state.auth.accessToken;
export const selectUserRole = (state: RootState) => state.auth.userRole;
export const selectUsername = (state: RootState) => state.auth.username;

/**
 * SINGLE SOURCE OF TRUTH FOR SYSTEM ADMINISTRATIVE PRIVILEGES
 * Computes whether the current session is an admin context using centralized rules.
 * Eliminates scattered string evaluations and manual disk checks throughout the app UI.
 */
export const selectMustResetPassword = (state: RootState) => state.auth.mustResetPassword;

export const selectIsSystemAdmin = (state: RootState): boolean => {
    const role = state.auth.userRole;
    const username = state.auth.username;

    return !!(
        role === 'ADMIN' ||
        username === 'admin' ||
        username?.endsWith('_admin')
    );
};

export default authSlice.reducer;