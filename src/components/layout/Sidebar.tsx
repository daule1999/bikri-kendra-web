'use client';

import { authService } from '@/core/auth/auth-service';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from '@/lib/theme';
import { getUser, isAdmin, canAccessInventoryManagement, canAccessReports, canAccessRetailSales, canAccessEventRegistration, canAccessShops } from '@/lib/auth';
import { useEffect, useState, useCallback } from 'react';

// ─── Nav item definition ───────────────────────────────────────────────────
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  visible?: boolean;
}

// ─── Icon components (inline SVG — no icon library dependency) ─────────────
const Icon = {
  Dashboard: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  Inventory: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  Sales: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  Shops: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  Events: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Reports: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Billing: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  Printer: () => (
    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
    </svg>
  ),
  Chevron: ({ collapsed }: { collapsed: boolean }) => (
    <svg className={`w-4 h-4 transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

// ─── Main Sidebar Component ────────────────────────────────────────────────
export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useTheme();
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string; role: string | null } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const [navItems, setNavItems] = useState<NavItem[]>([
    { label: 'Dashboard', href: '/dashboard', icon: <Icon.Dashboard />, visible: true },
    { label: 'Inventory', href: '/inventory', icon: <Icon.Inventory />, visible: true },
    { label: 'Retail Sales', href: '/sales', icon: <Icon.Sales />, visible: true },
    { label: 'Shops', href: '/shops', icon: <Icon.Shops />, visible: true },
    { label: 'Shifts', href: '/shifts', icon: <Icon.Shops />, visible: true },
    { label: 'Events', href: '/events', icon: <Icon.Events />, visible: true },
    { label: 'Reports', href: '/reports', icon: <Icon.Reports />, visible: true },
    { label: 'Users', href: '/user', icon: <Icon.Users />, visible: true },
    { label: 'Billing', href: '/billing', icon: <Icon.Billing />, visible: true },
  ]);

  const refreshNavItems = useCallback(() => {
    setNavItems([
      { label: 'Dashboard', href: '/dashboard', icon: <Icon.Dashboard />, visible: true },
      { label: 'Inventory', href: '/inventory', icon: <Icon.Inventory />, visible: canAccessInventoryManagement() },
      { label: 'Retail Sales', href: '/sales', icon: <Icon.Sales />, visible: canAccessRetailSales() },
      { label: 'Shops', href: '/shops', icon: <Icon.Shops />, visible: canAccessShops() },
      // Issue 7 fix: Shifts is visible to anyone with retail sales access (includes CASHIER).
      // Cashier can VIEW shift status but cannot open/close shifts — that's guarded in shifts/page.tsx.
      { label: 'Shifts', href: '/shifts', icon: <Icon.Shops />, visible: canAccessRetailSales() },
      { label: 'Events', href: '/events', icon: <Icon.Events />, visible: canAccessEventRegistration() },
      { label: 'Reports', href: '/reports', icon: <Icon.Reports />, visible: canAccessReports() },
      { label: 'Users', href: '/user', icon: <Icon.Users />, visible: isAdmin() },
      { label: 'Billing', href: '/billing', icon: <Icon.Billing />, visible: true },
    ].filter(item => item.visible !== false));
  }, []);

  useEffect(() => {
    const u = getUser();
    if (u) setUser({ username: u.username || '', role: u.role });
    refreshNavItems();

    const handleRoleChange = () => {
      const updatedUser = getUser();
      if (updatedUser) setUser({ username: updatedUser.username || '', role: updatedUser.role });
      refreshNavItems();
    };

    window.addEventListener('bikri-role-change', handleRoleChange);
    return () => window.removeEventListener('bikri-role-change', handleRoleChange);
  }, [refreshNavItems]);

  // Close More menu whenever the route changes
  useEffect(() => {
    setMoreMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    authService.logout();   // clears the HttpOnly session cookie (Worker) + local state
    window.location.href = '/';
  };

  const avatarInitials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '??';

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside
        className="hidden md:flex fixed top-0 left-0 h-full z-40 flex-col transition-all duration-300 ease-in-out overflow-hidden"
        style={{
          width: sidebarCollapsed ? 'var(--theme-sidebar-collapsed)' : 'var(--theme-sidebar-width)',
          backgroundColor: 'var(--theme-sidebar-bg)',
          borderRight: '1px solid var(--theme-sidebar-border)',
        }}
      >
        {/* ── Logo / Brand ── */}
        <div
          className="flex items-center h-16 px-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--theme-sidebar-border)' }}
        >
          {/* Shop bag icon */}
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)' }}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div className="ml-3 overflow-hidden">
              <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">Bikri Kendra</p>
              <p className="text-xs whitespace-nowrap" style={{ color: 'var(--theme-sidebar-text-muted)' }}>
                Vihangam Yoga
              </p>
            </div>
          )}
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 py-4 overflow-y-auto sidebar-scroll">
          <ul className="space-y-0.5 px-2">
            {navItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={sidebarCollapsed ? item.label : undefined}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative"
                    style={{
                      color: isActive ? 'white' : 'var(--theme-sidebar-text)',
                      background: isActive
                        ? 'linear-gradient(135deg, var(--theme-sidebar-active), #6D28D9)'
                        : 'transparent',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--theme-sidebar-hover)';
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Active left border bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                        style={{ background: 'var(--theme-accent)' }}
                      />
                    )}
                    <span className={isActive ? 'text-white' : ''} style={!isActive ? { color: 'var(--theme-sidebar-text-muted)' } : {}}>
                      {item.icon}
                    </span>
                    {!sidebarCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── User Info + Logout ── */}
        <div
          className="flex-shrink-0 p-3"
          style={{ borderTop: '1px solid var(--theme-sidebar-border)' }}
        >
          <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'var(--theme-sidebar-hover)' }}>
            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--theme-accent), var(--theme-accent-dark))' }}
            >
              {avatarInitials}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-white text-xs font-semibold truncate">{user?.username || 'User'}</p>
                <p className="text-xs truncate" style={{ color: 'var(--theme-sidebar-text-muted)' }}>
                  {user?.role || 'Guest'}
                </p>
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex items-center gap-1">
                {/* Change password — accessible to every logged-in user */}
                <Link
                  href="/user/security"
                  title="Change Password"
                  className="p-1.5 rounded-md transition-colors hover:bg-white/10"
                  style={{ color: 'var(--theme-sidebar-text-muted)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </Link>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-1.5 rounded-md transition-colors hover:bg-red-500/20"
                  style={{ color: 'var(--theme-sidebar-text-muted)' }}
                >
                  <Icon.Logout />
                </button>
              </div>
            )}
          </div>

          {/* Collapsed logout */}
          {sidebarCollapsed && (
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-full mt-2 flex items-center justify-center p-2 rounded-lg transition-colors hover:bg-red-500/20"
              style={{ color: 'var(--theme-sidebar-text-muted)' }}
            >
              <Icon.Logout />
            </button>
          )}
        </div>

        {/* ── Collapse Toggle ── */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center z-50 shadow-md transition-all hover:scale-110"
          style={{
            background: 'var(--theme-accent)',
            color: 'white',
            border: '2px solid var(--theme-sidebar-bg)',
          }}
        >
          <Icon.Chevron collapsed={sidebarCollapsed} />
        </button>
      </aside>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 flex justify-between items-center px-4 pb-safe pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {navItems.slice(0, 4).map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 p-2 min-w-[64px]"
            >
              <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? 'text-indigo-700' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* More/Menu Button */}
        <div className="relative flex flex-col items-center gap-1 p-2 min-w-[64px]">
          <button
            onClick={() => setMoreMenuOpen(prev => !prev)}
            className="flex flex-col items-center gap-1"
            aria-label="More navigation options"
            aria-expanded={moreMenuOpen}
          >
            <div className="p-1.5 rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold tracking-wide text-gray-500">More</span>
          </button>

          {/* Outside-click overlay — closes menu when tapping anywhere else.
              z-40 is intentional: the mobile nav bar itself is z-50, so the 4 visible
              nav links remain fully clickable above this overlay. The overlay only
              intercepts taps on the main page content (z-0), which is correct —
              tapping content closes the menu before the content action fires. */}
          {moreMenuOpen && (
            <div
              className="fixed inset-0 z-40"
              style={{ pointerEvents: 'auto' }}
              onClick={() => setMoreMenuOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Pop-up menu — React-state controlled */}
          <div className={`absolute bottom-full right-0 mb-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl flex flex-col p-2 z-50 overflow-hidden transition-all duration-200 ${
            moreMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}>
            <div className="px-3 py-2 border-b border-gray-50 mb-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Menu</p>
            </div>
            {navItems.slice(4).map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreMenuOpen(false)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-sm font-semibold transition-colors ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
            <div className="h-px bg-gray-100 my-1" />
            <button
              onClick={() => { setMoreMenuOpen(false); handleLogout(); }}
              className="flex items-center gap-3 p-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors w-full text-left"
            >
              <Icon.Logout />
              Logout
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}