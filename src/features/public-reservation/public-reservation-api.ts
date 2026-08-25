import { supabase } from '../../lib/supabase/client'
import type {
  PublicCancellationResult,
  PublicReservationLookup,
  PublicReservationRoom,
} from './types'

export type PublicReservationErrorCode =
  | 'RESERVATION_NOT_FOUND'
  | 'ALREADY_CANCELLED'
  | 'RESERVATION_NOT_CANCELLABLE'
  | 'ONLINE_CANCELLATION_WINDOW_CLOSED'
  | 'RESERVATION_LOOKUP_FAILED'
  | 'RESERVATION_CANCELLATION_FAILED'

export class PublicReservationError extends Error {
  constructor(readonly code: PublicReservationErrorCode) {
    super(code)
  }
}

export async function lookupPublicReservation({
  reservationNumber,
  contact,
}: {
  reservationNumber: string
  contact: string
}): Promise<PublicReservationLookup> {
  const { data, error } = await supabase.rpc('lookup_public_reservation', {
    p_reservation_number: reservationNumber.trim(),
    p_contact: contact.trim(),
  })
  if (error) {
    console.error('[Public reservation] Lookup RPC failed.', {
      code: error.code,
      message: error.message,
    })
    throw new PublicReservationError('RESERVATION_LOOKUP_FAILED')
  }
  if (!isRecord(data) || data.ok !== true)
    throw new PublicReservationError(
      parseErrorCode(data, 'RESERVATION_LOOKUP_FAILED'),
    )
  return parseLookup(data)
}

export async function cancelPublicReservation({
  reservationNumber,
  contact,
}: {
  reservationNumber: string
  contact: string
}): Promise<PublicCancellationResult> {
  const { data, error } = await supabase.rpc('cancel_public_reservation', {
    p_reservation_number: reservationNumber.trim(),
    p_contact: contact.trim(),
  })
  if (error) {
    console.error('[Public reservation] Cancellation RPC failed.', {
      code: error.code,
      message: error.message,
    })
    throw new PublicReservationError('RESERVATION_CANCELLATION_FAILED')
  }
  if (!isRecord(data) || data.ok !== true)
    throw new PublicReservationError(
      parseErrorCode(data, 'RESERVATION_CANCELLATION_FAILED'),
    )
  const result: PublicCancellationResult = {
    reservationNumber: requireString(data.reservationNumber),
    cancelledAt: requireString(data.cancelledAt),
    checkIn: requireString(data.checkIn),
    checkOut: requireString(data.checkOut),
    feePercent: requireNumber(data.feePercent),
    feeYen: requireNumber(data.feeYen),
    refundTargetYen: requireNumber(data.refundTargetYen),
    releasedInventoryBlocks: requireNumber(data.releasedInventoryBlocks),
    automaticRefundProcessed: false,
  }
  await requestCancellationNotifications(result.reservationNumber, contact)
  return result
}

async function requestCancellationNotifications(
  reservationNumber: string,
  contact: string,
): Promise<void> {
  console.info('[cancellation-email] invoking', { reservationNumber })
  try {
    const { error } = await supabase.functions.invoke(
      'send-cancellation-email',
      {
        body: {
          reservation_number: reservationNumber,
          contact: contact.trim(),
        },
      },
    )
    if (error) throw error
    console.info('[cancellation-email] success', { reservationNumber })
  } catch (error) {
    console.error('[cancellation-email] failed', {
      reservationNumber,
      errorType: error instanceof Error ? error.name : 'UnknownError',
      message:
        error instanceof Error
          ? error.message
          : 'Cancellation email invocation failed.',
    })
  }
}

function parseLookup(value: Record<string, unknown>): PublicReservationLookup {
  return {
    reservationNumber: requireString(value.reservationNumber),
    guestName: requireString(value.guestName),
    guestKana: typeof value.guestKana === 'string' ? value.guestKana : null,
    guestNote: typeof value.guestNote === 'string' ? value.guestNote : null,
    checkIn: requireString(value.checkIn),
    checkOut: requireString(value.checkOut),
    stayNights: requireNumber(value.stayNights),
    roomCount: requireNumber(value.roomCount),
    rooms: parseRooms(value.rooms),
    totalAmountYen: requireNumber(value.totalAmountYen),
    paymentMethod: parseNullablePaymentMethod(value.paymentMethod),
    paymentStatus: parseNullablePaymentStatus(value.paymentStatus),
    reservationStatus: parseReservationStatus(value.reservationStatus),
    cancellable: value.cancellable === true,
    onlineCancellationDeadlineDays: requireNumber(
      value.onlineCancellationDeadlineDays,
    ),
    onlineCancellationReason: parseOnlineCancellationReason(
      value.onlineCancellationReason,
    ),
    policyCode: requireString(value.policyCode),
    policyDescriptionJa:
      typeof value.policyDescriptionJa === 'string'
        ? value.policyDescriptionJa
        : null,
    daysBefore: requireNumber(value.daysBefore),
    feePercent: requireNumber(value.feePercent),
    feeYen: requireNumber(value.feeYen),
    refundTargetYen: requireNumber(value.refundTargetYen),
    cancelledAt:
      typeof value.cancelledAt === 'string' ? value.cancelledAt : null,
    recordedCancellationFeePercent:
      typeof value.recordedCancellationFeePercent === 'number'
        ? value.recordedCancellationFeePercent
        : null,
    recordedCancellationFeeYen:
      typeof value.recordedCancellationFeeYen === 'number'
        ? value.recordedCancellationFeeYen
        : null,
  }
}

function parseRooms(value: unknown): PublicReservationRoom[] {
  if (!Array.isArray(value)) throw new Error('INVALID_RESERVATION_ROOMS')
  return value.map((room) => {
    if (!isRecord(room)) throw new Error('INVALID_RESERVATION_ROOM')
    return {
      roomIndex: requireNumber(room.roomIndex),
      roomTypeNameJa: requireString(room.roomTypeNameJa),
      adultGuestCount: requireNumber(room.adultGuestCount),
      paidChildCount: requireNumber(room.paidChildCount),
      freePreschoolCount: requireNumber(room.freePreschoolCount),
      mealPlan:
        room.mealPlan === 'breakfast_dinner' ? 'breakfast_dinner' : 'breakfast',
    }
  })
}

function parseErrorCode(
  value: unknown,
  fallback: PublicReservationErrorCode,
): PublicReservationErrorCode {
  if (!isRecord(value) || typeof value.code !== 'string') return fallback
  if (
    [
      'RESERVATION_NOT_FOUND',
      'ALREADY_CANCELLED',
      'RESERVATION_NOT_CANCELLABLE',
      'ONLINE_CANCELLATION_WINDOW_CLOSED',
      'RESERVATION_LOOKUP_FAILED',
      'RESERVATION_CANCELLATION_FAILED',
    ].includes(value.code)
  )
    return value.code as PublicReservationErrorCode
  return fallback
}

function parseOnlineCancellationReason(value: unknown) {
  return value === 'ALREADY_CANCELLED' ||
    value === 'STATUS_NOT_CANCELLABLE' ||
    value === 'CONTACT_HOTEL'
    ? value
    : null
}

function parseNullablePaymentMethod(value: unknown) {
  return value === 'pay_at_hotel' ||
    value === 'bank_transfer' ||
    value === 'card'
    ? value
    : null
}

function parseNullablePaymentStatus(value: unknown) {
  return value === 'pending' ||
    value === 'awaiting_payment' ||
    value === 'paid' ||
    value === 'refunded' ||
    value === 'cancelled'
    ? value
    : null
}

function parseReservationStatus(value: unknown) {
  if (
    value === 'pending' ||
    value === 'confirmed' ||
    value === 'cancelled' ||
    value === 'checked_in' ||
    value === 'checked_out' ||
    value === 'no_show'
  )
    return value
  throw new Error('INVALID_RESERVATION_STATUS')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_RESERVATION_RESPONSE')
  return value
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('INVALID_RESERVATION_RESPONSE')
  return value
}
