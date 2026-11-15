export const getUserRole = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("userRole");
  }
  return null;
};

export const isAuthenticated = (): boolean => {
  if (typeof window !== "undefined") {
    // Tokens live in HttpOnly cookies; this is the validated client-side session hint.
    return localStorage.getItem("hasSession") === "1";
  }
  return false;
};

export const getUser = () => {
  if (typeof window !== "undefined") {
    const username = localStorage.getItem("username");
    const userRole = localStorage.getItem("userRole");
    return username ? { username, role: userRole } : null;
  }
  return null;
};
export const getCurrentUserId = (): number | null => {
  if (typeof window === "undefined") return null;
  const id = Number(localStorage.getItem("userId"));
  return Number.isFinite(id) && id > 0 ? id : null;
};

export const hasRole = (requiredRoles: string[]): boolean => {
  const userRole = getUserRole();
  return userRole ? requiredRoles.includes(userRole) : false;
};

export const isAdmin = (): boolean => {
  return hasRole(["ADMIN"]);
};

// Reports are visible to every role — CASHIER/BILLING_OPERATOR see only their own
// data, SHOP_SUPERVISOR sees their assigned shops' team, everyone else sees
// everything. The actual scoping comes from the `reportScope` page-init key
// (backend-computed — see ReportScopeService), not from this access check.
export const canAccessReports = (): boolean => {
  return isAuthenticated();
};

export const canAccessRetailSales = (): boolean => {
  return hasRole([
    "ADMIN",
    "CASHIER",
    "SALES_EXECUTIVE",
    "SHOP_SUPERVISOR",
    "BILLING_OPERATOR",
  ]);
};

export const canAccessEventRegistration = (): boolean => {
  return hasRole(["ADMIN"]);
};

export const canAccessShops = (): boolean => {
  return hasRole(["ADMIN", "SHOP_SUPERVISOR"]);
};

export const canAccessUserManagement = (): boolean => {
  return hasRole(["ADMIN"]);
};

export const canViewUserDetails = (): boolean => {
  return true; // All users can view user details
};

// Stock Movement History (Issue + Inventory pages) — read access is intentionally
// broader than modify access, since a helper should be able to look up what happened
// without being able to change the historical record. Mirrors the backend's own
// READ_ROLES/MODIFY_ROLES split in StockMovementController.
export const canViewStockMovementHistory = (): boolean => {
  return hasRole(["ADMIN", "INVENTORY_MANAGER", "INVENTORY_HELPER"]);
};

export const canModifyStockMovementHistory = (): boolean => {
  return hasRole(["ADMIN", "INVENTORY_MANAGER"]);
};

export const canAccessInventoryManagement = (): boolean => {
  const userRole = getUserRole();
  const hasAccess = hasRole([
    "ADMIN",
    "STORE_MANAGER",
    "INVENTORY_MANAGER",
    "INVENTORY_HELPER",
  ]);
  console.log(
    "[AUTH] Checking inventory access - User role:",
    userRole,
    "Has access:",
    hasAccess,
  );
  return hasAccess;
};
