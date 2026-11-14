'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { ContentLoader } from '@/components/ui/ContentLoader';

interface ShopSettlement {
  shopId: number;
  shopName: string;
  expectedAmount: number;
  collectedAmount: number;
  variance: number;
}

interface MasterSettlementData {
  eventId: number;
  eventName: string;
  totalExpectedSales: number;
  totalActualCollected: number;
  totalVariance: number;
  totalItemsSold: number;
  totalItemsDepleted: number;
  shopSettlements: ShopSettlement[];
}

export default function MasterSettlementPage() {
  const [data, setData] = useState<MasterSettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { eventId } = useActiveEvent();

  useEffect(() => {
    if (!eventId) return;
    
    setLoading(true);
    setError(null);
    apiClient.get(`/reports/master-settlement/${eventId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load report data');
        return res.json();
      })
      .then(d => {
        if (d && d.data) {
          setData(d.data);
        } else if (d) {
          setData(d);
        }
      })
      .catch(err => {
        console.error("Failed to load master settlement:", err);
        setError("Failed to load master settlement data. Please try again later.");
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return <ContentLoader message="Loading master settlement..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-red-100 max-w-md w-full text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Report</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Event Master Settlement</h1>
            <p className="text-gray-500 mt-2">{data?.eventName} (ID: {data?.eventId})</p>
          </div>
          <Link href="/reports/3-way-match" className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm font-medium">
            View 3-Way Match Drilldown
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Expected Sales</h3>
            <p className="text-3xl font-bold text-gray-900">₹{data?.totalExpectedSales.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Total Actual Collected</h3>
            <p className="text-3xl font-bold text-gray-900">₹{data?.totalActualCollected.toFixed(2)}</p>
          </div>
          <div className={`bg-white rounded-xl shadow-sm p-6 border ${data && data.totalVariance > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <h3 className={`text-sm font-medium mb-1 ${data && data.totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>Total Variance</h3>
            <p className={`text-3xl font-bold ${data && data.totalVariance > 0 ? 'text-red-700' : 'text-green-700'}`}>
              ₹{data?.totalVariance.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Shop Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shop Name</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.shopSettlements.map((shop, idx) => (
                  <tr key={shop.shopId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{shop.shopName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">₹{shop.expectedAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">₹{shop.collectedAmount.toFixed(2)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${shop.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{shop.variance.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
