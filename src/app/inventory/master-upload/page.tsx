'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInventory } from '../context/InventoryContext';
import { downloadSample, parseWorkbook } from './lib/excel';
import { readHashes, STEPS, useMasterUpload } from './context';
import type { ParsedFile } from './types';

async function sha256(buf: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function MasterUploadPage() {
  const router = useRouter();
  const { categories } = useInventory();
  const { eventId, ready, file, fileName, fileHash, setFile, clearFile } = useMasterUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<{ data: ParsedFile; name: string; hash: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const seenBefore = useMemo(() => {
    if (!pending || !eventId) return null;
    return readHashes(eventId)[pending.hash] ?? null;
  }, [pending, eventId]);

  const onFile = async (f: File | undefined) => {
    setErrors([]);
    setPending(null);
    if (!f) return;
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const { data, errors: errs } = parseWorkbook(buf);
      if (errs.length || !data) {
        setErrors(errs);
        return;
      }
      setPending({ data, name: f.name, hash: await sha256(buf) });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const counts = (d: ParsedFile) => ({
    categories: d.categories.length,
    shops: d.categories.reduce((a, c) => a + c.shops.length, 0),
    products: d.categories.reduce((a, c) => a + c.products.length, 0),
  });

  if (!eventId) {
    return <div className="p-6 text-sm text-gray-600">Select an event from the top bar before using Master Upload.</div>;
  }
  if (!ready) return <div className="p-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-5 p-3 sm:p-0">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Master Upload</h2>
        <p className="text-sm text-gray-500">
          Upload one workbook to create categories, shops, products, stock and the first issue to shops, step by step.
          Nothing is written until you click Create all on a step. Nothing is rolled back if a step fails.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => downloadSample(categories.map((c: any) => ({ name: c.name, description: c.description })))}
          className="px-4 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-sm font-semibold hover:bg-indigo-50"
        >
          Download sample
        </button>
        <label className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer">
          {busy ? 'Reading...' : 'Choose master .xlsx'}
          <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700 mb-1">
            {errors.length} problem{errors.length === 1 ? '' : 's'} in the file. Fix them and upload again.
          </p>
          <ul className="text-xs text-red-700 list-disc pl-5 max-h-60 overflow-y-auto space-y-0.5">
            {errors.slice(0, 200).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
            {errors.length > 200 && <li>... and {errors.length - 200} more</li>}
          </ul>
        </div>
      )}

      {pending && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2">
          <p className="text-sm font-semibold text-emerald-800">{pending.name} passed file validation</p>
          <p className="text-xs text-emerald-800">
            {counts(pending.data).categories} categories, {counts(pending.data).shops} shops, {counts(pending.data).products} products
          </p>
          {seenBefore && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              This exact file was uploaded before ({seenBefore.fileName}, {new Date(seenBefore.at).toLocaleString()}).
              Each step re-checks live data, so already created items are skipped and only what is left will be created.
            </p>
          )}
          <button
            onClick={async () => {
              await setFile(pending.data, pending.name, pending.hash);
              router.push(STEPS[0].path);
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
          >
            Start review
          </button>
        </div>
      )}

      {file && !pending && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 space-y-2">
          <p className="text-sm text-gray-700">
            Saved upload: <span className="font-semibold">{fileName}</span>
            <span className="text-gray-400"> ({fileHash.slice(0, 8)})</span>
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push(STEPS[0].path)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              Continue
            </button>
            <button onClick={clearFile} className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-300">
              Discard saved upload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
