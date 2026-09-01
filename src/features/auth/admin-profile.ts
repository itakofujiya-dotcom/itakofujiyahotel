import { supabase } from '../../lib/supabase/client'
import type { AdminAccessIssue, AdminProfile } from '../../types/admin'

export type AdminProfileResult =
  | { profile: AdminProfile; issue: null }
  | {
      profile: null
      issue: Exclude<AdminAccessIssue, 'invalid_credentials' | 'network_error'>
    }

export async function fetchAdminProfile(
  userId: string,
): Promise<AdminProfileResult> {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('user_id, display_name, role, is_active')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('[Admin auth] Failed to load the administrator profile.', {
      code: error.code,
      message: error.message,
    })
    return { profile: null, issue: 'profile_error' }
  }

  if (!data) return { profile: null, issue: 'no_profile' }
  if (!data.is_active) return { profile: null, issue: 'inactive' }

  return { profile: data, issue: null }
}
