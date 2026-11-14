'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ContentLoader } from '@/components/ui/ContentLoader';

interface LiveSnapshotData {
  shopId: number;
  status: string;
  inventoryDepleted: number;
  salesRegistered: number;
  currentVariance: number;
}

export default function LiveSnapshotPage() {
  const [data, setData] = useState<LiveSnapshotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, you would fetch from /api/v1/reports/live-snapshot/{shopId}
    setTimeout(() => {
      setData({
        shopId: 1,
        status: 'ACTIVE',
        inventoryDepleted: 150,
        salesRegistered: 145,
        currentVariance: -5
      });
      setLoading(false);
    }, 800);
  }, []);

  if (loading) {
    return <ContentLoader message="Loading live snapshot..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Snapshot</h1>
            <p className="text-gray-500 mt-2">Real-time delta for Shop ID: {data?.shopId}</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <span className="text-sm font-medium text-gray-600">Live Sync</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Inventory Depleted</h3>
            <p className="text-5xl font-black text-gray-800">{data?.inventoryDepleted}</p>
            <p className="text-xs text-gray-400 mt-2">Physical items missing from stock</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-center">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Sales Registered</h3>
            <p className="text-5xl font-black text-indigo-600">{data?.salesRegistered}</p>
            <p className="text-xs text-gray-400 mt-2">Items rung up in POS</p>
          </div>

          <div className={`rounded-xl shadow-sm p-6 border text-center ${data && data.currentVariance < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
            <h3 className={`text-sm font-medium mb-2 ${data && data.currentVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>Current Variance</h3>
            <p className={`text-5xl font-black ${data && data.currentVariance < 0 ? 'text-red-700' : 'text-green-700'}`}>{data?.currentVariance}</p>
            <p className={`text-xs mt-2 ${data && data.currentVariance < 0 ? 'text-red-500' : 'text-green-500'}`}>Items unaccounted for</p>
          </div>
        </div>

        {data && data.currentVariance < 0 && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Action Required</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>There is a real-time discrepancy of {Math.abs(data.currentVariance)} items. We recommend conducting a mid-shift spot check to verify physical stock against POS receipts.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
