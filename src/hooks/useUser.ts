import { getUser } from '@/lib/auth'

export function useUser() {
  const user = getUser()
  
  return {
    user,
    isLoading: false,
    error: null
  }
}