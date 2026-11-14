export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user'
} as const

export const hasPermission = (userRole: string, requiredRole: string) => {
  const hierarchy = { admin: 3, manager: 2, user: 1 }
  return hierarchy[userRole as keyof typeof hierarchy] >= hierarchy[requiredRole as keyof typeof hierarchy]
}