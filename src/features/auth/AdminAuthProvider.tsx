import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase/client'
import type {
  AdminAccessIssue,
  AdminLoginResult,
  AdminProfile,
  AdminRole,
} from '../../types/admin'
import { fetchAdminProfile } from './admin-profile'
import { AdminAuthContext } from './admin-auth-context'
import { classifyAdminSignInError, hasAdminRole } from './authorization'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessIssue, setAccessIssue] = useState<AdminAccessIssue | null>(null)

  const synchronizeUser = useCallback(
    async (nextUser: User | null): Promise<AdminAccessIssue | null> => {
      if (!nextUser) {
        setUser(null)
        setAdminProfile(null)
        setIsLoading(false)
        return null
      }

      setIsLoading(true)
      setUser(nextUser)
      const result = await fetchAdminProfile(nextUser.id)

      if (result.issue) {
        setAccessIssue(result.issue)
        setUser(null)
        setAdminProfile(null)
        await supabase.auth.signOut({ scope: 'local' })
        setIsLoading(false)
        return result.issue
      }

      setAdminProfile(result.profile)
      setAccessIssue(null)
      setIsLoading(false)
      return null
    },
    [],
  )

  useEffect(() => {
    let active = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        console.error('[Admin auth] Failed to restore the session.', {
          message: error.message,
        })
        setAccessIssue('profile_error')
        setIsLoading(false)
        return
      }
      void synchronizeUser(data.session?.user ?? null)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // Run Supabase queries outside the auth callback's internal lock.
        window.setTimeout(() => {
          if (active) void synchronizeUser(session?.user ?? null)
        }, 0)
      },
    )

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [synchronizeUser])

  const login = useCallback(
    async (email: string, password: string): Promise<AdminLoginResult> => {
      setAccessIssue(null)
      setIsLoading(true)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error || !data.user) {
        if (error) {
          console.error('[Admin auth] Sign-in failed.', {
            code: error.code,
            status: error.status,
          })
        }
        setUser(null)
        setAdminProfile(null)
        setIsLoading(false)
        const issue = error
          ? classifyAdminSignInError(error)
          : 'invalid_credentials'
        setAccessIssue(issue)
        return { success: false, issue }
      }

      const issue = await synchronizeUser(data.user)
      if (issue) return { success: false, issue }
      return { success: true }
    },
    [synchronizeUser],
  )

  const logout = useCallback(async () => {
    setAccessIssue(null)
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('[Admin auth] Sign-out failed.', { message: error.message })
    }
    setUser(null)
    setAdminProfile(null)
    setIsLoading(false)
  }, [])

  const hasRole = useCallback(
    (allowedRoles: AdminRole[]) => hasAdminRole(adminProfile, allowedRoles),
    [adminProfile],
  )

  const value = useMemo(
    () => ({
      user,
      adminProfile,
      isAuthenticated: Boolean(user),
      isAdmin: Boolean(adminProfile?.is_active),
      isLoading,
      accessIssue,
      login,
      logout,
      hasRole,
    }),
    [user, adminProfile, isLoading, accessIssue, login, logout, hasRole],
  )

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}
