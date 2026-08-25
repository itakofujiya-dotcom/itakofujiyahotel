import { supabase } from '../../lib/supabase/client'
import { hotelSettings } from '../../data/hotel'
import type {
  BookingDraft,
  BookingSubmissionDraft,
  CancellationPolicy,
  PublicBookingResult,
  PublicHotelInfo,
} from './types'
import type { Json } from '../../types/database'
import { parseMixedBookingRooms, toRoomRpcInput } from './booking-search-api'
import type { SiteLocale } from '../../i18n/public-translations'

export async function createPublicReservation(
  booking: BookingDraft,
  guest: BookingSubmissionDraft,
  locale: SiteLocale,
): Promise<PublicBookingResult> {
  const { data, error } = await supabase.rpc(
    'create_public_mixed_reservation',
    {
      p_booking_request_id: guest.bookingRequestId,
      p_check_in: booking.checkIn,
      p_check_out: booking.checkOut,
      p_rooms: booking.rooms.map(toRoomRpcInput) as unknown as Json,
      p_name: guest.name.trim(),
      p_name_kana_or_roman: guest.nameKanaOrRoman.trim(),
      p_telephone: guest.telephone.trim(),
      p_email: guest.email.trim(),
      p_expected_check_in_time: guest.expectedCheckInTime,
      p_guest_note: guest.guestNote.trim(),
      p_expected_total_yen: booking.totalAmountYen,
      p_locale: locale,
    },
  )
  if (error) {
    console.error('[Public booking] Reservation request failed.', {
      code: error.code,
      message: error.message,
    })
    return { ok: false, code: 'BOOKING_FAILED' }
  }
  return parsePublicBookingResult(data)
}

export async function requestReservationCreatedNotifications(
  reservationId: string,
  bookingRequestId: string,
): Promise<'processed' | 'queued'> {
  try {
    const { error } = await supabase.functions.invoke(
      'send-reservation-notifications',
      { body: { reservationId, bookingRequestId } },
    )
    if (!error) return 'processed'
    // The transactional outbox remains pending for the scheduled worker. This
    // must never turn a successfully created reservation into a booking error.
    console.warn('[Reservation email] Immediate delivery was deferred.', {
      message: error.message,
    })
  } catch (error) {
    console.warn('[Reservation email] Immediate delivery was deferred.', {
      errorType: error instanceof Error ? error.name : 'UnknownError',
    })
  }
  return 'queued'
}

export async function getPublicBookingInformation(): Promise<{
  hotel: PublicHotelInfo
  cancellationPolicies: CancellationPolicy[]
}> {
  const [settingsResult, policiesResult] = await Promise.all([
    supabase.rpc('get_public_hotel_information'),
    supabase
      .from('cancellation_policies')
      .select(
        'id, code, min_days_before, max_days_before, fee_percent, is_no_show, description_ja, display_order',
      )
      .eq('is_active', true)
      .order('display_order'),
  ])
  if (settingsResult.error || !settingsResult.data?.[0] || policiesResult.error)
    throw new Error('PUBLIC_BOOKING_INFORMATION_FAILED')
  const publicSettings = settingsResult.data[0]
  return {
    hotel: {
      telephone: publicSettings.telephone ?? hotelSettings.telephone,
      checkInTime: publicSettings.check_in_time,
      frontDeskOpen: publicSettings.front_desk_open,
      frontDeskClose: publicSettings.front_desk_close,
    },
    cancellationPolicies: policiesResult.data.map((policy) => ({
      id: policy.id,
      code: policy.code,
      minDaysBefore: policy.min_days_before,
      maxDaysBefore: policy.max_days_before,
      feePercent: Number(policy.fee_percent),
      isNoShow: policy.is_no_show,
      descriptionJa: policy.description_ja,
      displayOrder: policy.display_order,
    })),
  }
}

function parsePublicBookingResult(value: unknown): PublicBookingResult {
  if (!isRecord(value) || typeof value.code !== 'string')
    return { ok: false, code: 'BOOKING_FAILED' }
  if (value.ok === true && value.code === 'BOOKING_CONFIRMED') {
    return {
      ok: true,
      code: 'BOOKING_CONFIRMED',
      idempotent: value.idempotent === true,
      reservationId: requireString(value.reservationId),
      reservationNumber: requireString(value.reservationNumber),
      checkIn: requireString(value.checkIn),
      checkOut: requireString(value.checkOut),
      roomCount: requireNumber(value.roomCount),
      adults: requireNumber(value.adults),
      paidChildren: requireNumber(value.paidChildren),
      freePreschoolChildren: requireNumber(value.freePreschoolChildren),
      totalAmountYen: requireNumber(value.totalAmountYen),
      rooms: parseMixedBookingRooms(value.rooms),
      status: 'confirmed',
    }
  }
  if (value.ok === false && value.code === 'PRICE_CHANGED') {
    return {
      ok: false,
      code: 'PRICE_CHANGED',
      previousTotalAmountYen: requireNumber(value.previousTotalAmountYen),
      newTotalAmountYen: requireNumber(value.newTotalAmountYen),
      rooms: parseMixedBookingRooms(value.rooms),
    }
  }
  if (
    value.ok === false &&
    (value.code === 'BOOKING_NO_LONGER_AVAILABLE' ||
      value.code === 'INVALID_BOOKING' ||
      value.code === 'BOOKING_FAILED')
  )
    return { ok: false, code: value.code }
  return { ok: false, code: 'BOOKING_FAILED' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_BOOKING_RESPONSE')
  return value
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('INVALID_BOOKING_RESPONSE')
  return value
}
