'use client';

import { formatISTDate } from '@/lib/dateUtils';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';

import { useGetEventsQuery } from '@/store/services/eventsApi';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { selectIsSystemAdmin } from '@/store/slices/authSlice';
import { setEventConfig } from '@/store/slices/eventConfigSlice';
import { DEFAULT_RECEIPT_CONFIG } from '@/lib/recieptConfig';
import { EventItem } from '@/store/types/events';
import { ContentLoader } from '@/components/ui/ContentLoader';

function SelectEventContent() {
  const router     = useRouter();
  const dispatch   = useDispatch();
  const searchParams = useSearchParams();
  const { selectEvent } = useActiveEvent();

  // 1. Fetching straight from RTK Query Global Cache Layer
  const { data: eventsList = [], isLoading, error: queryError } = useGetEventsQuery();

  // 2. Fetch admin permission flag directly from Redux Store
  const isAdminUser = useSelector(selectIsSystemAdmin);

  // 3. DERIVE AND SORT THE DATA ON EVERY RENDER (Replaces useState + useEffect loop)
  const events = [...eventsList].sort((a: EventItem, b: EventItem) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;

    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return dateB - dateA; // descending chronologically
  });

  // 4. CHRONOLOGICAL AUTO-SELECTION LOGIC (Only runs once onboarding checks validate)
  useEffect(() => {
    if (isLoading || queryError || !eventsList) return;

    if (eventsList.length === 0 && isAdminUser) {
      console.log('[SelectEventPage] No events found and user is Admin. Redirecting to Event Management.');
      router.push('/events');
      return;
    }

    // Filter active events for potential auto-selection
    const activeEvents = eventsList.filter((e: EventItem) => e.isActive);
    const isManual = searchParams.get('manual') === 'true';

    if (activeEvents.length > 0 && !isManual) {
      // Sort active events by priority rules to find the single best candidate workspace
      const prioritized = [...activeEvents].sort((a, b) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getDiff = (dateStr?: string) => {
          if (!dateStr) return null;
          const d = new Date(dateStr);
          d.setHours(0, 0, 0, 0);
          return d.getTime() - today.getTime();
        };

        const diffA = getDiff(a.startDate);
        const diffB = getDiff(b.startDate);

        if (diffA === null && diffB === null) return 0;
        if (diffA === null) return 1;
        if (diffB === null) return -1;

        // Priority 1: Today's event wins
        if (diffA === 0 && diffB !== 0) return -1;
        if (diffB === 0 && diffA !== 0) return 1;

        // Priority 2: Future events win over past events
        if (diffA > 0 && diffB < 0) return -1;
        if (diffB > 0 && diffA < 0) return 1;

        // Priority 3: Both in future (closer future event wins)
        if (diffA > 0 && diffB > 0) return diffA - diffB;

        // Priority 4: Both in past (closer past event wins)
        if (diffA < 0 && diffB < 0) return Math.abs(diffA) - Math.abs(diffB);

        return 0;
      });

      // Auto-select the highest prioritized workspace candidate
      const bestCandidate = prioritized[0];
      if (bestCandidate) {
        console.log(`[SelectEventPage] Relevance auto-select triggered: "${bestCandidate.eventName}"`);
        selectEvent(bestCandidate);
        router.push('/dashboard');
      }
    }
  }, [eventsList, isLoading, queryError, isAdminUser, searchParams, router, selectEvent]);

  const handleSelectEvent = (event: EventItem) => {
    selectEvent(event);
    // Pre-warm the event config cache so the Sales / Billing pages make zero
    // extra API calls on first render — receiptConfig travels with the event.
    if (event.receiptConfig) {
      dispatch(setEventConfig({
        eventId:       String(event.id),
        receiptConfig: event.receiptConfig || DEFAULT_RECEIPT_CONFIG,
      }));
    }
    router.push('/dashboard');
  };

  const displayError = queryError
    ? ((queryError as any)?.data?.message || 'Could not load event workspaces.')
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-2">Select an Event</h1>
          <p className="text-slate-400 text-lg">Choose the event you want to work with today</p>
        </div>

        {/* Loading Spinner */}
        {isLoading && <ContentLoader message="Loading events..." />}

        {/* Error Notification */}
        {displayError && (
          <div className="bg-red-900/40 border border-red-500 rounded-xl p-4 text-red-300 text-center">
            {displayError}
          </div>
        )}

        {/* Empty Layout Fallback */}
        {!isLoading && !displayError && events.length === 0 && (
          <div className="text-center text-slate-400 py-12 space-y-4">
            <p className="text-xl">No events available.</p>
            <div className="space-y-4 max-w-md mx-auto">
              <p className="text-sm text-slate-500">
                You can create and manage events to set up the system.
              </p>
              <button
                onClick={() => router.push('/events')}
                className="px-6 py-2.5 rounded-xl font-bold text-white transition-all bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 shadow-lg shadow-amber-500/20"
              >
                Create Event
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Interactive Event Multi-Tenant Grid Layout */}
        {!isLoading && !displayError && events.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => handleSelectEvent(event)}
                disabled={!event.isActive}
                className={`
                  group relative text-left rounded-2xl p-6 border transition-all duration-200
                  ${event.isActive
                    ? 'bg-white/5 border-white/10 hover:bg-purple-500/20 hover:border-purple-400/50 hover:scale-[1.02] cursor-pointer'
                    : 'bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed'
                  }
                `}
              >
                {/* Status badge */}
                <span className={`
                  absolute top-4 right-4 text-xs font-semibold px-2 py-0.5 rounded-full
                  ${event.isActive ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'}
                `}>
                  {event.isActive ? 'Active' : 'Inactive'}
                </span>

                <div className="mb-3">
                  <p className="text-xs font-medium text-purple-400 uppercase tracking-widest mb-1">
                    {event.eventType ?? 'Event'}
                  </p>
                  <h2 className="text-xl font-bold text-white group-hover:text-purple-200 transition-colors">
                    {event.eventName}
                  </h2>
                </div>

                {event.location && (
                  <p className="text-sm text-slate-400 mb-2">📍 {event.location}</p>
                )}

                {(event.startDate || event.endDate) && (
                  <p className="text-xs text-slate-500">
                    {event.startDate ? formatISTDate(event.startDate) : '—'}
                    {' → '}
                    {event.endDate ? formatISTDate(event.endDate) : '—'}
                  </p>
                )}

                {event.isActive && (
                  <div className="mt-4 flex items-center gap-2 text-purple-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Select Event</span>
                    <span>→</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SelectEventPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-lg">
        Loading...
      </div>
    }>
      <SelectEventContent />
    </Suspense>
  );
}
