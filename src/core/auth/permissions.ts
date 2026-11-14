import type { Role } from './types';

/**
 * Permission catalogue. UI code checks PERMISSIONS, never role names.
 * To change who can do something, edit PERMISSION_ROLES below — no component changes.
 */
export const PERMISSIONS = {
  dashboardView: 'dashboard:view',
  usersManage: 'users:manage',
  inventoryAccess: 'inventory:access',
  stockHistoryView: 'stock-history:view',
  stockHistoryModify: 'stock-history:modify',
  salesAccess: 'sales:access',
  shiftsView: 'shifts:view',
  reportsView: 'reports:view',
  shopsAccess: 'shops:access',
  eventsManage: 'events:manage',
  billingView: 'billing:view',
  printerUse: 'printer:use',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** '*' = any signed-in user. */
type RoleSet = readonly Role[] | '*';

const SALES_ROLES = ['ADMIN', 'CASHIER', 'SALES_EXECUTIVE', 'SHOP_SUPERVISOR', 'BILLING_OPERATOR'] as const;

/**
 * Who holds each permission. Mirrors EventManagement/lib/auth.ts exactly so the
 * migrated pages behave the same. The backend still enforces everything — this
 * only decides what the UI shows.
 */
export const PERMISSION_ROLES: Record<Permission, RoleSet> = {
  'dashboard:view': '*',
  'users:manage': ['ADMIN'],
  'inventory:access': ['ADMIN', 'STORE_MANAGER', 'INVENTORY_MANAGER', 'INVENTORY_HELPER'],
  'stock-history:view': ['ADMIN', 'INVENTORY_MANAGER', 'INVENTORY_HELPER'],
  'stock-history:modify': ['ADMIN', 'INVENTORY_MANAGER'],
  'sales:access': SALES_ROLES,
  'shifts:view': SALES_ROLES,
  'reports:view': '*', // data scoping is done by the backend (reportScope)
  'shops:access': ['ADMIN', 'SHOP_SUPERVISOR'],
  'events:manage': ['ADMIN'],
  'billing:view': '*',
  'printer:use': '*',
};

/** Resolves the full permission set for a role. */
export function permissionsForRole(role: Role | null | undefined): ReadonlySet<Permission> {
  if (!role) return new Set();
  const granted = (Object.entries(PERMISSION_ROLES) as [Permission, RoleSet][])
    .filter(([, roles]) => roles === '*' || roles.includes(role))
    .map(([permission]) => permission);
  return new Set(granted);
}
