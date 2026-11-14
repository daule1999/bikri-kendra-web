'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { STORAGE_KEYS } from '@/core/config';

interface ShellState { sidebarCollapsed: boolean; toggleSidebar: () => void }

const ShellContext = createContext<ShellState>({ sidebarCollapsed: false, toggleSidebar: () => {} });

/** Layout UI preferences (sidebar collapsed), persisted per browser. */
export function ShellStateProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setCollapsed] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true'); }, []);
  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(!prev));
      return !prev;
    });
  }, []);
  return <ShellContext.Provider value={{ sidebarCollapsed, toggleSidebar }}>{children}</ShellContext.Provider>;
}

export const useShellState = () => useContext(ShellContext);
