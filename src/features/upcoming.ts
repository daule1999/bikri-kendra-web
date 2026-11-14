import { ROUTES } from '@/core/config';
import { PERMISSIONS } from '@/core/auth';
import { defineFeature } from '@/core/features';

/**
 * Modules still living in EventManagement. Each entry moves into its own
 * `features/<name>/feature.ts` (with status 'available') when its pages are migrated.
 * Permissions and copy match the old dashboard/sidebar exactly.
 */
export const UPCOMING_FEATURES = [
  defineFeature({ key: 'users', label: 'User Management', navLabel: 'Users', description: 'Create, manage and assign roles to system users', href: ROUTES.users, icon: 'users', tone: 'indigo', permission: PERMISSIONS.usersManage, status: 'coming-soon', order: 80 }),
  defineFeature({ key: 'inventory', label: 'Inventory', description: 'Track stock levels, add products and manage categories', href: ROUTES.inventory, icon: 'box', tone: 'violet', permission: PERMISSIONS.inventoryAccess, status: 'coming-soon', order: 20 }),
  defineFeature({ key: 'sales', label: 'Retail Sales', description: 'Process sales orders and print thermal receipts', href: ROUTES.sales, icon: 'cart', tone: 'emerald', permission: PERMISSIONS.salesAccess, status: 'coming-soon', order: 30 }),
  defineFeature({ key: 'reports', label: 'Reports', description: 'View counter-wise sales analytics and download exports', href: ROUTES.reports, icon: 'chart', tone: 'amber', permission: PERMISSIONS.reportsView, status: 'coming-soon', order: 70 }),
  defineFeature({ key: 'shops', label: 'Shop Management', navLabel: 'Shops', description: 'Register shops, assign counters and manage staff', href: ROUTES.shops, icon: 'building', tone: 'pink', permission: PERMISSIONS.shopsAccess, status: 'coming-soon', order: 40 }),
  defineFeature({ key: 'shifts', label: 'Shift Management', navLabel: 'Shifts', description: 'Open shifts, count cash drawer denominations, and audit daily balances', href: ROUTES.shifts, icon: 'clock', tone: 'orange', permission: PERMISSIONS.shiftsView, status: 'coming-soon', order: 50 }),
  defineFeature({ key: 'events', label: 'Event Management', navLabel: 'Events', description: 'Create and manage Vihangam Yoga event registrations', href: ROUTES.events, icon: 'calendar', tone: 'cyan', permission: PERMISSIONS.eventsManage, status: 'coming-soon', order: 60 }),
  defineFeature({ key: 'billing', label: 'Billing', description: 'Search and manage invoices', href: ROUTES.billing, icon: 'card', tone: 'slate', permission: PERMISSIONS.billingView, status: 'coming-soon', order: 90, showOnDashboard: false }),
];
