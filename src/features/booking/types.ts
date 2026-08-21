export type BookingSearchParams = {
  checkIn: string
  checkOut: string
  adults: number
  paidChildren: number
  freePreschoolChildren: number
  roomCount: number
}

export type GuestDistribution = number[]

export type MealPlan = 'breakfast' | 'breakfast_dinner'

export type BookingRoomInput = {
  roomTypeId: string
  adultGuestCount: number
  paidChildCount: number
  freePreschoolCount: number
  mealPlan: MealPlan
}

export type PublicRoomType = {
  id: string
  code: 'japanese' | 'western'
  nameJa: string
}

export type NightlyRoomPrice = {
  roomIndex: number
  guestCount: number
  pricePerPersonYen: number
  roomTotalYen: number
  isSpecialRate: boolean
}

export type NightlyPrice = {
  stayDate: string
  rooms: NightlyRoomPrice[]
  nightTotalYen: number
}

export type AvailableRoomTypeResult = {
  roomTypeId: string
  code: 'japanese' | 'western'
  nameJa: string
  availableQuantity: number
  isAvailable: boolean
  guestDistribution: GuestDistribution
  nightlyPrices: NightlyPrice[]
  minPricePerPersonYen: number
  totalAmountYen: number
}

export type MixedBookingRoomQuote = BookingRoomInput & {
  roomIndex: number
  roomTypeCode: 'japanese' | 'western'
  roomTypeNameJa: string
  nightlyPrices: {
    stayDate: string
    guestCount: number
    pricePerPersonYen: number
    roomTotalYen: number
    isSpecialRate: boolean
  }[]
  baseRoomTotalYen: number
  mealSurchargeYen: number
  subtotalYen: number
}

export type MixedBookingQuote = {
  rooms: MixedBookingRoomQuote[]
  totalAmountYen: number
}

export type BookingDraft = BookingSearchParams & {
  rooms: MixedBookingRoomQuote[]
  totalAmountYen: number
  searchedAt: string
}

export type BookingGuestDraft = {
  name: string
  nameKanaOrRoman: string
  telephone: string
  email: string
  expectedCheckInTime: string
  guestNote: string
}

export type BookingSubmissionDraft = BookingGuestDraft & {
  bookingRequestId: string
}

export type BookingCompletion = {
  reservationId: string
  reservationNumber: string
  checkIn: string
  checkOut: string
  roomCount: number
  adults: number
  paidChildren: number
  freePreschoolChildren: number
  totalAmountYen: number
  rooms: MixedBookingRoomQuote[]
  status: 'confirmed'
}

export type PublicBookingResult =
  | ({
      ok: true
      code: 'BOOKING_CONFIRMED'
      idempotent: boolean
    } & BookingCompletion)
  | { ok: false; code: 'BOOKING_NO_LONGER_AVAILABLE' }
  | {
      ok: false
      code: 'PRICE_CHANGED'
      previousTotalAmountYen: number
      newTotalAmountYen: number
      rooms: MixedBookingRoomQuote[]
    }
  | { ok: false; code: 'INVALID_BOOKING' | 'BOOKING_FAILED' }

export type CancellationPolicy = {
  id: string
  code: string
  minDaysBefore: number | null
  maxDaysBefore: number | null
  feePercent: number
  isNoShow: boolean
  descriptionJa: string | null
  displayOrder: number
}

export type PublicHotelInfo = {
  telephone: string
  checkInTime: string
  frontDeskOpen: string
  frontDeskClose: string
}
