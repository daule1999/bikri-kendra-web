'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STEPS, SUMMARY_PATH, UPLOAD_PATH, useMasterUpload } from '../context';
import type { PlanRow, Status } from '../types';

const BADGE: Record<Status, string> = {
  NEW: 'bg-blue-50 text-blue-700 border-blue-200',
  EXISTS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CONFLICT: 'bg-red-50 text-red-700 border-red-200',
};

interface Props {
  step: number;
  title: string;
  hint: string;
  columns: string[];
  /** show category pills (steps 3 to 5) */
  grouped: boolean;
}

export default function StepView({ step, title, hint, columns, grouped }: Props) {
  const router = useRouter();
  const { ready, file, plans, loading, loadError, running, progress, stepErrors, run, refresh, blockedReason, verify, setArrival, getArrival } = useMasterUpload();
  const [selected, setSelected] = useState<string>('');
  // opened by going back from the next step: start on the last category
  const [openOnLast] = useState(() => getArrival() === 'last');
  useEffect(() => {
    setArrival('first');
  }, [setArrival]);

  useEffect(() => {
    if (ready && !file) router.replace(UPLOAD_PATH);
  }, [ready, file, router]);

  const plan = plans?.[step];
  const categories = useMemo(() => {
    const seen: string[] = [];
    plan?.rows.forEach((r) => {
      if (!seen.includes(r.category)) seen.push(r.category);
    });
    return seen;
  }, [plan]);
  const fallback = openOnLast ? categories[categories.length - 1] : categories[0];
  const active = grouped ? (categories.includes(selected) ? selected : fallback) : '';
  const catIdx = categories.indexOf(active);
  const hasNextCat = grouped && catIdx >= 0 && catIdx < categories.length - 1;
  const hasPrevCat = grouped && catIdx > 0;
  const order = (r: PlanRow) => (r.status === 'CONFLICT' ? 0 : r.status === 'NEW' ? 1 : 2);
  const rows: PlanRow[] = (!plan ? [] : grouped ? plan.rows.filter((r) => r.category === active) : plan.rows)
    .slice()
    .sort((a, b) => order(a) - order(b));
  const conflicts = plan ? plan.rows.filter((r) => r.status === 'CONFLICT') : [];

  const pillState = (cat: string) => {
    const rs = plan!.rows.filter((r) => r.category === cat);
    if (rs.some((r) => r.status === 'CONFLICT')) return { dot: 'bg-red-500', n: rs.length, ok: false };
    if (rs.some((r) => r.status === 'NEW')) return { dot: 'bg-blue-500', n: rs.length, ok: false };
    return { dot: 'bg-emerald-500', n: rs.length, ok: true };
  };

  // Inventory and Issue are created one category at a time (the selected pill)
  const scoped = grouped && step >= 3;
  const scope = scoped ? active : undefined;
  const scopeNew = plan ? plan.rows.filter((r) => (scoped ? r.category === active : true) && r.status === 'NEW').length : 0;
  const why = blockedReason(step, scope);
  const error = stepErrors[step];
  const prev = step === 0 ? UPLOAD_PATH : STEPS[step - 1].path;
  const next = step === STEPS.length - 1 ? SUMMARY_PATH : STEPS[step + 1].path;

  const createAll = async () => {
    const done = await run(step, scope);
    if (done) {
      setArrival('first');
      router.push(next);
    }
  };

  // With several categories, View next / Go back step through the categories first, then change step
  const goNext = () => {
    if (hasNextCat) setSelected(categories[catIdx + 1]);
    else {
      setArrival('first');
      router.push(next);
    }
  };
  const goPrev = () => {
    if (hasPrevCat) setSelected(categories[catIdx - 1]);
    else {
      setArrival('last');
      router.push(prev);
    }
  };

  if (!ready || !file) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="space-y-4 p-3 sm:p-0">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {STEPS.map((s, i) => {
          const done = plans?.[i]?.complete;
          return (
            <span
              key={s.key}
              className={`px-2.5 py-1 rounded-full border font-semibold ${
                i === step
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : done
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-gray-50 text-gray-500 border-gray-200'
              }`}
            >
              {i + 1}. {s.label}
              {done && i !== step ? ' ✓' : ''}
            </span>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-bold text-gray-800">
          Step {step + 1} of {STEPS.length}: {title}
        </h2>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {loadError}{' '}
          <button onClick={refresh} className="underline font-semibold">
            Retry
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error.row === '-' ? (
            <>
              <p className="font-semibold">Not started: {error.message}</p>
              <p className="text-xs mt-1">Nothing was created by this attempt.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Stopped at &quot;{error.row}&quot;: {error.message}</p>
              <p className="text-xs mt-1">
                Nothing was rolled back. Items created before this point stay created. Fix the cause (or the file) and click Create all again to continue.
              </p>
            </>
          )}
        </div>
      )}

      {plan && (
        <p className="text-xs text-gray-600">
          <b>{plan.newCount}</b> to create · <b>{plan.existsCount}</b> already done · <b className={plan.conflictCount ? 'text-red-600' : ''}>{plan.conflictCount}</b> conflicts
          {loading ? ' · refreshing...' : ''}
        </p>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700 mb-1">
            {conflicts.length} conflict{conflicts.length === 1 ? '' : 's'} in this step (shown first in the table)
          </p>
          <ul className="text-xs text-red-700 list-disc pl-5 space-y-0.5">
            {conflicts.slice(0, 10).map((r) => (
              <li key={r.key}>
                {r.cells.slice(0, 2).join(' / ')}: {r.note}
              </li>
            ))}
            {conflicts.length > 10 && <li>... and {conflicts.length - 10} more</li>}
          </ul>
        </div>
      )}

      {grouped && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => {
            const st = pillState(c);
            return (
              <button
                key={c}
                onClick={() => setSelected(c)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${
                  c === active ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                {c} ({st.n}){st.ok ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
      )}

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                  {c}
                </th>
              ))}
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {!plan && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-4 text-gray-500">
                  Loading current data...
                </td>
              </tr>
            )}
            {plan && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-4 text-gray-500">
                  Nothing in the file for this step.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-gray-100">
                {r.cells.map((c, i) => (
                  <td key={i} className="px-3 py-2 whitespace-nowrap text-gray-800">
                    {c}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${BADGE[r.status]}`}>{r.status}</span>
                </td>
                <td className="px-3 py-2 text-gray-600">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {running === step && <p className="text-sm text-indigo-700 font-semibold">Creating... {progress}</p>}
      {verify && verify.step === step && (!scope || verify.category === scope) && running === null && (
        <p
          className={`text-xs rounded-lg border p-2 ${
            verify.state === 'confirmed'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : verify.state === 'pending'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          {verify.state === 'checking' && 'Checking that the data just created is in the system...'}
          {verify.state === 'confirmed' && '✓ Confirmed: the created data is in the system.'}
          {verify.state === 'pending' &&
            'The create calls succeeded, but the system still shows the old numbers. These rows are treated as done. Click Refresh in a minute to confirm.'}
        </p>
      )}
      {why && running !== step && <p className="text-xs text-gray-500">{why}</p>}

      {grouped && categories.length > 1 && (
        <p className="text-xs text-gray-500">
          Category {catIdx + 1} of {categories.length}: Go back and View next move between categories first, then between steps.
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          onClick={goPrev}
          disabled={running !== null}
          className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300 disabled:opacity-60"
        >
          Go back
        </button>
        <button
          onClick={refresh}
          disabled={running !== null || loading}
          className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-60"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
        <button
          onClick={goNext}
          disabled={running !== null}
          className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50 disabled:opacity-60"
        >
          View next
        </button>
        <button
          onClick={createAll}
          disabled={!!why}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 sm:ml-auto"
        >
          {running === step
            ? 'Creating...'
            : scoped
            ? `Create all in "${active ?? ''}" (${scopeNew})`
            : `Create all${plan ? ` (${plan.newCount})` : ''}`}
        </button>
      </div>
    </div>
  );
}
