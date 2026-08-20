import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type {
  AdminAccessIssue,
  AdminLoginResult,
  AdminProfile,
  AdminRole,
} from '../../types/admin'

export type AdminAuthContextValue = {
  user: User | null
  adminProfile: AdminProfile | null
  isAuthenticated: boolean
  isAdmin: boolean
  isLoading: boolean
  accessIssue: AdminAccessIssue | null
  login: (email: string, password: string) => Promise<AdminLoginResult>
  logout: () => Promise<void>
  hasRole: (allowedRoles: AdminRole[]) => boolean
}

export const AdminAuthContext = createContext<
  AdminAuthContextValue | undefined
>(undefined)
