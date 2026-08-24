import type { MealPlan } from '../booking/types'
import type {
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '../admin-reservations/types'

export type PublicReservationRoom = {
  roomIndex: number
  roomTypeNameJa: string
  adultGuestCount: number
  paidChildCount: number
  freePreschoolCount: number
  mealPlan: MealPlan
}

export type ReservationCancellationQuote = {
  policyCode: string
  policyDescriptionJa: string | null
  daysBefore: number
  feePercent: number
  feeYen: number
  refundTargetYen: number
}

export type PublicReservationLookup = ReservationCancellationQuote & {
  reservationNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  rooms: PublicReservationRoom[]
  totalAmountYen: number
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus | null
  reservationStatus: ReservationStatus
  cancellable: boolean
  cancelledAt: string | null
  recordedCancellationFeePercent: number | null
  recordedCancellationFeeYen: number | null
}

export type PublicCancellationResult = {
  reservationNumber: string
  feePercent: number
  feeYen: number
  refundTargetYen: number
  releasedInventoryBlocks: number
  automaticRefundProcessed: false
}
