import { isAfter, isBefore, startOfToday } from 'date-fns'
import type { BookingSearchParams } from '../../types/domain'

export function validateBookingSearch(
  values: BookingSearchParams,
): string | null {
  if (!values.checkIn || !values.checkOut)
    return 'チェックイン日とチェックアウト日を選択してください。'
  if (isBefore(values.checkIn, startOfToday()))
    return '過去の日付は選択できません。'
  if (!isAfter(values.checkOut, values.checkIn))
    return 'チェックアウト日はチェックイン日より後にしてください。'
  if (values.adults < 1) return '大人の人数を選択してください。'
  return null
}
