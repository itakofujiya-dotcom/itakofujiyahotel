import type {
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '../admin-reservations/types'
import type {
  SalesDateRange,
  SalesQuickRange,
  SalesRoomSummary,
  SalesSummary,
} from './types'

export const salesPageSize = 30

export function getJapanToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function getSalesDateRange(
  range: Exclude<SalesQuickRange, 'custom'>,
  now = new Date(),
): SalesDateRange {
  const today = getJapanToday(now)
  if (range === 'today') return { startDate: today, endDate: today }
  if (range === 'week') {
    const day = parseDateKey(today).getUTCDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    return {
      startDate: shiftDate(today, mondayOffset),
      endDate: shiftDate(today, mondayOffset + 6),
    }
  }
  if (range === 'last_month') {
    const currentMonthStart = `${today.slice(0, 7)}-01`
    const endDate = shiftDate(currentMonthStart, -1)
    return { startDate: `${endDate.slice(0, 7)}-01`, endDate }
  }
  return {
    startDate: `${today.slice(0, 7)}-01`,
    endDate: endOfMonth(today),
  }
}

export function validateSalesDateRange(range: SalesDateRange): string | null {
  if (!isDateKey(range.startDate) || !isDateKey(range.endDate))
    return '開始日と終了日を入力してください。'
  if (range.startDate > range.endDate)
    return '開始日は終了日以前の日付にしてください。'
  return null
}

export function formatSalesYen(value: number): string {
  return `¥${new Intl.NumberFormat('ja-JP').format(value)}`
}

export function formatSalesDate(value: string): string {
  const [year, month, day] = value.split('-')
  return `${year}.${month}.${day}`
}

export function formatSalesRoomSummary(
  rooms: SalesRoomSummary[],
  translate: (value: string) => string,
): string {
  if (rooms.length === 0) return translate('該当なし')
  return rooms
    .map(
      (room) =>
        `${translate(room.roomTypeNameJa)} ${room.roomCount}${translate('室')}`,
    )
    .join(' / ')
}

export function createEmptySalesSummary(): SalesSummary {
  return {
    reservationRevenueYen: 0,
    collectedYen: 0,
    reservationCount: 0,
    completedStayCount: 0,
    cancellationFeeYen: 0,
    refundTargetYen: 0,
    paymentMethods: [],
  }
}

export type SalesMetricSnapshot = {
  reservationStatus: ReservationStatus
  checkOut: string
  cancellationDate: string | null
  reservationAmountYen: number
  cancellationFeeYen: number
  paymentMethod: PaymentMethod | null
  paymentStatus: PaymentStatus | null
  paymentAmountYen: number
  paymentDate: string | null
}

export function calculateSalesMetrics(
  snapshots: SalesMetricSnapshot[],
  range: SalesDateRange,
): SalesSummary {
  const summary = createEmptySalesSummary()
  summary.paymentMethods = (
    ['pay_at_hotel', 'bank_transfer', 'card'] as PaymentMethod[]
  ).map((method) => ({
    method,
    reservationRevenueYen: 0,
    collectedYen: 0,
    reservationCount: 0,
  }))

  for (const snapshot of snapshots) {
    const terminal = ['cancelled', 'no_show'].includes(
      snapshot.reservationStatus,
    )
    const revenueEvent = !terminal && isWithin(snapshot.checkOut, range)
    const collectionEvent =
      !terminal &&
      snapshot.paymentStatus === 'paid' &&
      snapshot.paymentDate !== null &&
      isWithin(snapshot.paymentDate, range)
    const cancellationEvent =
      terminal &&
      snapshot.cancellationDate !== null &&
      isWithin(snapshot.cancellationDate, range)

    if (revenueEvent) {
      summary.reservationRevenueYen += snapshot.reservationAmountYen
      summary.reservationCount += 1
      if (snapshot.reservationStatus === 'checked_out')
        summary.completedStayCount += 1
    }
    if (collectionEvent) summary.collectedYen += snapshot.paymentAmountYen
    if (cancellationEvent) {
      summary.cancellationFeeYen += snapshot.cancellationFeeYen
      if (snapshot.paymentStatus === 'paid')
        summary.refundTargetYen += Math.max(
          snapshot.paymentAmountYen - snapshot.cancellationFeeYen,
          0,
        )
    }

    const methodSummary = summary.paymentMethods.find(
      (item) => item.method === snapshot.paymentMethod,
    )
    if (methodSummary && revenueEvent) {
      methodSummary.reservationRevenueYen += snapshot.reservationAmountYen
      methodSummary.reservationCount += 1
    }
    if (methodSummary && collectionEvent)
      methodSummary.collectedYen += snapshot.paymentAmountYen
  }

  return summary
}

function endOfMonth(dateKey: string): string {
  const date = parseDateKey(dateKey)
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  )
  return formatDateKey(end)
}

function shiftDate(dateKey: string, amount: number): string {
  const date = parseDateKey(dateKey)
  date.setUTCDate(date.getUTCDate() + amount)
  return formatDateKey(date)
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function formatDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  return formatDateKey(parseDateKey(value)) === value
}

function isWithin(value: string, range: SalesDateRange): boolean {
  return value >= range.startDate && value <= range.endDate
}
