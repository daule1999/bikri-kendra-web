'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface ThemeContextValue {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  sidebarCollapsed: false,
  toggleSidebar: () => {},
  setSidebarCollapsed: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    if (stored === 'true') setSidebarCollapsedState(true);
  }, []);

  const setSidebarCollapsed = (v: boolean) => {
    setSidebarCollapsedState(v);
    localStorage.setItem('sidebarCollapsed', String(v));
  };

  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <ThemeContext.Provider value={{ sidebarCollapsed, toggleSidebar, setSidebarCollapsed }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
