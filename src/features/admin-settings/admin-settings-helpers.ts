import type { AdminHotelSettings, AdminHotelSettingsForm } from './types'

export function toAdminHotelSettingsForm(
  settings: AdminHotelSettings,
): AdminHotelSettingsForm {
  return {
    hotelNameJa: settings.hotel_name_ja,
    hotelNameEn: settings.hotel_name_en ?? '',
    postalCode: settings.postal_code ?? '',
    addressJa: settings.address_ja ?? '',
    telephone: settings.telephone ?? '',
    fax: settings.fax ?? '',
    email: settings.email ?? '',
    checkInTime: settings.check_in_time.slice(0, 5),
    checkOutTime: settings.check_out_time.slice(0, 5),
    frontDeskOpen: settings.front_desk_open.slice(0, 5),
    frontDeskClose: settings.front_desk_close.slice(0, 5),
  }
}

export function normalizeAdminHotelSettingsForm(
  form: AdminHotelSettingsForm,
): AdminHotelSettingsForm {
  return {
    ...form,
    hotelNameJa: form.hotelNameJa.trim(),
    hotelNameEn: form.hotelNameEn.trim(),
    postalCode: form.postalCode.trim(),
    addressJa: form.addressJa.trim(),
    telephone: form.telephone.trim(),
    fax: form.fax.trim(),
    email: form.email.trim().toLowerCase(),
  }
}

export function validateAdminHotelSettings(
  form: AdminHotelSettingsForm,
): string | null {
  const normalized = normalizeAdminHotelSettingsForm(form)
  if (!normalized.hotelNameJa) return 'ホテル名を入力してください。'
  if (!normalized.addressJa) return '住所を入力してください。'
  if (!normalized.telephone) return '電話番号を入力してください。'
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email))
    return '有効なメールアドレスを入力してください。'
  for (const time of [
    normalized.checkInTime,
    normalized.checkOutTime,
    normalized.frontDeskOpen,
    normalized.frontDeskClose,
  ]) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
      return '時刻を正しく入力してください。'
  }
  if (normalized.frontDeskOpen >= normalized.frontDeskClose)
    return 'フロント対応終了時間は開始時間より後にしてください。'
  return null
}

export function areAdminHotelSettingsEqual(
  left: AdminHotelSettingsForm,
  right: AdminHotelSettingsForm,
): boolean {
  return (
    JSON.stringify(normalizeAdminHotelSettingsForm(left)) ===
    JSON.stringify(normalizeAdminHotelSettingsForm(right))
  )
}
