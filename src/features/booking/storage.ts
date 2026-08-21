import type {
  BookingCompletion,
  BookingDraft,
  BookingSubmissionDraft,
} from './types'

export const bookingDraftStorageKey = 'itako-fujiya-booking-draft'
export const bookingGuestStorageKey = 'itako-fujiya-booking-guest'
export const bookingCompletionStorageKey = 'itako-fujiya-booking-completion'

export function readBookingDraft(): BookingDraft | null {
  return readSessionValue<BookingDraft>(bookingDraftStorageKey, isBookingDraft)
}

export function writeBookingDraft(draft: BookingDraft) {
  sessionStorage.setItem(bookingDraftStorageKey, JSON.stringify(draft))
}

export function readBookingGuestDraft(): BookingSubmissionDraft | null {
  return readSessionValue<BookingSubmissionDraft>(
    bookingGuestStorageKey,
    isBookingGuestDraft,
  )
}

export function writeBookingGuestDraft(draft: BookingSubmissionDraft) {
  sessionStorage.setItem(bookingGuestStorageKey, JSON.stringify(draft))
}

export function readBookingCompletion(): BookingCompletion | null {
  return readSessionValue<BookingCompletion>(
    bookingCompletionStorageKey,
    isBookingCompletion,
  )
}

export function completeBooking(result: BookingCompletion) {
  sessionStorage.removeItem(bookingDraftStorageKey)
  sessionStorage.removeItem(bookingGuestStorageKey)
  sessionStorage.setItem(bookingCompletionStorageKey, JSON.stringify(result))
}

function readSessionValue<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T | null {
  try {
    const stored = sessionStorage.getItem(key)
    if (!stored) return null
    const parsed: unknown = JSON.parse(stored)
    if (!validate(parsed)) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed
  } catch {
    sessionStorage.removeItem(key)
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isBookingDraft(value: unknown): value is BookingDraft {
  if (!isRecord(value) || !isRecord(value.selectedRoomType)) return false
  return (
    typeof value.checkIn === 'string' &&
    typeof value.checkOut === 'string' &&
    typeof value.roomCount === 'number' &&
    typeof value.totalAmountYen === 'number' &&
    typeof value.selectedRoomType.id === 'string' &&
    typeof value.selectedRoomType.nameJa === 'string' &&
    Array.isArray(value.guestDistribution) &&
    Array.isArray(value.nightlyPrices)
  )
}

function isBookingGuestDraft(value: unknown): value is BookingSubmissionDraft {
  if (!isRecord(value)) return false
  return (
    typeof value.bookingRequestId === 'string' &&
    typeof value.name === 'string' &&
    typeof value.nameKanaOrRoman === 'string' &&
    typeof value.telephone === 'string' &&
    typeof value.email === 'string' &&
    typeof value.expectedCheckInTime === 'string' &&
    typeof value.guestNote === 'string'
  )
}

function isBookingCompletion(value: unknown): value is BookingCompletion {
  if (!isRecord(value)) return false
  return (
    typeof value.reservationId === 'string' &&
    typeof value.reservationNumber === 'string' &&
    typeof value.checkIn === 'string' &&
    typeof value.checkOut === 'string' &&
    typeof value.roomTypeName === 'string' &&
    typeof value.roomCount === 'number' &&
    typeof value.totalAmountYen === 'number' &&
    value.status === 'confirmed'
  )
}
