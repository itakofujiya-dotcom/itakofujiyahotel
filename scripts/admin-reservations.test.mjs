import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bookingSourceLabels,
  calculateReservationPricePreview,
  filterReservations,
  getAllowedNextStatuses,
  getCancellationFee,
  getReservationCalendarCounts,
  getReservationCalendarCardInfo,
  getReservationDetailPath,
  getStayDates,
  reservationStatusLabels,
  validateAdminReservationInput,
} from '../src/features/admin-reservations/reservation-helpers.ts'

const reservation = {
  id: 'reservation-1',
  reservation_number: 'IFH-20260820-001',
  check_in: '2026-08-22',
  check_out: '2026-08-24',
  adults: 2,
  paid_children: 0,
  free_preschool_children: 0,
  status: 'confirmed',
  booking_source: 'online',
  total_amount_yen: 38000,
  admin_seen_at: null,
  created_at: '2026-08-20T01:30:00Z',
  guest: {
    id: 'guest-1',
    name: 'TEST USER',
    name_kana_or_roman: null,
    email: 'test@example.com',
    telephone: '090-0000-0000',
  },
  rooms: [
    {
      id: 'rr-1',
      room_type_id: 'ja',
      paid_guest_count: 2,
      free_preschool_count: 0,
      room_type: { id: 'ja', code: 'japanese', name_ja: '和室' },
    },
  ],
}

test('maps reservation status and booking source labels to Japanese', () => {
  assert.equal(reservationStatusLabels.confirmed, '予約確定')
  assert.equal(reservationStatusLabels.no_show, '無連絡不泊')
  assert.equal(bookingSourceLabels.phone, '電話')
})

test('builds a calendar card and detail route from the actual reservation id', () => {
  assert.equal(
    getReservationDetailPath(reservation.id),
    '/admin/reservations/reservation-1',
  )
  assert.deepEqual(getReservationCalendarCardInfo(reservation), {
    roomTypes: '和室',
    paidGuests: 2,
  })
})

test('filters by new online reservation and searchable guest fields', () => {
  const filters = {
    status: 'all',
    source: 'all',
    checkIn: '',
    search: '090-0000',
    newOnly: true,
  }
  assert.equal(filterReservations([reservation], filters).length, 1)
  assert.equal(
    filterReservations(
      [{ ...reservation, admin_seen_at: '2026-08-20T02:00:00Z' }],
      filters,
    ).length,
    0,
  )
})

test('calendar counts checkout exclusively and omits cancelled bookings', () => {
  assert.equal(
    getReservationCalendarCounts([reservation], '2026-08-22').checkIns.length,
    1,
  )
  assert.equal(
    getReservationCalendarCounts([reservation], '2026-08-23').staying.length,
    1,
  )
  assert.equal(
    getReservationCalendarCounts([reservation], '2026-08-24').staying.length,
    0,
  )
  assert.equal(
    getReservationCalendarCounts([reservation], '2026-08-24').checkOuts.length,
    1,
  )
  assert.equal(
    getReservationCalendarCounts(
      [{ ...reservation, status: 'cancelled' }],
      '2026-08-22',
    ).checkIns.length,
    0,
  )
})

test('calculates the confirmed cancellation policy', () => {
  assert.deepEqual(getCancellationFee('2026-08-25', 34000, '2026-08-20'), {
    daysBefore: 5,
    rate: 30,
    amount: 10200,
  })
  assert.equal(getCancellationFee('2026-08-25', 34000, '2026-08-18').rate, 0)
  assert.equal(getCancellationFee('2026-08-25', 34000, '2026-08-24').rate, 100)
})

test('allows only safe forward reservation status transitions', () => {
  assert.deepEqual(getAllowedNextStatuses('confirmed'), [
    'checked_in',
    'cancelled',
    'no_show',
  ])
  assert.deepEqual(getAllowedNextStatuses('checked_in'), ['checked_out'])
  assert.deepEqual(getAllowedNextStatuses('checked_out'), [])
})

test('validates one to ten nights and at most four rooms', () => {
  const input = {
    guest: {
      name: 'TEST USER',
      name_kana_or_roman: '',
      email: 'test@example.com',
      telephone: '090',
      nationality: '',
      postal_code: '',
      address: '',
    },
    reservation: {
      check_in: '2026-08-22',
      check_out: '2026-08-24',
      booking_source: 'phone',
      expected_check_in_time: '',
      guest_note: '',
      admin_note: '',
    },
    rooms: [
      { room_type_id: 'ja', paid_guest_count: 2, free_preschool_count: 0 },
    ],
  }
  assert.equal(validateAdminReservationInput(input), null)
  assert.deepEqual(getStayDates('2026-08-22', '2026-08-24'), [
    '2026-08-22',
    '2026-08-23',
  ])
  assert.match(
    validateAdminReservationInput({
      ...input,
      reservation: { ...input.reservation, check_out: '2026-09-10' },
    }),
    /最大10泊/,
  )
})

test('price preview snapshots each night using override then rule then base priority', () => {
  const input = {
    guest: {
      name: 'TEST',
      name_kana_or_roman: '',
      email: 't@e.com',
      telephone: '1',
      nationality: '',
      postal_code: '',
      address: '',
    },
    reservation: {
      check_in: '2026-08-21',
      check_out: '2026-08-24',
      booking_source: 'phone',
      expected_check_in_time: '',
      guest_note: '',
      admin_note: '',
    },
    rooms: [
      { room_type_id: 'ja', paid_guest_count: 2, free_preschool_count: 0 },
    ],
  }
  const roomType = {
    id: 'ja',
    code: 'japanese',
    name_ja: '和室',
    display_order: 1,
  }
  const baseRates = [
    {
      id: 'base',
      room_type_id: 'ja',
      guest_count: 2,
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      price_per_person_yen: 8500,
      room_type: roomType,
    },
  ]
  const overrides = [
    {
      id: 'override',
      room_type_id: 'ja',
      stay_date: '2026-08-23',
      guest_count: 2,
      price_per_person_yen: 12000,
      reason: null,
      room_type: roomType,
    },
  ]
  const rule = {
    id: 'rule',
    name_ja: '週末',
    name_en: null,
    name_ko: null,
    description_ja: null,
    description_en: null,
    description_ko: null,
    adjustment_type: 'fixed_amount',
    adjustment_value: 1000,
    is_active: true,
    display_order: 1,
    created_at: '',
    updated_at: '',
  }
  const ruleDates = [
    {
      id: 'date',
      rate_rule_id: 'rule',
      stay_date: '2026-08-22',
      created_at: '',
      rate_rule: rule,
    },
  ]
  const preview = calculateReservationPricePreview({
    input,
    baseRates,
    overrides,
    ruleDates,
  })
  assert.deepEqual(
    preview.rooms[0].nights.map((night) => night.pricePerPerson),
    [8500, 9500, 12000],
  )
  assert.equal(preview.total, 60000)
})
