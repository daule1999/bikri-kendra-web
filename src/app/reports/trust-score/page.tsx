'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { config } from '@/lib/config';
import { useUser } from '@/hooks/useUser';
import { ContentLoader } from '@/components/ui/ContentLoader';

interface TrustScoreData {
  userId: number;
  trustScore: number;
  historicalVariances: number;
  status: string;
  firstName?: string;
  lastName?: string;
}

export default function OperatorTrustScorePage() {
  const [data, setData] = useState<TrustScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const { user } = useUser();

  useEffect(() => {
    if (!user || !user.username) return;

    setLoading(true);
    setError(null);
    
    // First fetch the user details to get the ID and Name
    apiClient.get(`/users/${user.username}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load user details');
        return res.json();
      })
      .then(userData => {
        const fullUser = userData.data || userData;
        // Now fetch trust score using ID
        return apiClient.get(`${config.endpoints.REPORTS_TRUST_SCORE}/${fullUser.id}`)
          .then(res => {
            if (!res.ok) throw new Error('Failed to load trust score');
            return res.json();
          })
          .then(d => {
            setData({
              ...d.data || d,
              firstName: fullUser.firstName || user.username,
              lastName: fullUser.lastName || ''
            });
          });
      })
      .catch(err => {
        console.error("Failed to load trust score:", err);
        setError("Failed to load trust score data.");
      })
      .finally(() => setLoading(false));
  }, [user?.username]);

  if (loading) {
    return <ContentLoader message="Loading trust score report..." />;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen text-red-500">{error}</div>;
  }

  if (!user) {
    return <div className="flex justify-center items-center h-screen text-gray-500">Please log in first.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-900 text-white">
            <div>
              <h1 className="text-3xl font-bold text-white">Operator Trust Score</h1>
              <p className="text-gray-400 mt-2">Historical reliability index for {data?.firstName} {data?.lastName} (ID: {data?.userId})</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400 uppercase tracking-wider font-medium">User ID</p>
              <p className="text-xl font-mono">{data?.userId}</p>
            </div>
          </div>
          
          <div className="p-8">
            <div className="flex items-center justify-between mb-12">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-2">Historical Accuracy Score</p>
                <div className="flex items-end space-x-2">
                  <span className={`text-6xl font-black tracking-tighter ${data && data.trustScore >= 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                    {data?.trustScore}
                  </span>
                  <span className="text-2xl text-gray-400 font-bold mb-1">/100</span>
                </div>
              </div>
              
              <div className="w-32 h-32 relative">
                {/* Simulated circular progress */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-100"
                    strokeWidth="3"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className={data && data.trustScore >= 90 ? "text-green-500" : "text-yellow-500"}
                    strokeWidth="3"
                    strokeDasharray={`${data?.trustScore}, 100`}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Historical Variances</p>
                <p className="text-3xl font-bold text-gray-900">{data?.historicalVariances}</p>
                <p className="text-xs text-gray-400 mt-2">Total flagged events across all shifts</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Audit Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  <div className={`w-3 h-3 rounded-full ${data?.status === 'GOOD_STANDING' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <p className="text-lg font-bold text-gray-900 capitalize">{data?.status.replace('_', ' ')}</p>
                </div>
                <p className="text-xs text-gray-400 mt-2">No mandatory spot checks required</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}