'use client';

import { useState, useEffect } from 'react';
import { ContentLoader } from '@/components/ui/ContentLoader';

interface LiveTallyData {
  shopId: number;
  expectedCashInTill: number;
  inventoryValueDepleted: number;
  varianceAlert: string;
}

export default function LiveTallyPage() {
  const [data, setData] = useState<LiveTallyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock fetch from /api/v1/reports/live-tally/{shopId}
    setTimeout(() => {
      setData({
        shopId: 1,
        expectedCashInTill: 4320.00,
        inventoryValueDepleted: 4400.00,
        varianceAlert: 'SHORTAGE'
      });
      setLoading(false);
    }, 600);
  }, []);

  if (loading) {
    return <ContentLoader message="Loading live tally..." />;
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black tracking-tight text-white mb-2">Live Tally-Up</h1>
          <p className="text-gray-400">Cashier terminal verification for Till A (Shop {data?.shopId})</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
          <div className="space-y-8">
            <div>
              <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Total Inventory Value Depleted</p>
              <p className="text-5xl font-light text-gray-300">₹{data?.inventoryValueDepleted.toFixed(2)}</p>
            </div>

            <div className="pt-8 border-t border-gray-700">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-widest mb-1">Expected Cash In Till</p>
              <p className="text-6xl font-black text-emerald-400">₹{data?.expectedCashInTill.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-2">Does not include active transaction or unconfirmed drops.</p>
            </div>

            {data && data.varianceAlert === 'SHORTAGE' && (
              <div className="mt-8 bg-red-900/50 border border-red-500/50 rounded-lg p-6">
                <h3 className="text-xl font-bold text-red-400 flex items-center">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                  </svg>
                  Warning: Potential Shortage
                </h3>
                <p className="text-red-200 mt-2">
                  Inventory depletion value (₹{data.inventoryValueDepleted.toFixed(2)}) is higher than expected cash (₹{data.expectedCashInTill.toFixed(2)}).
                  Please verify if a cash drop was missed or an item was given out without scanning.
                </p>
                <button className="mt-4 bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded font-medium transition w-full">
                  Request Supervisor Override
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
