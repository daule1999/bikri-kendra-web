'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { MasterUploadProvider } from './context';

const subscribe = () => () => {};
const readRole = (): string | null => {
  try {
    return localStorage.getItem('userRole') || '';
  } catch {
    return '';
  }
};

/** Admin-only area: every page under /inventory/master-upload goes through this check. */
export default function MasterUploadLayout({ children }: { children: React.ReactNode }) {
  // null on the server / first render, then the stored role
  const role = useSyncExternalStore(subscribe, readRole, () => null);
  const state = role === null ? 'checking' : role.toUpperCase() === 'ADMIN' ? 'ok' : 'denied';

  if (state === 'checking') return null;
  if (state === 'denied') {
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-semibold text-gray-800">Admin access required</p>
        <p className="text-sm text-gray-500 mt-1">Master Upload is available to administrators only.</p>
        <Link href="/inventory/running-stock" className="inline-block mt-4 text-indigo-600 font-semibold text-sm">
          Back to inventory
        </Link>
      </div>
    );
  }
  return <MasterUploadProvider>{children}</MasterUploadProvider>;
}
