import type {
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '../admin-reservations/types'

export type SalesQuickRange =
  'today' | 'week' | 'month' | 'last_month' | 'custom'
export type SalesSort = 'latest' | 'oldest' | 'amount'
export type SalesStatusFilter = 'all' | 'normal' | 'cancelled' | 'completed'
export type SalesPaymentFilter = 'all' | PaymentMethod

export type SalesDateRange = {
  startDate: string
  endDate: string
}

export type SalesPaymentMethodSummary = {
  method: PaymentMethod
  reservationRevenueYen: number
  collectedYen: number
  reservationCount: number
}

export type SalesSummary = {
  reservationRevenueYen: number
  collectedYen: number
  reservationCount: number
  completedStayCount: number
  cancellationFeeYen: number
  refundTargetYen: number
  paymentMethods: SalesPaymentMethodSummary[]
}

export type SalesRoomSummary = {
  roomTypeNameJa: string
  roomCount: number
}

export type SalesDetail = {
  reservationId: string
  eventDate: string
  reservationNumber: string
  guestName: string
  checkIn: string
  checkOut: string
  rooms: SalesRoomSummary[]
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus | null
  reservationStatus: ReservationStatus
  reservationAmountYen: number
  recognizedRevenueYen: number
  collectedYen: number
  cancellationFeeYen: number
  refundTargetYen: number
  paymentIssue: 'missing' | 'multiple' | null
}

export type SalesReport = {
  summary: SalesSummary
  details: SalesDetail[]
  totalCount: number
}
