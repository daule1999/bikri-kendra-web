/**
 * PHASE 1 COMPAT — RTK Query base query for legacy Redux services.
 * Token and event come from the shared core stores (not Redux state), so a
 * background token refresh is picked up immediately; on 401 it refreshes once
 * and retries before logging out.
 */
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { apiFetch } from '@/core/api/secure-fetch';
import { authService } from '@/core/auth/auth-service';
import { sessionStore } from '@/core/auth/session-store';
import { activeEventStore } from '@/core/tenant/active-event-store';
import { API_BASE_PATH, HEADERS, ROUTES } from '@/core/config';
import { purgeSession } from '../slices/authSlice';

const rawBaseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_PATH}/`,
  fetchFn: (input, init) => apiFetch(input as string | Request, init),
  prepareHeaders: (headers) => {
    headers.set('accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    const token = sessionStore.get()?.accessToken;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const eventId = activeEventStore.get()?.id;
    if (eventId) headers.set(HEADERS.eventId, eventId);
    return headers;
  },
});

export const sharedBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  if (result.error?.status === 401 && (await authService.refresh())) {
    result = await rawBaseQuery(args, api, extraOptions);
  }
  if (result.error?.status === 401) {
    api.dispatch(purgeSession());
    if (typeof window !== 'undefined') window.location.href = ROUTES.login;
  }
  return result;
};
