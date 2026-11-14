'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useInventory } from '../context/InventoryContext';
import { buildPlans, type DoneMap } from './lib/plan';
import { runStep, type RunFailure } from './lib/run';
import type { Live, ParsedFile, StepPlan } from './types';

export const STEPS = [
  { key: 'categories', label: 'Categories', path: '/inventory/master-upload/categories' },
  { key: 'shops', label: 'Shops', path: '/inventory/master-upload/shops' },
  { key: 'products', label: 'Products', path: '/inventory/master-upload/products' },
  { key: 'inventory', label: 'Inventory', path: '/inventory/master-upload/inventory' },
  { key: 'issue', label: 'Issue', path: '/inventory/master-upload/issue' },
];
export const UPLOAD_PATH = '/inventory/master-upload';
export const SUMMARY_PATH = '/inventory/master-upload/summary';

/* ── tiny IndexedDB wrapper (parsed file can be large) ── */
const openDb = () =>
  new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open('master-upload', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
async function idb(op: 'get' | 'set' | 'del', key: string, value?: any): Promise<any> {
  try {
    const db = await openDb();
    return await new Promise((res, rej) => {
      const tx = db.transaction('files', op === 'get' ? 'readonly' : 'readwrite');
      const st = tx.objectStore('files');
      const rq = op === 'get' ? st.get(key) : op === 'set' ? st.put(value, key) : st.delete(key);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
  } catch {
    return undefined;
  }
}

/* ── upload history (hash -> info), per event ── */
export interface HashInfo {
  fileName: string;
  at: string;
}
export function readHashes(eventId: string): Record<string, HashInfo> {
  try {
    return JSON.parse(localStorage.getItem(`mu_hashes_${eventId}`) || '{}');
  } catch {
    return {};
  }
}
function writeHash(eventId: string, hash: string, info: HashInfo) {
  try {
    localStorage.setItem(`mu_hashes_${eventId}`, JSON.stringify({ ...readHashes(eventId), [hash]: info }));
  } catch {
    /* storage unavailable: duplicate detection is best-effort */
  }
}

const unwrap = (j: any): any[] => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : []);
async function getList(url: string): Promise<any[]> {
  const r = await apiClient.get(url);
  if (!r.ok) throw new Error(`Could not load ${url} (HTTP ${r.status})`);
  return unwrap(await r.json());
}
async function fetchLive(): Promise<Live> {
  const [categories, products, shops, stocks, issues] = await Promise.all([
    getList('/categories'),
    getList('/products'),
    getList('/shops'),
    getList('/inventory/stocks'),
    getList('/inventory/sales'),
  ]);
  return { categories, products, shops, stocks, issues };
}

export interface VerifyState {
  step: number;
  category?: string;
  state: 'checking' | 'confirmed' | 'pending';
}

interface Ctx {
  /** which category a grouped step should open on: 'first' going forward, 'last' when coming back */
  setArrival: (v: 'first' | 'last') => void;
  getArrival: () => 'first' | 'last';
  verify: VerifyState | null;
  refresh: () => Promise<void>;
  eventId: string | null;
  ready: boolean;
  file: ParsedFile | null;
  fileName: string;
  fileHash: string;
  plans: StepPlan[] | null;
  loading: boolean;
  loadError: string;
  running: number | null;
  progress: string;
  stepErrors: Record<number, RunFailure | undefined>;
  setFile: (data: ParsedFile, name: string, hash: string) => Promise<void>;
  clearFile: () => Promise<void>;
  /** returns true when the step finished with nothing left to do */
  run: (step: number, category?: string) => Promise<boolean>;
  blockedReason: (step: number, category?: string) => string | null;
}

const MasterCtx = createContext<Ctx | null>(null);
export const useMasterUpload = () => {
  const c = useContext(MasterCtx);
  if (!c) throw new Error('useMasterUpload must be used inside MasterUploadProvider');
  return c;
};

export function MasterUploadProvider({ children }: { children: React.ReactNode }) {
  const { eventId, currentUsername } = useInventory();
  const [ready, setReady] = useState(false);
  const [file, setFileState] = useState<ParsedFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileHash, setFileHash] = useState('');
  const [live, setLive] = useState<Live | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [running, setRunning] = useState<number | null>(null);
  const [progress, setProgress] = useState('');
  const [stepErrors, setStepErrors] = useState<Record<number, RunFailure | undefined>>({});
  const busy = useRef(false);
  const arrival = useRef<'first' | 'last'>('first');
  const [verify, setVerify] = useState<VerifyState | null>(null);
  const [done, setDone] = useState<DoneMap>({});
  const doneRef = useRef<DoneMap>({});

  const plans = useMemo(() => (file && live ? buildPlans(file, live, done) : null), [file, live, done]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      setLive(await fetchLive());
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load current data');
    } finally {
      setLoading(false);
    }
  }, []);

  // restore the saved file for this event
  useEffect(() => {
    if (!eventId) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const saved = await idb('get', `mu:${eventId}`);
      if (cancelled) return;
      if (saved?.file) {
        setFileState(saved.file);
        setFileName(saved.fileName || '');
        setFileHash(saved.hash || '');
        doneRef.current = saved.done || {};
        setDone(doneRef.current);
        await refresh();
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, refresh]);

  const setFile = useCallback(
    async (data: ParsedFile, name: string, hash: string) => {
      if (!eventId) return;
      setFileState(data);
      setFileName(name);
      setFileHash(hash);
      setStepErrors({});
      doneRef.current = {};
      setDone({});
      await idb('set', `mu:${eventId}`, { file: data, fileName: name, hash, done: {} });
      writeHash(eventId, hash, { fileName: name, at: new Date().toISOString() });
      await refresh();
    },
    [eventId, refresh]
  );

  const clearFile = useCallback(async () => {
    if (eventId) await idb('del', `mu:${eventId}`);
    setFileState(null);
    setFileName('');
    setFileHash('');
    setLive(null);
    setStepErrors({});
    setVerify(null);
    doneRef.current = {};
    setDone({});
  }, [eventId]);

  const blockedReasonFor = (list: StepPlan[], step: number, category?: string): string | null => {
    for (let i = 0; i < step; i++) {
      if (!list[i].complete) return `Finish step ${i + 1} (${STEPS[i].label}) first.`;
    }
    const scope = category ? list[step].rows.filter((r) => r.category === category) : list[step].rows;
    const conflicts = scope.filter((r) => r.status === 'CONFLICT').length;
    if (conflicts > 0) {
      return `${conflicts} row(s) conflict with existing data. Fix the file or the data, then re-upload.`;
    }
    if (!scope.some((r) => r.status === 'NEW')) {
      return category ? `Nothing to create for "${category}".` : 'Nothing to create in this step.';
    }
    return null;
  };
  const blockedReason = useCallback(
    (step: number, category?: string) => {
      if (!plans) return 'Loading...';
      if (running !== null) return 'A step is running.';
      if (verify?.state === 'checking' && verify.step === step && (!category || verify.category === category)) {
        return 'Checking that the data just created is in the system...';
      }
      return blockedReasonFor(plans, step, category);
    },
    [plans, running, verify]
  );

  const verifyInserted = async (f: ParsedFile, step: number, category?: string) => {
    setVerify({ step, category, state: 'checking' });
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const l = await fetchLive();
        setLive(l);
        const p = buildPlans(f, l)[step]; // real data only, without the "just created" record
        const scope = category ? p.rows.filter((r) => r.category === category) : p.rows;
        if (!scope.some((r) => r.status === 'NEW')) {
          setVerify({ step, category, state: 'confirmed' });
          return;
        }
      } catch {
        /* try again */
      }
    }
    setVerify({ step, category, state: 'pending' });
  };

  const run = useCallback(
    async (step: number, category?: string): Promise<boolean> => {
      if (!file || busy.current) return false;
      busy.current = true;
      setRunning(step);
      setStepErrors((e) => ({ ...e, [step]: undefined }));
      try {
        // always validate against fresh data right before writing
        const fresh = await fetchLive();
        setLive(fresh);
        const list = buildPlans(file, fresh, doneRef.current);
        const why = blockedReasonFor(list, step, category);
        if (why) {
          setStepErrors((e) => ({ ...e, [step]: { row: '-', message: why } }));
          return false;
        }
        const failure = await runStep(
          step,
          category ? { ...list[step], rows: list[step].rows.filter((r) => r.category === category) } : list[step],
          currentUsername,
          (d, t) => setProgress(`${d} of ${t} done`),
          (key) => {
            doneRef.current = { ...doneRef.current, [key]: Date.now() };
          }
        );
        setDone(doneRef.current);
        if (eventId) await idb('set', `mu:${eventId}`, { file, fileName, hash: fileHash, done: doneRef.current });
        if (failure) setStepErrors((e) => ({ ...e, [step]: failure }));
        const after = await fetchLive();
        setLive(after);
        // Confirm against the real data in the background (the stock list can lag up to 30 s)
        if (!failure) void verifyInserted(file, step, category);
        return !failure && buildPlans(file, after, doneRef.current)[step].complete;
      } catch (e: any) {
        setStepErrors((er) => ({ ...er, [step]: { row: '-', message: e?.message || 'Unexpected error' } }));
        return false;
      } finally {
        busy.current = false;
        setRunning(null);
        setProgress('');
      }
    },
    [file, currentUsername, eventId, fileName, fileHash]
  );

  const setArrival = useCallback((v: 'first' | 'last') => {
    arrival.current = v;
  }, []);
  const getArrival = useCallback(() => arrival.current, []);

  const value: Ctx = {
    setArrival,
    getArrival,
    verify,
    eventId,
    ready,
    file,
    fileName,
    fileHash,
    plans,
    loading,
    loadError,
    running,
    progress,
    stepErrors,
    setFile,
    clearFile,
    refresh,
    run,
    blockedReason,
  };
  return <MasterCtx.Provider value={value}>{children}</MasterCtx.Provider>;
}
