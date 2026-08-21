import type { BookingGuestDraft } from './types'

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
  if (guest.nameKanaOrRoman.trim().length < 2)
    errors.nameKanaOrRoman = 'フリガナまたは英文名を入力してください。'
  if (guest.telephone.trim().length < 6)
    errors.telephone = '電話番号を入力してください。'
  if (!emailPattern.test(guest.email.trim()))
    errors.email = '正しいメールアドレスを入力してください。'
  if (!guest.expectedCheckInTime)
    errors.expectedCheckInTime = 'チェックイン予定時間を選択してください。'
  else if (
    guest.expectedCheckInTime < '16:00' ||
    guest.expectedCheckInTime > '22:00'
  )
    errors.expectedCheckInTime = '16:00〜22:00の間で選択してください。'
  if (guest.guestNote.length > 1000)
    errors.guestNote = 'ご要望は1,000文字以内で入力してください。'
  return errors
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
