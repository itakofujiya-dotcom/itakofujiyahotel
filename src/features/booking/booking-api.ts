import { supabase } from '../../lib/supabase/client'
import type {
  BookingDraft,
  BookingSubmissionDraft,
  CancellationPolicy,
  NightlyPrice,
  PublicBookingResult,
  PublicHotelInfo,
} from './types'

export async function createPublicReservation(
  booking: BookingDraft,
  guest: BookingSubmissionDraft,
): Promise<PublicBookingResult> {
  const { data, error } = await supabase.rpc('create_public_reservation', {
    p_booking_request_id: guest.bookingRequestId,
    p_check_in: booking.checkIn,
    p_check_out: booking.checkOut,
    p_adults: booking.adults,
    p_paid_children: booking.paidChildren,
    p_free_preschool_children: booking.freePreschoolChildren,
    p_room_count: booking.roomCount,
    p_room_type_id: booking.selectedRoomType.id,
    p_name: guest.name.trim(),
    p_name_kana_or_roman: guest.nameKanaOrRoman.trim(),
    p_telephone: guest.telephone.trim(),
    p_email: guest.email.trim(),
    p_expected_check_in_time: guest.expectedCheckInTime,
    p_guest_note: guest.guestNote.trim(),
    p_expected_total_yen: booking.totalAmountYen,
  })
  if (error) {
    console.error('[Public booking] Reservation request failed.', {
      code: error.code,
      message: error.message,
    })
    return { ok: false, code: 'BOOKING_FAILED' }
  }
  return parsePublicBookingResult(data)
}

export async function getPublicBookingInformation(): Promise<{
  hotel: PublicHotelInfo
  cancellationPolicies: CancellationPolicy[]
}> {
  const [settingsResult, policiesResult] = await Promise.all([
    supabase
      .from('hotel_settings')
      .select('telephone, check_in_time, front_desk_open, front_desk_close')
      .limit(1)
      .single(),
    supabase
      .from('cancellation_policies')
      .select(
        'id, code, min_days_before, max_days_before, fee_percent, is_no_show, description_ja, display_order',
      )
      .eq('is_active', true)
      .order('display_order'),
  ])
  if (settingsResult.error || policiesResult.error)
    throw new Error('PUBLIC_BOOKING_INFORMATION_FAILED')
  return {
    hotel: {
      telephone: settingsResult.data.telephone ?? '0299-62-2000',
      checkInTime: settingsResult.data.check_in_time,
      frontDeskOpen: settingsResult.data.front_desk_open,
      frontDeskClose: settingsResult.data.front_desk_close,
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
      roomTypeName: requireString(value.roomTypeName),
      roomCount: requireNumber(value.roomCount),
      adults: requireNumber(value.adults),
      paidChildren: requireNumber(value.paidChildren),
      freePreschoolChildren: requireNumber(value.freePreschoolChildren),
      totalAmountYen: requireNumber(value.totalAmountYen),
      status: 'confirmed',
    }
  }
  if (value.ok === false && value.code === 'PRICE_CHANGED') {
    return {
      ok: false,
      code: 'PRICE_CHANGED',
      previousTotalAmountYen: requireNumber(value.previousTotalAmountYen),
      newTotalAmountYen: requireNumber(value.newTotalAmountYen),
      nightlyPrices: parseNightlyPrices(value.nightlyPrices),
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

function parseNightlyPrices(value: unknown): NightlyPrice[] {
  if (!Array.isArray(value)) throw new Error('INVALID_NIGHTLY_PRICES')
  return value.map((night) => {
    if (!isRecord(night) || !Array.isArray(night.rooms))
      throw new Error('INVALID_NIGHTLY_PRICE')
    return {
      stayDate: requireString(night.stayDate),
      nightTotalYen: requireNumber(night.nightTotalYen),
      rooms: night.rooms.map((room) => {
        if (!isRecord(room)) throw new Error('INVALID_ROOM_PRICE')
        return {
          roomIndex: requireNumber(room.roomIndex),
          guestCount: requireNumber(room.guestCount),
          pricePerPersonYen: requireNumber(room.pricePerPersonYen),
          roomTotalYen: requireNumber(room.roomTotalYen),
          isSpecialRate: room.isSpecialRate === true,
        }
      }),
    }
  })
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
