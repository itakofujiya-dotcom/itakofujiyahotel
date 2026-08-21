import { supabase } from '../../lib/supabase/client'
import type {
  AvailableRoomTypeResult,
  BookingSearchParams,
  NightlyPrice,
  NightlyRoomPrice,
} from './types'

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
