import { supabase } from '../../lib/supabase/client'
import type { AdminHotelSettings, AdminHotelSettingsForm } from './types'
import { normalizeAdminHotelSettingsForm } from './admin-settings-helpers'

const settingsSelect = `
  id, hotel_name_ja, hotel_name_en, postal_code, address_ja,
  telephone, fax, email, check_in_time, check_out_time,
  front_desk_open, front_desk_close, updated_at
`

export async function fetchAdminHotelSettings(): Promise<AdminHotelSettings> {
  const { data, error } = await supabase
    .from('hotel_settings')
    .select(settingsSelect)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error) throwSettingsError('load', error)
  return data
}

export async function updateAdminHotelSettings(
  id: string,
  form: AdminHotelSettingsForm,
): Promise<AdminHotelSettings> {
  const normalized = normalizeAdminHotelSettingsForm(form)
  const { data, error } = await supabase
    .from('hotel_settings')
    .update({
      hotel_name_ja: normalized.hotelNameJa,
      hotel_name_en: normalized.hotelNameEn || null,
      postal_code: normalized.postalCode || null,
      address_ja: normalized.addressJa,
      telephone: normalized.telephone,
      fax: normalized.fax || null,
      email: normalized.email || null,
      check_in_time: normalized.checkInTime,
      check_out_time: normalized.checkOutTime,
      front_desk_open: normalized.frontDeskOpen,
      front_desk_close: normalized.frontDeskClose,
    })
    .eq('id', id)
    .select(settingsSelect)
    .single()
  if (error) throwSettingsError('update', error)
  return data
}

function throwSettingsError(
  operation: string,
  error: { code: string; message: string },
): never {
  console.error(`[Admin settings] Failed to ${operation} hotel settings.`, {
    code: error.code,
    message: error.message,
  })
  throw new Error(`ADMIN_SETTINGS_${error.code}`)
}
