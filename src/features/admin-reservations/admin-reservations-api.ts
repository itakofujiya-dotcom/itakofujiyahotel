import { supabase } from '../../lib/supabase/client'
import type { Json } from '../../types/database'
import type {
  AssignableRoom,
  CreateAdminReservationInput,
  ReservationDetail,
  ReservationListItem,
  ReservationRoomType,
  ReservationStatus,
} from './types'

const listSelect = `
  id, reservation_number, check_in, check_out, adults, paid_children,
  free_preschool_children, status, booking_source, total_amount_yen,
  admin_seen_at, created_at,
  guest:guests (id, name, name_kana_or_roman, email, telephone),
  rooms:reservation_rooms (
    id, room_type_id, paid_guest_count, free_preschool_count,
    room_type:room_types (id, code, name_ja)
  )
`

export async function fetchReservations(): Promise<ReservationListItem[]> {
  const { data, error } = await supabase
    .from('reservations')
    .select(listSelect)
    .order('created_at', { ascending: false })
  if (error) throwReservationError('load reservations', error)
  return data.map(mapReservationListItem)
}

export async function fetchReservationDetail(
  reservationId: string,
): Promise<ReservationDetail> {
  const { data, error } = await supabase
    .from('reservations')
    .select(
      `
      id, reservation_number, check_in, check_out, adults, paid_children,
      free_preschool_children, status, booking_source, total_amount_yen,
      admin_seen_at, created_at, expected_check_in_time, guest_note, admin_note,
      cancelled_at, cancellation_fee_rate, cancellation_fee_yen,
      guest:guests (id, name, name_kana_or_roman, email, telephone),
      rooms:reservation_rooms (
        id, room_type_id, room_id, paid_guest_count, free_preschool_count,
        quoted_price_per_person_yen, quoted_room_total_yen,
        room_type:room_types (id, code, name_ja),
        assigned_room:rooms (id, room_number, sales_status),
        nights:reservation_room_nights (
          id, stay_date, price_per_person_yen, paid_guest_count, room_total_yen
        )
      ),
      payments (id, method, status, amount_yen)
    `,
    )
    .eq('id', reservationId)
    .single()
  if (error) throwReservationError('load reservation detail', error)

  return {
    ...mapReservationListItem(data),
    expected_check_in_time: data.expected_check_in_time,
    guest_note: data.guest_note,
    admin_note: data.admin_note,
    cancelled_at: data.cancelled_at,
    cancellation_fee_rate: data.cancellation_fee_rate,
    cancellation_fee_yen: data.cancellation_fee_yen,
    rooms: data.rooms.map((room) => ({
      id: room.id,
      room_type_id: room.room_type_id,
      paid_guest_count: room.paid_guest_count,
      free_preschool_count: room.free_preschool_count,
      room_type: room.room_type,
      room_id: room.room_id,
      quoted_price_per_person_yen: room.quoted_price_per_person_yen,
      quoted_room_total_yen: room.quoted_room_total_yen,
      assigned_room: room.assigned_room,
      nights: [...room.nights].sort((a, b) =>
        a.stay_date.localeCompare(b.stay_date),
      ),
    })),
    payment: data.payments[0] ?? null,
  }
}

export async function fetchReservationRoomTypes(): Promise<
  ReservationRoomType[]
> {
  const { data, error } = await supabase
    .from('room_types')
    .select('id, code, name_ja')
    .eq('is_sellable', true)
    .order('display_order', { ascending: true })
  if (error) throwReservationError('load room types', error)
  return data
}

export async function createAdminReservation(
  input: CreateAdminReservationInput,
): Promise<string> {
  const { data, error } = await supabase.rpc('create_admin_reservation', {
    p_guest: input.guest as unknown as Json,
    p_reservation: input.reservation as unknown as Json,
    p_rooms: input.rooms as unknown as Json,
  })
  if (error) throwReservationError('create reservation', error)
  if (!data) throw new Error('RESERVATION_CREATE_EMPTY')
  return data
}

export async function markReservationSeen(
  reservationId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('reservations')
    .update({ admin_seen_at: new Date().toISOString() })
    .eq('id', reservationId)
    .is('admin_seen_at', null)
    .select('id')
  if (error) throwReservationError('mark reservation seen', error)
  if (data.length > 1) throw new Error('RESERVATION_SEEN_INVALID')
}

export async function updateReservationContact(
  reservationId: string,
  guest: {
    name: string
    name_kana_or_roman: string
    telephone: string
    email: string
  },
  reservation: {
    expected_check_in_time: string
    guest_note: string
    admin_note: string
  },
): Promise<void> {
  const { error } = await supabase.rpc('update_admin_reservation_contact', {
    p_reservation_id: reservationId,
    p_guest: guest,
    p_reservation: reservation,
  })
  if (error) throwReservationError('update reservation contact', error)
}

export async function fetchAssignableRooms({
  reservationRoomId,
  roomTypeId,
  checkIn,
  checkOut,
}: {
  reservationRoomId: string
  roomTypeId: string
  checkIn: string
  checkOut: string
}): Promise<AssignableRoom[]> {
  const [roomsResult, blocksResult] = await Promise.all([
    supabase
      .from('rooms')
      .select('id, room_number, sales_status')
      .eq('room_type_id', roomTypeId)
      .in('sales_status', ['active', 'admin_only'])
      .order('room_number', { ascending: true }),
    supabase
      .from('inventory_blocks')
      .select('room_id, reservation_room_id')
      .in('status', ['held', 'active'])
      .lt('check_in', checkOut)
      .gt('check_out', checkIn),
  ])
  if (roomsResult.error || blocksResult.error) {
    throwReservationError(
      'load assignable rooms',
      roomsResult.error ?? blocksResult.error!,
    )
  }
  const occupied = new Set(
    blocksResult.data
      .filter((block) => block.reservation_room_id !== reservationRoomId)
      .map((block) => block.room_id),
  )
  return roomsResult.data.filter((room) => !occupied.has(room.id))
}

export async function assignRoom(
  reservationRoomId: string,
  roomId: string,
): Promise<void> {
  const { error } = await supabase.rpc('assign_reservation_room', {
    p_reservation_room_id: reservationRoomId,
    p_room_id: roomId,
  })
  if (error) throwReservationError('assign room', error)
}

export async function changeReservationStatus(
  reservationId: string,
  status: Exclude<ReservationStatus, 'cancelled'>,
): Promise<void> {
  const { error } = await supabase.rpc('change_reservation_status', {
    p_reservation_id: reservationId,
    p_status: status,
  })
  if (error) throwReservationError('change reservation status', error)
}

export async function cancelReservation(reservationId: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_admin_reservation', {
    p_reservation_id: reservationId,
  })
  if (error) throwReservationError('cancel reservation', error)
}

function mapReservationListItem(data: {
  id: string
  reservation_number: string
  check_in: string
  check_out: string
  adults: number
  paid_children: number
  free_preschool_children: number
  status: ReservationListItem['status']
  booking_source: ReservationListItem['booking_source']
  total_amount_yen: number | null
  admin_seen_at: string | null
  created_at: string
  guest: ReservationListItem['guest']
  rooms: {
    id: string
    room_type_id: string
    paid_guest_count: number
    free_preschool_count: number
    room_type: ReservationRoomType
  }[]
}): ReservationListItem {
  return {
    id: data.id,
    reservation_number: data.reservation_number,
    check_in: data.check_in,
    check_out: data.check_out,
    adults: data.adults,
    paid_children: data.paid_children,
    free_preschool_children: data.free_preschool_children,
    status: data.status,
    booking_source: data.booking_source,
    total_amount_yen: data.total_amount_yen,
    admin_seen_at: data.admin_seen_at,
    created_at: data.created_at,
    guest: data.guest,
    rooms: data.rooms.map((room) => ({ ...room, room_type: room.room_type })),
  }
}

function throwReservationError(
  operation: string,
  error: { code: string; message: string },
): never {
  console.error(`[Admin reservations] Failed to ${operation}.`, {
    code: error.code,
    message: error.message,
  })
  throw new Error(`RESERVATION_${error.code}`)
}
