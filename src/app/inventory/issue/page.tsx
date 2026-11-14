'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SingleIssueForm from './components/SingleIssueForm';
import BulkIssueForm from './components/BulkIssueForm';
import BulkUploadIssueForm from './components/BulkUploadIssueForm';
import IssueRecordsList from './components/IssueRecordsList';

export default function IssuePage() {
  return (
    <Suspense fallback={null}>
      <IssuePageContent />
    </Suspense>
  );
}

function IssuePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [issueTab, setIssueTab] = useState('single-issue');
  const [addForm, setAddForm] = useState(false)

  // Supports deep-linking straight into the "New Issue" form, e.g. from the Issue History
  // page's back link (?new=1), instead of always landing on the records list.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setAddForm(true);
      setIssueTab('single-issue');
      // Strip the query param so Cancel/browser-back doesn't keep re-opening the form.
      router.replace('/inventory/issue');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="w-full max-w-full">
      {/* Sub Tabs (Only visible when adding stock issues) */}
      {addForm && (
        <div className="flex justify-between items-center flex-wrap gap-3 mb-4 sm:mb-6">
          <div className="flex border border-indigo-100 bg-gray-50/80 rounded-xl p-1.5 w-fit max-w-full overflow-x-auto">
            <button
              onClick={() => setIssueTab('single-issue')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${issueTab === 'single-issue' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Single Issue
            </button>
            <button
              onClick={() => setIssueTab('bulk-issue')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${issueTab === 'bulk-issue' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Bulk Issue
            </button>
            <button
              onClick={() => setIssueTab('bulk-upload-issue')}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${issueTab === 'bulk-upload-issue' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Bulk Upload Issue
            </button>
          </div>
          <button
            onClick={() => setAddForm(false)}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
          >
            ← Back to Issue dashboard
          </button>
        </div>
      )}

      {/* Forms or Issue Records List in full width */}
      {addForm ? (
        <div className="w-full space-y-6">
          <div className={issueTab === 'single-issue' ? 'block animate-fade-in-up' : 'hidden'}>
            <SingleIssueForm setAddForm={setAddForm} />
          </div>
          <div className={issueTab === 'bulk-issue' ? 'block animate-fade-in-up' : 'hidden'}>
            <BulkIssueForm setAddForm={setAddForm} />
          </div>
          <div className={issueTab === 'bulk-upload-issue' ? 'block animate-fade-in-up' : 'hidden'}>
            <BulkUploadIssueForm setAddForm={setAddForm} />
          </div>
        </div>
      ) : (
        <div className="w-full animate-fade-in-up">
          <IssueRecordsList setAddForm={setAddForm} />
        </div>
      )}
    </div>
  );
}
