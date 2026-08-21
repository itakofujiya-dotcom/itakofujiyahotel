import { differenceInCalendarDays } from 'date-fns'
import type { ReservationStatus } from '../admin-reservations/types'
import type { CustomerStats } from './types'

export function normalizeCustomerPhone(value: string): string {
  return value.replace(/[^0-9]/g, '')
}

export function calculateCustomerStats(
  reservations: {
    check_in: string
    check_out: string
    status: ReservationStatus
  }[],
): CustomerStats {
  const completed = reservations
    .filter((reservation) => reservation.status === 'checked_out')
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
  const firstVisit = completed[0]?.check_in ?? null
  const recentVisit = completed.at(-1)?.check_in ?? null
  const totalNights = completed.reduce(
    (total, reservation) =>
      total +
      differenceInCalendarDays(
        new Date(`${reservation.check_out}T00:00:00`),
        new Date(`${reservation.check_in}T00:00:00`),
      ),
    0,
  )
  const averageVisitIntervalDays =
    completed.length > 1 && firstVisit && recentVisit
      ? Math.round(
          (differenceInCalendarDays(
            new Date(`${recentVisit}T00:00:00`),
            new Date(`${firstVisit}T00:00:00`),
          ) /
            (completed.length - 1)) *
            10,
        ) / 10
      : null

  return {
    totalReservations: reservations.length,
    completedStays: completed.length,
    firstVisit,
    recentVisit,
    totalNights,
    averageVisitIntervalDays,
  }
}

export function getCustomerVisitLabel(completedStays: number): string {
  if (completedStays === 0) return '宿泊履歴なし'
  if (completedStays === 1) return '訪問 1回'
  return `再訪 ${completedStays}回`
}

export function formatCustomerDate(value: string | null): string {
  return value ? value.replaceAll('-', '/') : '—'
}
