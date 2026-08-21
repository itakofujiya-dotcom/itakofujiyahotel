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
  if (!isRecord(value) || !Array.isArray(value.rooms)) return false
  return (
    typeof value.checkIn === 'string' &&
    typeof value.checkOut === 'string' &&
    typeof value.roomCount === 'number' &&
    typeof value.totalAmountYen === 'number' &&
    value.rooms.length === value.roomCount &&
    value.rooms.every(isBookingRoom)
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
    typeof value.roomCount === 'number' &&
    typeof value.totalAmountYen === 'number' &&
    Array.isArray(value.rooms) &&
    value.rooms.every(isBookingRoom) &&
    value.status === 'confirmed'
  )
}

function isBookingRoom(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.roomIndex === 'number' &&
    typeof value.roomTypeId === 'string' &&
    typeof value.roomTypeNameJa === 'string' &&
    typeof value.adultGuestCount === 'number' &&
    typeof value.paidChildCount === 'number' &&
    typeof value.freePreschoolCount === 'number' &&
    (value.mealPlan === 'breakfast' || value.mealPlan === 'breakfast_dinner') &&
    typeof value.baseRoomTotalYen === 'number' &&
    typeof value.mealSurchargeYen === 'number' &&
    typeof value.subtotalYen === 'number' &&
    Array.isArray(value.nightlyPrices)
  )
}
