import type { BookingGuestDraft } from './types'

export const CHECK_IN_START_TIME = '15:00'
export const CHECK_IN_END_TIME = '22:00'
export const CHECK_IN_TIME_OPTIONS = [
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
] as const
export const CHECK_IN_TIME_RANGE_MESSAGE = `${CHECK_IN_START_TIME}〜${CHECK_IN_END_TIME}の間で選択してください。`

export function isExpectedCheckInTimeValid(value: string): boolean {
  return value >= CHECK_IN_START_TIME && value <= CHECK_IN_END_TIME
}

export type BookingGuestErrors = Partial<
  Record<keyof BookingGuestDraft, string>
>

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateBookingGuest(
  guest: BookingGuestDraft,
): BookingGuestErrors {
  const errors: BookingGuestErrors = {}
  if (guest.name.trim().length < 2)
    errors.name = '氏名を2文字以上で入力してください。'
  if (!isNameKanaOrRomanValid(guest.nameKanaOrRoman))
    errors.nameKanaOrRoman = 'フリガナまたは英文名を入力してください。'
  if (guest.telephone.trim().length < 6)
    errors.telephone = '電話番号を入力してください。'
  if (!emailPattern.test(guest.email.trim()))
    errors.email = '正しいメールアドレスを入力してください。'
  if (!guest.expectedCheckInTime)
    errors.expectedCheckInTime = 'チェックイン予定時間を選択してください。'
  else if (!isExpectedCheckInTimeValid(guest.expectedCheckInTime))
    errors.expectedCheckInTime = CHECK_IN_TIME_RANGE_MESSAGE
  if (guest.guestNote.length > 1000)
    errors.guestNote = 'ご要望は1,000文字以内で入力してください。'
  return errors
}

export function isNameKanaOrRomanValid(value: string): boolean {
  const length = value.trim().length
  return length >= 2 && length <= 100
}

export function hasBookingGuestErrors(errors: BookingGuestErrors) {
  return Object.keys(errors).length > 0
}

export function canSubmitPublicBooking({
  privacyConsent,
  policyConsent,
  isSubmitting,
}: {
  privacyConsent: boolean
  policyConsent: boolean
  isSubmitting: boolean
}) {
  return privacyConsent && policyConsent && !isSubmitting
}
