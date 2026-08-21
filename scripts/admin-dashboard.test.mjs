import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateDashboardMetrics,
  getDashboardMetricLinks,
  getJapanToday,
} from '../src/features/admin-dashboard/dashboard-helpers.ts'

const today = '2026-08-20'
const base = {
  checkIn: '2026-08-20',
  checkOut: '2026-08-22',
  status: 'confirmed',
  bookingSource: 'phone',
  adminSeenAt: '2026-08-20T01:00:00Z',
  payments: [],
}

test('uses the Asia/Tokyo calendar date at the UTC boundary', () => {
  assert.equal(getJapanToday(new Date('2026-08-19T15:30:00Z')), today)
})

test('counts operational dashboard metrics with cancelled and no-show exclusions', () => {
  const reservations = [
    base,
    { ...base, status: 'checked_in', checkIn: '2026-08-19', checkOut: today },
    {
      ...base,
      status: 'checked_in',
      checkIn: '2026-08-19',
      checkOut: '2026-08-21',
    },
    {
      ...base,
      bookingSource: 'online',
      adminSeenAt: null,
    },
    { ...base, status: 'pending', checkIn: '2026-08-21' },
    {
      ...base,
      checkIn: '2026-08-21',
      payments: [{ method: 'bank_transfer', status: 'pending' }],
    },
    {
      ...base,
      checkIn: '2026-08-21',
      payments: [{ method: 'pay_at_hotel', status: 'pending' }],
    },
    { ...base, status: 'cancelled' },
    { ...base, status: 'no_show', checkOut: today },
    { ...base, status: 'checked_out' },
  ]
  assert.deepEqual(calculateDashboardMetrics(reservations, today), {
    todayCheckIns: 2,
    todayCheckOuts: 1,
    staying: 1,
    newReservations: 1,
    pendingReservations: 1,
    pendingPayments: 1,
  })
})

test('links every metric to a persistent reservation query', () => {
  assert.deepEqual(getDashboardMetricLinks(today), {
    todayCheckIns:
      '/admin/reservations?checkIn=2026-08-20&operation=today_check_in',
    todayCheckOuts:
      '/admin/reservations?checkOut=2026-08-20&operation=today_check_out',
    staying: '/admin/reservations?status=checked_in&stayDate=2026-08-20',
    newReservations: '/admin/reservations?view=new',
    pendingReservations: '/admin/reservations?status=pending',
    pendingPayments: '/admin/reservations?payment=bank_transfer_pending',
  })
})
