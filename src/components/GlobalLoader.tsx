'use client';

import { useGetEventsQuery } from '@/store/services/eventsApi';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

export default function GlobalLoader() {
  const [isCustomLoading, setIsCustomLoading] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Synchronize token state with mount state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAuthReady(localStorage.getItem('hasSession') === '1');
    }
  }, []);

  // Pass skip parameter here to avoid starting a rogue background API flight
  const { isLoading: isLoadingEvent, isFetching: isFetchingEvent } = useGetEventsQuery(undefined, {
    skip: !isAuthReady,
  });

  useEffect(() => {
    const handleLoadingState = (e: Event) => {
      const customEvent = e as CustomEvent<{ isLoading: boolean; count: number }>;
      if (customEvent.detail) {
        setIsCustomLoading(customEvent.detail.isLoading);
        setActiveCount(customEvent.detail.count);
      }
    };

    window.addEventListener('api-loading-state', handleLoadingState);
    return () => window.removeEventListener('api-loading-state', handleLoadingState);
  }, []);

  const shouldShowLoader = isLoadingEvent || isFetchingEvent || isCustomLoading;

  if (!shouldShowLoader) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/20 backdrop-blur-sm pointer-events-auto select-none animate-fade-in">
      {/* 1. Sleek top progress loading bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px] w-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
        <div
          className="h-full w-full animate-shimmer"
          style={{
            background: 'linear-gradient(90deg, #4f46e5 0%, #818cf8 50%, #4f46e5 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear',
          }}
        />
      </div>

      {/* 2. Spinner — floats in the overlay, no card/box */}
      <div className="flex items-center gap-2 animate-scale-in">
        <Spinner size="md" color="#4f46e5" />
        {activeCount > 1 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
            style={{ background: '#4f46e5', color: '#fff' }}
          >
            {activeCount}
          </span>
        )}
      </div>

      {/* CSS Shimmer Keyframe definition fallback just in case */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
}
