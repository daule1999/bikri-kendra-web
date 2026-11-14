'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { STEPS, UPLOAD_PATH, useMasterUpload } from '../context';

export default function SummaryPage() {
  const router = useRouter();
  const { ready, file, fileName, plans, refresh, loading, setArrival } = useMasterUpload();

  useEffect(() => {
    if (ready && !file) router.replace(UPLOAD_PATH);
  }, [ready, file, router]);

  const download = () => {
    if (!plans) return;
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['step,category,details,status,note'];
    plans.forEach((p, i) =>
      p.rows.forEach((r) => lines.push([STEPS[i].label, r.category, r.cells.join(' | '), r.status, r.note ?? ''].map(esc).join(',')))
    );
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'master_upload_report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!ready || !file) return <div className="p-6 text-sm text-gray-500">Loading...</div>;
  const allDone = !!plans && plans.every((p) => p.complete);

  return (
    <div className="space-y-4 max-w-3xl p-3 sm:p-0">
      <h2 className="text-lg font-bold text-gray-800">Summary: {fileName}</h2>
      <p className={`text-sm font-semibold ${allDone ? 'text-emerald-700' : 'text-amber-700'}`}>
        {allDone ? 'Everything in the file is in the system.' : 'Some steps are not complete yet.'}
      </p>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {['Step', 'Already done', 'Still to create', 'Conflicts'].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STEPS.map((s, i) => (
              <tr key={s.key} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{s.label}</td>
                <td className="px-3 py-2">{plans?.[i].existsCount ?? '-'}</td>
                <td className="px-3 py-2">{plans?.[i].newCount ?? '-'}</td>
                <td className={`px-3 py-2 ${plans?.[i].conflictCount ? 'text-red-600 font-semibold' : ''}`}>{plans?.[i].conflictCount ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => {
            setArrival('last');
            router.push(STEPS[STEPS.length - 1].path);
          }} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300">
          Go back
        </button>
        <button onClick={refresh} disabled={loading} className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-60">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button onClick={download} className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50">
          Download report (CSV)
        </button>
        <button onClick={() => router.push(UPLOAD_PATH)} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 sm:ml-auto">
          Upload another file
        </button>
      </div>
    </div>
  );
}
