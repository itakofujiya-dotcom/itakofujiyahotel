import type { DashboardMetrics } from './types'

export type DashboardReservationSnapshot = {
  checkIn: string
  checkOut: string
  status: string
  bookingSource: string
  adminSeenAt: string | null
  payments: { method: string; status: string }[]
}

export function getJapanToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function getDashboardMetricLinks(today: string) {
  return {
    todayCheckIns: `/admin/reservations?checkIn=${today}&operation=today_check_in`,
    todayCheckOuts: `/admin/reservations?checkOut=${today}&operation=today_check_out`,
    staying: `/admin/reservations?status=checked_in&stayDate=${today}`,
    newReservations: '/admin/reservations?view=new',
    pendingReservations: '/admin/reservations?status=pending',
    pendingPayments: '/admin/reservations?payment=bank_transfer_pending',
  } as const
}

export function calculateDashboardMetrics(
  reservations: DashboardReservationSnapshot[],
  today: string,
): DashboardMetrics {
  const isActive = (status: string) =>
    !['cancelled', 'no_show'].includes(status)
  return {
    todayCheckIns: reservations.filter(
      (reservation) =>
        reservation.checkIn === today &&
        isActive(reservation.status) &&
        reservation.status !== 'checked_out',
    ).length,
    todayCheckOuts: reservations.filter(
      (reservation) =>
        reservation.checkOut === today && isActive(reservation.status),
    ).length,
    staying: reservations.filter(
      (reservation) =>
        reservation.status === 'checked_in' &&
        reservation.checkIn <= today &&
        today < reservation.checkOut,
    ).length,
    newReservations: reservations.filter(
      (reservation) =>
        reservation.bookingSource === 'online' &&
        reservation.adminSeenAt === null,
    ).length,
    pendingReservations: reservations.filter(
      (reservation) => reservation.status === 'pending',
    ).length,
    pendingPayments: reservations.filter(
      (reservation) =>
        ['pending', 'confirmed', 'checked_in'].includes(reservation.status) &&
        reservation.payments.some(
          (payment) =>
            payment.method === 'bank_transfer' && payment.status === 'pending',
        ),
    ).length,
  }
}
