import {
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  subDays,
} from 'date-fns'
import type {
  BookingSource,
  CreateAdminReservationInput,
  ReservationFilters,
  ReservationListItem,
  ReservationStatus,
} from './types'
import type {
  BaseRoomRate,
  RateOverride,
  RateRuleDate,
} from '../admin-rates/types'

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending: '確認待ち',
  confirmed: '予約確定',
  cancelled: 'キャンセル',
  checked_in: 'チェックイン済み',
  checked_out: 'チェックアウト済み',
  no_show: '無連絡不泊',
}

export const bookingSourceLabels: Record<BookingSource, string> = {
  online: 'オンライン',
  phone: '電話',
  walk_in: '当日受付',
  admin: '管理者登録',
}

export function filterReservations(
  reservations: ReservationListItem[],
  filters: ReservationFilters,
): ReservationListItem[] {
  const query = filters.search.trim().toLocaleLowerCase('ja-JP')
  return reservations.filter((reservation) => {
    if (filters.status !== 'all' && reservation.status !== filters.status)
      return false
    if (
      filters.source !== 'all' &&
      reservation.booking_source !== filters.source
    )
      return false
    if (filters.checkIn && reservation.check_in !== filters.checkIn)
      return false
    if (
      filters.newOnly &&
      (reservation.booking_source !== 'online' || reservation.admin_seen_at)
    )
      return false
    if (!query) return true
    return [
      reservation.reservation_number,
      reservation.guest.name,
      reservation.guest.telephone,
    ].some((value) => value.toLocaleLowerCase('ja-JP').includes(query))
  })
}

export function getReservationCalendarCounts(
  reservations: ReservationListItem[],
  day: string,
) {
  const active = reservations.filter(
    (reservation) => !['cancelled', 'no_show'].includes(reservation.status),
  )
  return {
    checkIns: active.filter((reservation) => reservation.check_in === day),
    checkOuts: active.filter((reservation) => reservation.check_out === day),
    staying: active.filter(
      (reservation) =>
        reservation.check_in <= day && day < reservation.check_out,
    ),
  }
}

export function getCancellationFee(
  checkIn: string,
  totalAmount: number,
  today: string,
) {
  const daysBefore = differenceInCalendarDays(
    new Date(`${checkIn}T00:00:00`),
    new Date(`${today}T00:00:00`),
  )
  const rate =
    daysBefore >= 7 ? 0 : daysBefore >= 4 ? 30 : daysBefore >= 2 ? 50 : 100
  return { daysBefore, rate, amount: Math.round((totalAmount * rate) / 100) }
}

export function getAllowedNextStatuses(
  status: ReservationStatus,
): ReservationStatus[] {
  if (status === 'pending') return ['confirmed', 'cancelled']
  if (status === 'confirmed') return ['checked_in', 'cancelled', 'no_show']
  if (status === 'checked_in') return ['checked_out']
  return []
}

export function getStayDates(checkIn: string, checkOut: string): string[] {
  const start = new Date(`${checkIn}T00:00:00`)
  const endExclusive = new Date(`${checkOut}T00:00:00`)
  if (!(start < endExclusive)) return []
  return eachDayOfInterval({ start, end: subDays(endExclusive, 1) }).map(
    (date) => format(date, 'yyyy-MM-dd'),
  )
}

export function validateAdminReservationInput(
  input: CreateAdminReservationInput,
): string | null {
  if (!input.guest.name.trim()) return '氏名を入力してください。'
  if (!input.guest.telephone.trim()) return '電話番号を入力してください。'
  if (!input.guest.email.trim() || !/^\S+@\S+\.\S+$/.test(input.guest.email))
    return '有効なメールアドレスを入力してください。'
  const nights = getStayDates(
    input.reservation.check_in,
    input.reservation.check_out,
  )
  if (nights.length < 1)
    return 'チェックアウトはチェックインより後の日付にしてください。'
  if (nights.length > 10) return '宿泊は最大10泊までです。'
  if (input.rooms.length < 1 || input.rooms.length > 4)
    return '客室数は1〜4室で指定してください。'
  for (const room of input.rooms) {
    if (!room.room_type_id) return 'すべての客室タイプを選択してください。'
    if (
      !Number.isInteger(room.paid_guest_count) ||
      room.paid_guest_count < 1 ||
      room.paid_guest_count > 4
    )
      return '各客室の人数は1〜4名で指定してください。'
    if (
      !Number.isInteger(room.free_preschool_count) ||
      room.free_preschool_count < 0
    )
      return '無料未就学児の人数を確認してください。'
  }
  return null
}

export function calculateReservationPricePreview({
  input,
  baseRates,
  overrides,
  ruleDates,
}: {
  input: CreateAdminReservationInput
  baseRates: BaseRoomRate[]
  overrides: RateOverride[]
  ruleDates: RateRuleDate[]
}) {
  const stayDates = getStayDates(
    input.reservation.check_in,
    input.reservation.check_out,
  )
  if (stayDates.length === 0) return null
  const rooms = input.rooms.map((room, roomIndex) => {
    const nights = stayDates.map((stayDate) => {
      const override = overrides.find(
        (rate) =>
          rate.room_type_id === room.room_type_id &&
          rate.guest_count === room.paid_guest_count &&
          rate.stay_date === stayDate,
      )
      const baseRate = baseRates.find(
        (rate) =>
          rate.room_type_id === room.room_type_id &&
          rate.guest_count === room.paid_guest_count &&
          rate.valid_from <= stayDate &&
          stayDate <= rate.valid_to,
      )
      if (!override && !baseRate) return null
      let pricePerPerson =
        override?.price_per_person_yen ?? baseRate!.price_per_person_yen
      if (!override) {
        const assignment = ruleDates.find((item) => item.stay_date === stayDate)
        if (assignment?.rate_rule.is_active)
          pricePerPerson = applyReservationRateRule(
            pricePerPerson,
            assignment.rate_rule.adjustment_type,
            assignment.rate_rule.adjustment_value,
          )
      }
      return {
        stayDate,
        pricePerPerson,
        roomTotal: pricePerPerson * room.paid_guest_count,
      }
    })
    if (nights.some((night) => night === null)) return null
    const completeNights = nights.filter((night) => night !== null)
    return {
      roomIndex,
      nights: completeNights,
      total: completeNights.reduce((sum, night) => sum + night.roomTotal, 0),
    }
  })
  if (rooms.some((room) => room === null)) return null
  const completeRooms = rooms.filter((room) => room !== null)
  return {
    rooms: completeRooms,
    total: completeRooms.reduce((sum, room) => sum + room.total, 0),
  }
}

function applyReservationRateRule(
  basePrice: number,
  adjustmentType: 'fixed_amount' | 'percentage',
  adjustmentValue: number,
): number {
  const adjustment =
    adjustmentType === 'fixed_amount'
      ? adjustmentValue
      : Math.round((basePrice * adjustmentValue) / 100)
  return Math.max(0, basePrice + adjustment)
}
