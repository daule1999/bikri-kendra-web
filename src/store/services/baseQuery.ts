/**
 * PHASE 1 COMPAT — RTK Query base query for legacy Redux services.
 * Credentials are HttpOnly cookies handled by the Worker; the event comes from the shared
 * core store. A 401 means the session is gone → log out.
 */
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { apiFetch } from '@/core/api/secure-fetch';
import { authService } from '@/core/auth/auth-service';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { API_BASE_PATH, HEADERS, ROUTES } from '@/core/config';
import { purgeSession } from '../slices/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_PATH}/`,
  fetchFn: (input, init) => apiFetch(input as string | Request, init),
  prepareHeaders: (headers) => {
    headers.set('accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    const eventId = activeEventStore.get()?.id;
    if (eventId) headers.set(HEADERS.eventId, eventId);
    return headers;
  },
});

export const sharedBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);
  // Cookie session: the Worker refreshes tokens itself, so a 401 means the session is gone.
  if (result.error?.status === 401) {
    authService.logout();
    api.dispatch(purgeSession());
    if (typeof window !== 'undefined') window.location.href = ROUTES.login;
  }
  return result;
};
