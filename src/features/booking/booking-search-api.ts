import { supabase } from '../../lib/supabase/client'
import type {
  AvailableRoomTypeResult,
  BookingRoomInput,
  BookingSearchParams,
  MixedBookingQuote,
  MixedBookingRoomQuote,
  NightlyPrice,
  NightlyRoomPrice,
} from './types'
import type { Json } from '../../types/database'

export async function searchAvailableRoomTypes(
  params: BookingSearchParams,
): Promise<AvailableRoomTypeResult[]> {
  const { data, error } = await supabase.rpc('search_available_room_types', {
    p_check_in: params.checkIn,
    p_check_out: params.checkOut,
    p_adults: params.adults,
    p_paid_children: params.paidChildren,
    p_free_preschool_children: params.freePreschoolChildren,
    p_room_count: params.roomCount,
  })
  if (error) {
    console.error('[Booking search] Availability request failed.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('BOOKING_SEARCH_FAILED')
  }

  return data.map((row) => ({
    roomTypeId: row.room_type_id,
    code: parseRoomTypeCode(row.room_type_code),
    nameJa: row.room_type_name_ja,
    availableQuantity: row.available_quantity,
    isAvailable: row.is_available,
    guestDistribution: parseNumberArray(row.guest_distribution),
    nightlyPrices: parseNightlyPrices(row.nightly_prices),
    minPricePerPersonYen: row.min_price_per_person_yen,
    totalAmountYen: row.estimated_total_yen,
  }))
}

export async function searchMixedRoomBooking({
  checkIn,
  checkOut,
  rooms,
}: {
  checkIn: string
  checkOut: string
  rooms: BookingRoomInput[]
}): Promise<MixedBookingQuote> {
  const { data, error } = await supabase.rpc('search_public_mixed_booking', {
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_rooms: rooms.map(toRoomRpcInput) as unknown as Json,
  })
  if (error) {
    console.error('[Booking search] Mixed-room quote failed.', {
      code: error.code,
      message: error.message,
    })
    throw new Error('BOOKING_SEARCH_FAILED')
  }
  if (!isRecord(data) || data.ok !== true) {
    const code = isRecord(data) ? data.code : undefined
    if (code === 'BOOKING_NO_LONGER_AVAILABLE')
      throw new Error('BOOKING_NO_LONGER_AVAILABLE')
    if (code === 'INVALID_BOOKING') throw new Error('INVALID_BOOKING')
    throw new Error('BOOKING_SEARCH_FAILED')
  }
  return {
    rooms: parseMixedBookingRooms(data.rooms),
    totalAmountYen: requireNumber(data.totalAmountYen),
  }
}

export function toRoomRpcInput(room: BookingRoomInput) {
  return {
    room_type_id: room.roomTypeId,
    adult_guest_count: room.adultGuestCount,
    paid_child_count: room.paidChildCount,
    free_preschool_count: room.freePreschoolCount,
    meal_plan: room.mealPlan,
  }
}

export function parseMixedBookingRooms(
  value: unknown,
): MixedBookingRoomQuote[] {
  if (!Array.isArray(value)) throw new Error('BOOKING_SEARCH_INVALID_ROOMS')
  return value.map((room) => {
    if (!isRecord(room) || !Array.isArray(room.nightlyPrices))
      throw new Error('BOOKING_SEARCH_INVALID_ROOM')
    return {
      roomIndex: requireNumber(room.roomIndex),
      roomTypeId: requireString(room.roomTypeId),
      roomTypeCode: parseRoomTypeCode(requireString(room.roomTypeCode)),
      roomTypeNameJa: requireString(room.roomTypeNameJa),
      adultGuestCount: requireNumber(room.adultGuestCount),
      paidChildCount: requireNumber(room.paidChildCount),
      freePreschoolCount: requireNumber(room.freePreschoolCount),
      mealPlan:
        room.mealPlan === 'breakfast_dinner' ? 'breakfast_dinner' : 'breakfast',
      nightlyPrices: room.nightlyPrices.map((night) => {
        if (!isRecord(night)) throw new Error('BOOKING_SEARCH_INVALID_NIGHT')
        return {
          stayDate: requireString(night.stayDate),
          guestCount: requireNumber(night.guestCount),
          pricePerPersonYen: requireNumber(night.pricePerPersonYen),
          roomTotalYen: requireNumber(night.roomTotalYen),
          isSpecialRate: night.isSpecialRate === true,
        }
      }),
      baseRoomTotalYen: requireNumber(room.baseRoomTotalYen),
      mealSurchargeYen: requireNumber(room.mealSurchargeYen),
      subtotalYen: requireNumber(room.subtotalYen),
    }
  })
}

function parseRoomTypeCode(value: string): 'japanese' | 'western' {
  if (value === 'japanese' || value === 'western') return value
  throw new Error('BOOKING_SEARCH_INVALID_ROOM_TYPE')
}

function parseNumberArray(value: unknown): number[] {
  if (!Array.isArray(value) || !value.every((item) => Number.isInteger(item)))
    throw new Error('BOOKING_SEARCH_INVALID_DISTRIBUTION')
  return value as number[]
}

function parseNightlyPrices(value: unknown): NightlyPrice[] {
  if (!Array.isArray(value)) throw new Error('BOOKING_SEARCH_INVALID_PRICES')
  return value.map((night) => {
    if (!isRecord(night) || !Array.isArray(night.rooms))
      throw new Error('BOOKING_SEARCH_INVALID_NIGHT')
    return {
      stayDate: requireString(night.stayDate),
      nightTotalYen: requireNumber(night.nightTotalYen),
      rooms: night.rooms.map(parseNightlyRoomPrice),
    }
  })
}

function parseNightlyRoomPrice(value: unknown): NightlyRoomPrice {
  if (!isRecord(value)) throw new Error('BOOKING_SEARCH_INVALID_ROOM_PRICE')
  return {
    roomIndex: requireNumber(value.roomIndex),
    guestCount: requireNumber(value.guestCount),
    pricePerPersonYen: requireNumber(value.pricePerPersonYen),
    roomTotalYen: requireNumber(value.roomTotalYen),
    isSpecialRate: value.isSpecialRate === true,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function requireString(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('BOOKING_SEARCH_INVALID_STRING')
  return value
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('BOOKING_SEARCH_INVALID_NUMBER')
  return value
}
