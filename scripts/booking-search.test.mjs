import assert from 'node:assert/strict'
import test from 'node:test'
import { URLSearchParams } from 'node:url'
import { applyRateRule } from '../src/features/admin-rates/rate-helpers.ts'
import {
  calculateMinimumAvailability,
  distributePaidGuests,
  getJapanDateTime,
  parseBookingSearchParams,
  validateBookingSearch,
} from '../src/features/booking/validation.ts'

const valid = {
  checkIn: '2026-08-25',
  checkOut: '2026-08-27',
  adults: 2,
  paidChildren: 0,
  freePreschoolChildren: 0,
  roomCount: 1,
}
const japanMorning = { date: '2026-08-20', time: '10:00' }

test('derives the hotel date and time in Asia/Tokyo', () => {
  assert.deepEqual(getJapanDateTime(new Date('2026-08-19T15:30:00Z')), {
    date: '2026-08-20',
    time: '00:30',
  })
})

test('rejects checkout on or before check-in', () => {
  assert.match(
    validateBookingSearch({ ...valid, checkOut: valid.checkIn }, japanMorning),
    /チェックアウト/,
  )
})

test('rejects past, over ten nights, and over forty-day searches', () => {
  assert.match(
    validateBookingSearch(
      { ...valid, checkIn: '2026-08-19', checkOut: '2026-08-20' },
      japanMorning,
    ),
    /過去/,
  )
  assert.match(
    validateBookingSearch(
      { ...valid, checkIn: '2026-08-20', checkOut: '2026-08-31' },
      japanMorning,
    ),
    /最大10泊/,
  )
  assert.match(
    validateBookingSearch(
      { ...valid, checkIn: '2026-09-30', checkOut: '2026-10-01' },
      japanMorning,
    ),
    /40日後/,
  )
})

test('applies the Japan-time same-day noon cutoff', () => {
  const sameDay = {
    ...valid,
    checkIn: '2026-08-20',
    checkOut: '2026-08-21',
  }
  assert.equal(validateBookingSearch(sameDay, japanMorning), null)
  assert.match(
    validateBookingSearch(sameDay, { date: '2026-08-20', time: '12:01' }),
    /12:00/,
  )
})

test('distributes paid guests evenly without exceeding four per room', () => {
  assert.deepEqual(distributePaidGuests(1, 1), [1])
  assert.deepEqual(distributePaidGuests(4, 1), [4])
  assert.deepEqual(distributePaidGuests(5, 2), [3, 2])
  assert.deepEqual(distributePaidGuests(8, 2), [4, 4])
  assert.equal(distributePaidGuests(9, 2), null)
})

test('uses configured inventory, active-room defaults, booked rooms, and the minimum stay quantity', () => {
  const stayDates = ['2026-08-25', '2026-08-26', '2026-08-27']
  assert.equal(
    calculateMinimumAvailability({
      activeRooms: 12,
      stayDates,
      inventoryByDate: new Map([
        ['2026-08-25', 5],
        ['2026-08-26', 4],
      ]),
      bookedByDate: new Map([
        ['2026-08-25', 1],
        ['2026-08-26', 2],
        ['2026-08-27', 8],
      ]),
    }),
    2,
  )
})

test('calculates a mixed base and special-rate stay', () => {
  const basePrice = 8500
  const specialPrice = applyRateRule(basePrice, 'fixed_amount', 1000)
  assert.equal(basePrice * 2, 17000)
  assert.equal(specialPrice * 2, 19000)
  assert.equal(basePrice * 2 + specialPrice * 2, 36000)
})

test('parses shareable booking search query parameters', () => {
  const params = parseBookingSearchParams(
    new URLSearchParams(
      'checkIn=2026-08-25&checkOut=2026-08-27&adults=3&paidChildren=2&freePreschoolChildren=1&roomCount=2',
    ),
  )
  assert.deepEqual(params, {
    checkIn: '2026-08-25',
    checkOut: '2026-08-27',
    adults: 3,
    paidChildren: 2,
    freePreschoolChildren: 1,
    roomCount: 2,
  })
})
