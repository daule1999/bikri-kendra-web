'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useInventory } from '../context/InventoryContext';

const tabs = [
  { href: '/inventory/running-stock', label: 'Running Stock', shortLabel: 'Running' },
  { href: '/inventory/issue', label: 'Issue', shortLabel: 'Issue' },
  { href: '/inventory/stock', label: 'Inventory Stock', shortLabel: 'Inventory Stock' },
  { href: '/inventory/category', label: 'Categories', shortLabel: 'Categories' },
  { href: '/inventory/product', label: 'Products', shortLabel: 'Products' },
  { href: '/inventory/master-upload', label: 'Master Upload', shortLabel: 'Master', adminOnly: true },
];

export default function InventoryTabs() {
  const pathname = usePathname();
  const { isAdminUser } = useInventory();

  return (
    <div className="flex border-b border-indigo-100 overflow-x-auto text-xs sm:text-sm bg-gray-50/50 shrink-0">
      {tabs.filter((tab) => !tab.adminOnly || isAdminUser).map((tab) => {
        const isActive = tab.href === '/inventory/master-upload' ? pathname.startsWith(tab.href) : pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 sm:flex-none px-2 sm:px-5 py-3 sm:py-2.5 whitespace-nowrap font-semibold transition-colors text-center ${isActive
              ? 'border-b-2 border-indigo-600 text-indigo-700 bg-indigo-50/50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
              }`}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}
