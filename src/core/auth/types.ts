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

/**
 * What the browser knows about the signed-in user. Tokens are NOT part of it:
 * they live in HttpOnly cookies managed by the Worker (worker/session.ts), so
 * page scripts (and any XSS) can never read them.
 */
export interface Session {
  username: string;
  role: Role;
  userId: number | null;
  mustResetPassword: boolean;
}

export interface AuthUser {
  username: string;
  role: Role;
  userId?: number | null;
  mustResetPassword: boolean;
}
