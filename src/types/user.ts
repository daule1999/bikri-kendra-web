export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'user'
  avatar?: string
  createdAt: Date
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  language: string
  notifications: boolean
}