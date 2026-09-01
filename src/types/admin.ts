export type AdminRole = 'owner' | 'manager' | 'staff'

export type AdminProfile = {
  user_id: string
  display_name: string
  role: AdminRole
  is_active: boolean
}

export type AdminAccessIssue =
  | 'invalid_credentials'
  | 'network_error'
  | 'no_profile'
  | 'inactive'
  | 'profile_error'

export type AdminLoginResult =
  { success: true } | { success: false; issue: AdminAccessIssue }
