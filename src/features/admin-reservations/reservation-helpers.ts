import { eachDayOfInterval, format, subDays } from 'date-fns'
import type {
  BookingSource,
  CreateAdminReservationInput,
  PaymentStatus,
  ReservationFilters,
  ReservationListItem,
  ReservationStatus,
} from './types'
import type {
  BaseRoomRate,
  RateOverride,
  RateRuleDate,
} from '../admin-rates/types'

export const ADMIN_CHECK_IN_START_TIME = '15:00'
export const ADMIN_CHECK_IN_END_TIME = '22:00'
export const ADMIN_CHECK_IN_TIME_RANGE_MESSAGE = `${ADMIN_CHECK_IN_START_TIME}〜${ADMIN_CHECK_IN_END_TIME}の間で選択してください。`

export function isAdminExpectedCheckInTimeValid(value: string): boolean {
  return value >= ADMIN_CHECK_IN_START_TIME && value <= ADMIN_CHECK_IN_END_TIME
}

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending: '確認待ち',
  confirmed: '予約確定',
  cancelled: 'キャンセル済み',
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

export function isNewOnlineReservation(
  reservation: Pick<ReservationListItem, 'booking_source' | 'admin_seen_at'>,
): boolean {
  return (
    reservation.booking_source === 'online' &&
    reservation.admin_seen_at === null
  )
}

export function countNewOnlineReservations(
  reservations: Pick<ReservationListItem, 'booking_source' | 'admin_seen_at'>[],
): number {
  return reservations.filter(isNewOnlineReservation).length
}

export function isReservationAwaitingPayment(
  reservation: Pick<
    ReservationListItem,
    'status' | 'has_pending_bank_transfer'
  >,
): boolean {
  return (
    reservation.has_pending_bank_transfer &&
    ['pending', 'confirmed', 'checked_in'].includes(reservation.status)
  )
}

export function createDefaultReservationFilters(): ReservationFilters {
  return {
    status: 'all',
    source: 'all',
    checkIn: '',
    checkOut: '',
    stayDate: '',
    search: '',
    newOnly: false,
    payment: 'all',
    operation: 'all',
  }
}

export function parseReservationFilters(
  params: URLSearchParams,
): ReservationFilters {
  const defaults = createDefaultReservationFilters()
  const status = params.get('status')
  const source = params.get('source')
  const payment = params.get('payment')
  return {
    status: isReservationStatus(status) ? status : defaults.status,
    source: isBookingSource(source) ? source : defaults.source,
    checkIn: parseDateParameter(params.get('checkIn')),
    checkOut: parseDateParameter(params.get('checkOut')),
    stayDate: parseDateParameter(params.get('stayDate')),
    search: params.get('search') ?? '',
    newOnly: params.get('view') === 'new',
    payment:
      payment === 'bank_transfer_pending' || isPaymentStatus(payment)
        ? payment
        : defaults.payment,
    operation:
      params.get('operation') === 'today_check_in' ||
      params.get('operation') === 'today_check_out'
        ? (params.get('operation') as ReservationFilters['operation'])
        : defaults.operation,
  }
}

export function buildReservationFilterSearchParams(
  filters: ReservationFilters,
): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.status !== 'all') params.set('status', filters.status)
  if (filters.source !== 'all') params.set('source', filters.source)
  if (filters.checkIn) params.set('checkIn', filters.checkIn)
  if (filters.checkOut) params.set('checkOut', filters.checkOut)
  if (filters.stayDate) params.set('stayDate', filters.stayDate)
  if (filters.search.trim()) params.set('search', filters.search.trim())
  if (filters.newOnly) params.set('view', 'new')
  if (filters.payment !== 'all') params.set('payment', filters.payment)
  if (filters.operation !== 'all') params.set('operation', filters.operation)
  return params
}

export function getReservationDetailPath(reservationId: string): string {
  return `/admin/reservations/${reservationId}`
}

export function getReservationCalendarCardInfo(
  reservation: ReservationListItem,
) {
  return {
    roomTypes: [
      ...new Set(reservation.rooms.map((room) => room.room_type.name_ja)),
    ].join('・'),
    paidGuests: reservation.rooms.reduce(
      (total, room) => total + room.paid_guest_count,
      0,
    ),
  }
}

export function filterReservations(
  reservations: ReservationListItem[],
  filters: ReservationFilters,
): ReservationListItem[] {
  const query = normalizeAdminGuestSearch(filters.search)
  const phoneQuery = filters.search.replace(/[^0-9]/g, '')
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
    if (filters.checkOut && reservation.check_out !== filters.checkOut)
      return false
    if (
      filters.stayDate &&
      !(
        reservation.check_in <= filters.stayDate &&
        filters.stayDate < reservation.check_out
      )
    )
      return false
    if (filters.newOnly && !isNewOnlineReservation(reservation)) return false
    if (
      filters.operation === 'today_check_in' &&
      ['cancelled', 'no_show', 'checked_out'].includes(reservation.status)
    )
      return false
    if (
      filters.operation === 'today_check_out' &&
      ['cancelled', 'no_show'].includes(reservation.status)
    )
      return false
    if (filters.payment === 'bank_transfer_pending') {
      if (
        reservation.payment?.method !== 'bank_transfer' ||
        !['pending', 'awaiting_payment'].includes(reservation.payment.status)
      )
        return false
    } else if (
      filters.payment &&
      filters.payment !== 'all' &&
      reservation.payment?.status !== filters.payment
    )
      return false
    if (!query) return true
    const matchesText = [
      reservation.reservation_number,
      reservation.guest.name,
      reservation.guest.name_kana_or_roman ?? '',
    ].some((value) => normalizeAdminGuestSearch(value).includes(query))
    const matchesPhone =
      phoneQuery.length > 0 &&
      reservation.guest.telephone.replace(/[^0-9]/g, '').includes(phoneQuery)
    return matchesText || matchesPhone
  })
}

export function normalizeAdminGuestSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\s\u3000]+/g, '')
    .toLocaleLowerCase('ja-JP')
}

function parseDateParameter(value: string | null): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

function isReservationStatus(value: string | null): value is ReservationStatus {
  return Boolean(value && value in reservationStatusLabels)
}

function isBookingSource(value: string | null): value is BookingSource {
  return Boolean(value && value in bookingSourceLabels)
}

function isPaymentStatus(value: string | null): value is PaymentStatus {
  return Boolean(
    value &&
    ['pending', 'awaiting_payment', 'paid', 'refunded', 'cancelled'].includes(
      value,
    ),
  )
}

export function getReservationCalendarCounts(
  reservations: ReservationListItem[],
  day: string,
) {
  const active = reservations.filter(
    (reservation) => !['cancelled', 'no_show'].includes(reservation.status),
  )
  return {
    checkIns: active.filter(
      (reservation) =>
        reservation.check_in === day &&
        ['pending', 'confirmed'].includes(reservation.status),
    ),
    checkOuts: active.filter((reservation) => reservation.check_out === day),
    staying: active.filter(
      (reservation) =>
        reservation.status === 'checked_in' &&
        reservation.check_in <= day &&
        day < reservation.check_out,
    ),
  }
}

export function getAllowedNextStatuses(
  status: ReservationStatus,
): ReservationStatus[] {
  if (status === 'pending') return ['confirmed', 'cancelled']
  if (status === 'confirmed') return ['checked_in', 'cancelled', 'no_show']
  if (status === 'checked_in') return ['checked_out']
  return []
}

export function getRoomAssignmentSummary(rooms: { room_id: string | null }[]): {
  total: number
  assigned: number
  unassigned: number
  complete: boolean
} {
  const assigned = rooms.filter((room) => Boolean(room.room_id)).length
  const total = rooms.length
  return {
    total,
    assigned,
    unassigned: total - assigned,
    complete: total > 0 && assigned === total,
  }
}

export function getTodayOperationLabels(
  reservation: Pick<ReservationListItem, 'check_in' | 'check_out' | 'status'>,
  today: string,
): string[] {
  if (['cancelled', 'no_show'].includes(reservation.status)) return []
  const labels: string[] = []
  if (reservation.check_in === today) labels.push('本日チェックイン')
  if (reservation.check_out === today) labels.push('本日チェックアウト')
  return labels
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
  const kanaOrRomanLength = input.guest.name_kana_or_roman.trim().length
  if (kanaOrRomanLength < 2 || kanaOrRomanLength > 100)
    return 'フリガナまたは英文名を入力してください。'
  if (!input.guest.telephone.trim()) return '電話番号を入力してください。'
  if (!input.guest.email.trim() || !/^\S+@\S+\.\S+$/.test(input.guest.email))
    return '有効なメールアドレスを入力してください。'
  if (
    input.reservation.expected_check_in_time &&
    !isAdminExpectedCheckInTimeValid(input.reservation.expected_check_in_time)
  )
    return ADMIN_CHECK_IN_TIME_RANGE_MESSAGE
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
      !Number.isInteger(room.adult_guest_count) ||
      room.adult_guest_count < 1 ||
      !Number.isInteger(room.paid_child_count) ||
      room.paid_child_count < 0 ||
      room.adult_guest_count + room.paid_child_count > 4
    )
      return '各客室の人数は1〜4名で指定してください。'
    if (!['breakfast', 'breakfast_dinner'].includes(room.meal_plan))
      return '食事プランを確認してください。'
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
    const paidGuestCount = room.adult_guest_count + room.paid_child_count
    const nights = stayDates.map((stayDate) => {
      const override = overrides.find(
        (rate) =>
          rate.room_type_id === room.room_type_id &&
          rate.guest_count === paidGuestCount &&
          rate.stay_date === stayDate,
      )
      const baseRate = baseRates.find(
        (rate) =>
          rate.room_type_id === room.room_type_id &&
          rate.guest_count === paidGuestCount &&
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
        roomTotal: pricePerPerson * paidGuestCount,
      }
    })
    if (nights.some((night) => night === null)) return null
    const completeNights = nights.filter((night) => night !== null)
    const baseTotal = completeNights.reduce(
      (sum, night) => sum + night.roomTotal,
      0,
    )
    const mealSurcharge =
      room.meal_plan === 'breakfast_dinner'
        ? room.adult_guest_count * stayDates.length * 2_000
        : 0
    return {
      roomIndex,
      nights: completeNights,
      baseTotal,
      mealSurcharge,
      total: baseTotal + mealSurcharge,
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
