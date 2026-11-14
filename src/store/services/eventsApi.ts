import { createApi } from '@reduxjs/toolkit/query/react';
import { sharedBaseQuery } from './baseQuery';
import { EVENTS, EVENTS_SMALL } from '../types/events';
import type { EventItem } from '../types/events';

export const eventsApi = createApi({
    reducerPath: 'eventsApi',
    baseQuery: sharedBaseQuery,
    tagTypes: [EVENTS],
    endpoints: (builder) => ({
        getEvents: builder.query<EventItem[], void>({
            query: () => EVENTS_SMALL,
            providesTags: [EVENTS],
        }),
        createEvent: builder.mutation<EventItem, Partial<EventItem>>({
            query: (newEvent) => ({
                url: EVENTS_SMALL,
                method: 'POST',
                body: newEvent,
            }),
            invalidatesTags: [EVENTS],
        }),
        updateEvent: builder.mutation<EventItem, { id: number | string; data: Partial<EventItem> }>({
            query: ({ id, data }) => ({
                url: `${EVENTS_SMALL}/${id}`,
                method: 'PUT',
                body: data,
            }),
            // Invalidating EVENTS causes the event list to refetch.
            // Receipt config cache in Redux is cleared separately via
            // dispatch(clearEventConfig()) in events/page.tsx after update succeeds.
            invalidatesTags: [EVENTS],
        }),
        getEventById: builder.query<EventItem, { id: number | string }>({
            query: ({ id }) => ({
                url: `${EVENTS_SMALL}/${id}`,
                method: 'GET',
            }),
        }),
        deleteEvent: builder.mutation<{ success: boolean }, number | string>({
            query: (id) => ({
                url: `${EVENTS_SMALL}/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: [EVENTS],
        }),
    }),
});

export const {
    useGetEventsQuery,
    useCreateEventMutation,
    useUpdateEventMutation,
    useDeleteEventMutation,
} = eventsApi;
