export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'checked_in'
  | 'checked_out'
  | 'no_show'

export type BookingSource = 'online' | 'phone' | 'walk_in' | 'admin'

export type ReservationGuest = {
  id: string
  name: string
  name_kana_or_roman: string | null
  email: string
  telephone: string
}

export type ReservationRoomType = {
  id: string
  code: string
  name_ja: string
}

export type ReservationListRoom = {
  id: string
  room_type_id: string
  paid_guest_count: number
  free_preschool_count: number
  room_type: ReservationRoomType
}

export type ReservationListItem = {
  id: string
  reservation_number: string
  check_in: string
  check_out: string
  adults: number
  paid_children: number
  free_preschool_children: number
  status: ReservationStatus
  booking_source: BookingSource
  total_amount_yen: number | null
  admin_seen_at: string | null
  has_pending_bank_transfer: boolean
  created_at: string
  guest: ReservationGuest
  rooms: ReservationListRoom[]
}

export type ReservationNight = {
  id: string
  stay_date: string
  price_per_person_yen: number
  paid_guest_count: number
  room_total_yen: number
}

export type AssignedRoom = {
  id: string
  room_number: string
  sales_status: 'active' | 'inactive' | 'admin_only' | 'maintenance'
}

export type ReservationDetailRoom = ReservationListRoom & {
  room_id: string | null
  quoted_price_per_person_yen: number | null
  quoted_room_total_yen: number | null
  assigned_room: AssignedRoom | null
  nights: ReservationNight[]
}

export type ReservationDetail = Omit<ReservationListItem, 'rooms'> & {
  expected_check_in_time: string | null
  guest_note: string | null
  admin_note: string | null
  cancelled_at: string | null
  cancellation_fee_rate: number | null
  cancellation_fee_yen: number | null
  rooms: ReservationDetailRoom[]
  payment: {
    id: string
    method: 'pay_at_hotel' | 'bank_transfer' | 'card'
    status: 'pending' | 'awaiting_payment' | 'paid' | 'refunded' | 'cancelled'
    amount_yen: number
  } | null
}

export type ReservationFilters = {
  status: ReservationStatus | 'all'
  source: BookingSource | 'all'
  checkIn: string
  checkOut: string
  stayDate: string
  search: string
  newOnly: boolean
  payment: 'all' | 'bank_transfer_pending'
  operation: 'all' | 'today_check_in' | 'today_check_out'
}

export type CreateAdminReservationInput = {
  guest: {
    name: string
    name_kana_or_roman: string
    email: string
    telephone: string
    nationality: string
    postal_code: string
    address: string
  }
  reservation: {
    check_in: string
    check_out: string
    booking_source: Exclude<BookingSource, 'online'>
    expected_check_in_time: string
    guest_note: string
    admin_note: string
  }
  rooms: {
    room_type_id: string
    paid_guest_count: number
    free_preschool_count: number
  }[]
}

export type AssignableRoom = AssignedRoom
