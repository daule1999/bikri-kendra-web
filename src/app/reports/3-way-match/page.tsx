'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useActiveEvent } from '@/hooks/useActiveEvent';
import { ContentLoader } from '@/components/ui/ContentLoader';

interface MatchItem {
  productId: number;
  productName: string;
  expectedSalesQty: number;
  actualInventoryDepletedQty: number;
  expectedSalesAmount: number;
  actualFinancialsCollected: number;
  qtyVariance: number;
  financialVariance: number;
}

interface ThreeWayMatchData {
  eventId: number;
  totalVarianceAmount: number;
  items: MatchItem[];
}

export default function ThreeWayMatchPage() {
  const [data, setData] = useState<ThreeWayMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { eventId } = useActiveEvent();

  useEffect(() => {
    if (!eventId) return;

    setLoading(true);
    setError(null);
    apiClient.get(`/reports/3-way-match/${eventId}`)
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
        console.error("Failed to load 3-way match:", err);
        setError("Failed to load 3-way match data. Please try again later.");
      })
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) {
    return <ContentLoader message="Loading 3-way match report..." />;
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
            <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
              <Link href="/reports/master-settlement" className="hover:text-indigo-600 transition">Master Settlement</Link>
              <span>/</span>
              <span className="text-gray-900 font-medium">3-Way Match</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Comprehensive 3-Way Match</h1>
            <p className="text-gray-500 mt-2">Variance Drill-down for Event ID: {data?.eventId}</p>
          </div>
          <div className="w-full md:w-auto bg-white px-6 py-3 rounded-lg shadow-sm border border-red-100 flex justify-between md:justify-start items-center space-x-4">
            <span className="text-sm font-medium text-gray-500">Total Variance</span>
            <span className="text-2xl font-bold text-red-600">₹{data?.totalVarianceAmount.toFixed(2)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="font-semibold text-gray-800">Item Level Reconciliation</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-white">
                <tr>
                  <th rowSpan={2} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50/50 align-bottom">Sn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50/50">Product</th>
                  <th colSpan={3} className="px-6 py-3 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider border-l border-r border-gray-200 bg-indigo-50/30">Quantity (Units)</th>
                  <th colSpan={3} className="px-6 py-3 text-center text-xs font-bold text-emerald-600 uppercase tracking-wider bg-emerald-50/30">Financials (₹)</th>
                </tr>
                <tr className="border-t border-gray-200">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name (ID)</th>

                  {/* Quantity Sub-headers */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">Sales Record</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Inv Depleted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">Variance</th>

                  {/* Financials Sub-headers */}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Collected</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.items.map((item, idx) => (
                  <tr key={item.productId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{idx + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{item.productName}</div>
                      <div className="text-xs text-gray-500">ID: {item.productId}</div>
                    </td>
                    
                    {/* Quantity Columns */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right border-l border-gray-100">{item.expectedSalesQty}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{item.actualInventoryDepletedQty}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right border-r border-gray-100 ${item.qtyVariance !== 0 ? 'text-red-600 bg-red-50/50' : 'text-green-600'}`}>
                      {item.qtyVariance}
                    </td>
                    
                    {/* Financials Columns */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">₹{item.expectedSalesAmount.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">₹{item.actualFinancialsCollected.toFixed(2)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${item.financialVariance > 0 ? 'text-red-600 bg-red-50/50' : 'text-green-600'}`}>
                      ₹{item.financialVariance.toFixed(2)}
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
