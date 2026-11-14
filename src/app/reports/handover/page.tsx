'use client';

import { useState } from 'react';

export default function ShiftHandoverPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate API submission
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 1500);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center border-t-8 border-green-500">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Handover Complete</h2>
          <p className="text-gray-500 mb-6">The shift handover bleed has been mathematically logged and cryptographically signed.</p>
          <button onClick={() => window.location.href = '/'} className="bg-gray-900 text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition w-full">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-red-600 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Shift Handover Protocol</h1>
            <p className="text-red-100 mt-1">Terminal Lock Engaged</p>
          </div>
          <svg className="w-10 h-10 text-red-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
        </div>
        
        <div className="p-8">
          <div className="mb-8">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 1 ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>1</div>
              <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-red-600' : 'bg-gray-200'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${step >= 2 ? 'bg-red-600 text-white' : 'bg-gray-200'}`}>2</div>
            </div>
            <div className="flex justify-between mt-2 text-xs font-medium text-gray-500">
              <span>Outgoing Declaration</span>
              <span>Incoming Verification</span>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Outgoing Cashier: Declare Totals</h3>
                <p className="text-sm text-gray-500 mb-4">Please count your drawer blindly. You cannot see the system expected totals.</p>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Declared Cash (₹)</label>
                  <input type="number" step="0.01" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" placeholder="0.00" />
                </div>
                
                <button type="button" onClick={() => setStep(2)} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                  Submit Blind Count & Proceed
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900 border-b pb-2">Incoming Cashier: Verification</h3>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                  <p className="text-sm text-yellow-700">
                    By signing this, you accept liability for the physical stock and cash starting exactly at this moment. Any prior discrepancies belong to the outgoing cashier.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Incoming Cashier ID / PIN</label>
                  <input type="password" required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 sm:text-sm" placeholder="****" />
                </div>

                <div className="flex space-x-4">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                    Back
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 flex justify-center items-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
                    {submitting ? 'Committing...' : 'Sign & Assume Liability'}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
