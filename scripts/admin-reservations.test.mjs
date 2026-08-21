import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL, URLSearchParams } from 'node:url'
import {
  bookingSourceLabels,
  buildReservationFilterSearchParams,
  calculateReservationPricePreview,
  countNewOnlineReservations,
  filterReservations,
  getAllowedNextStatuses,
  getCancellationFee,
  getReservationCalendarCounts,
  getReservationCalendarCardInfo,
  getReservationDetailPath,
  getRoomAssignmentSummary,
  getStayDates,
  getTodayOperationLabels,
  isNewOnlineReservation,
  isReservationAwaitingPayment,
  parseReservationFilters,
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
  has_pending_bank_transfer: false,
  payment: {
    id: 'payment-1',
    method: 'pay_at_hotel',
    status: 'pending',
    amount_yen: 38000,
    paid_at: null,
    external_reference: null,
  },
  payment_issue: null,
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
  assert.equal(reservationStatusLabels.cancelled, 'キャンセル済み')
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

test('marks only unseen online reservations as new and decreases the count after viewing', () => {
  const phoneReservation = { ...reservation, booking_source: 'phone' }
  const seenOnlineReservation = {
    ...reservation,
    id: 'reservation-2',
    admin_seen_at: '2026-08-20T02:00:00Z',
  }

  assert.equal(isNewOnlineReservation(reservation), true)
  assert.equal(isNewOnlineReservation(phoneReservation), false)
  assert.equal(isNewOnlineReservation(seenOnlineReservation), false)
  assert.equal(
    countNewOnlineReservations([
      reservation,
      phoneReservation,
      seenOnlineReservation,
    ]),
    1,
  )
  assert.equal(
    countNewOnlineReservations([
      { ...reservation, admin_seen_at: '2026-08-20T03:00:00Z' },
      phoneReservation,
      seenOnlineReservation,
    ]),
    0,
  )
})

test('restores dashboard reservation filters from the URL', () => {
  const filters = parseReservationFilters(
    new URLSearchParams(
      'status=checked_in&stayDate=2026-08-20&payment=bank_transfer_pending',
    ),
  )
  assert.equal(filters.status, 'checked_in')
  assert.equal(filters.stayDate, '2026-08-20')
  assert.equal(filters.payment, 'bank_transfer_pending')
  assert.equal(
    buildReservationFilterSearchParams(filters).toString(),
    'status=checked_in&stayDate=2026-08-20&payment=bank_transfer_pending',
  )
})

test('filters payment status and preserves it in the URL', () => {
  const filters = parseReservationFilters(new URLSearchParams('payment=paid'))
  assert.equal(filters.payment, 'paid')
  assert.equal(
    buildReservationFilterSearchParams(filters).toString(),
    'payment=paid',
  )
  assert.equal(filterReservations([reservation], filters).length, 0)
  assert.equal(
    filterReservations(
      [
        {
          ...reservation,
          payment: { ...reservation.payment, status: 'paid' },
        },
      ],
      filters,
    ).length,
    1,
  )

  const bankPending = parseReservationFilters(
    new URLSearchParams('payment=bank_transfer_pending'),
  )
  assert.equal(
    filterReservations(
      [
        {
          ...reservation,
          payment: {
            ...reservation.payment,
            method: 'bank_transfer',
            status: 'awaiting_payment',
          },
        },
      ],
      bankPending,
    ).length,
    1,
  )
})

test('treats only valid bank-transfer pending reservations as awaiting payment', () => {
  assert.equal(
    isReservationAwaitingPayment({
      ...reservation,
      has_pending_bank_transfer: true,
    }),
    true,
  )
  assert.equal(
    isReservationAwaitingPayment({
      ...reservation,
      status: 'cancelled',
      has_pending_bank_transfer: true,
    }),
    false,
  )
  assert.equal(
    isReservationAwaitingPayment({
      ...reservation,
      has_pending_bank_transfer: false,
    }),
    false,
  )
})

test('calendar separates arrivals, staying guests, and completed departures', () => {
  assert.equal(
    getReservationCalendarCounts([reservation], '2026-08-22').checkIns.length,
    1,
  )
  assert.equal(
    getReservationCalendarCounts([reservation], '2026-08-23').staying.length,
    0,
  )
  assert.equal(
    getReservationCalendarCounts(
      [{ ...reservation, status: 'checked_in' }],
      '2026-08-23',
    ).staying.length,
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
  assert.equal(
    getReservationCalendarCounts(
      [{ ...reservation, status: 'checked_out' }],
      '2026-08-24',
    ).checkOuts.length,
    1,
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
  assert.deepEqual(getAllowedNextStatuses('pending'), [
    'confirmed',
    'cancelled',
  ])
  assert.deepEqual(getAllowedNextStatuses('confirmed'), [
    'checked_in',
    'cancelled',
    'no_show',
  ])
  assert.deepEqual(getAllowedNextStatuses('checked_in'), ['checked_out'])
  assert.deepEqual(getAllowedNextStatuses('checked_out'), [])
  assert.deepEqual(getAllowedNextStatuses('cancelled'), [])
  assert.deepEqual(getAllowedNextStatuses('no_show'), [])
})

test('existing status RPC locks the reservation and keeps no-show release logic', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202608200003_reservation_no_show_and_new_index.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(migration, /where id = p_reservation_id for update/)
  assert.match(
    migration,
    /v_current = 'pending' and p_status in \('confirmed', 'cancelled'\)/,
  )
  assert.match(
    migration,
    /v_current = 'confirmed' and p_status in \('checked_in', 'cancelled', 'no_show'\)/,
  )
  assert.match(
    migration,
    /v_current = 'checked_in' and p_status = 'checked_out'/,
  )
  assert.match(migration, /cancellation_fee_rate = 100/)
  assert.match(
    migration,
    /update public\.inventory_blocks set status = 'released'/,
  )
})

test('requires every reserved room to be assigned before check-in', () => {
  assert.deepEqual(
    getRoomAssignmentSummary([{ room_id: '201' }, { room_id: '202' }]),
    { total: 2, assigned: 2, unassigned: 0, complete: true },
  )
  assert.deepEqual(
    getRoomAssignmentSummary([{ room_id: '201' }, { room_id: null }]),
    { total: 2, assigned: 1, unassigned: 1, complete: false },
  )
  assert.equal(getRoomAssignmentSummary([{ room_id: null }]).complete, false)
})

test('uses hotel-local dates for today operation badges', () => {
  assert.deepEqual(getTodayOperationLabels(reservation, '2026-08-22'), [
    '本日チェックイン',
  ])
  assert.deepEqual(
    getTodayOperationLabels(
      { ...reservation, status: 'checked_in' },
      '2026-08-24',
    ),
    ['本日チェックアウト'],
  )
  assert.deepEqual(
    getTodayOperationLabels(
      { ...reservation, status: 'cancelled' },
      '2026-08-22',
    ),
    [],
  )
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
