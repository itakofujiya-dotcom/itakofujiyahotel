import type {
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '../admin-reservations/types'

export type CustomerSort = 'recent' | 'visits' | 'name'

export type CustomerStats = {
  totalReservations: number
  completedStays: number
  firstVisit: string | null
  recentVisit: string | null
  totalNights: number
  averageVisitIntervalDays: number | null
}

export type CustomerSummary = CustomerStats & {
  id: string
  name: string
  phone: string
  email: string | null
  memo: string | null
}

export type CustomerReservationHistory = {
  id: string
  reservation_number: string
  check_in: string
  check_out: string
  status: ReservationStatus
  rooms: { room_type: { name_ja: string } }[]
  payment: { method: PaymentMethod; status: PaymentStatus } | null
}

export type CustomerDetail = CustomerSummary & {
  reservations: CustomerReservationHistory[]
}
