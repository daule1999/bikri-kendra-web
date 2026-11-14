export const ROLES = [
  'ADMIN',
  'STORE_MANAGER',
  'INVENTORY_MANAGER',
  'INVENTORY_HELPER',
  'SHOP_SUPERVISOR',
  'SALES_EXECUTIVE',
  'CASHIER',
  'BILLING_OPERATOR',
] as const;

/** Known roles, but the backend may send others — those simply get the universal permissions. */
export type Role = (typeof ROLES)[number] | (string & {});

export interface Session {
  accessToken: string;
  refreshToken: string;
  username: string;
  role: Role;
  mustResetPassword: boolean;
}

export interface AuthUser {
  username: string;
  role: Role;
  mustResetPassword: boolean;
}
