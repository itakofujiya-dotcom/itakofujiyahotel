import type { AdminProfile, AdminRole } from '../../types/admin'

export type AdminRouteAccess =
  'loading' | 'unauthenticated' | 'unauthorized' | 'inactive' | 'authorized'

export const adminRoleLabels: Record<AdminRole, string> = {
  owner: 'オーナー',
  manager: '管理者',
  staff: 'スタッフ',
}

export function resolveAdminRouteAccess({
  isLoading,
  isAuthenticated,
  adminProfile,
}: {
  isLoading: boolean
  isAuthenticated: boolean
  adminProfile: AdminProfile | null
}): AdminRouteAccess {
  if (isLoading) return 'loading'
  if (!isAuthenticated) return 'unauthenticated'
  if (!adminProfile) return 'unauthorized'
  if (!adminProfile.is_active) return 'inactive'
  return 'authorized'
}

export function hasAdminRole(
  adminProfile: AdminProfile | null,
  allowedRoles: AdminRole[],
): boolean {
  return Boolean(
    adminProfile?.is_active && allowedRoles.includes(adminProfile.role),
  )
}
