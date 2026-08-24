import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import {
  canSubmitPublicBooking,
  hasBookingGuestErrors,
  validateBookingGuest,
} from '../src/features/booking/guest-validation.ts'
import { hotelSettings, hotelTelephoneHref } from '../src/data/hotel.ts'
import { calculateMealSurcharge } from '../src/features/booking/meal-plan.ts'
import {
  formatBookingDate,
  formatShortBookingDate,
} from '../src/features/booking/booking-format.ts'

const validGuest = {
  name: '山田 太郎',
  nameKanaOrRoman: 'ヤマダ タロウ',
  telephone: '+81-90-1234-5678',
  email: 'guest@example.com',
  expectedCheckInTime: '15:00',
  guestNote: '',
}

test('formats hotel dates for Japanese and Korean without timezone drift', () => {
  assert.equal(formatBookingDate('2026-08-24', 'ja'), '2026年8月24日')
  assert.equal(formatBookingDate('2026-08-24', 'ko'), '2026년 8월 24일')
  assert.equal(formatShortBookingDate('2026-08-24', 'ja'), '8月24日')
  assert.equal(formatShortBookingDate('2026-08-24', 'ko'), '8월 24일')
})

test('uses the current hotel telephone and fax from shared settings', () => {
  assert.equal(hotelSettings.telephone, '0299-94-2662')
  assert.equal(hotelSettings.fax, '0299-94-2663')
  assert.equal(hotelTelephoneHref, 'tel:0299942662')
})

test('accepts the minimum public booking customer information', () => {
  assert.deepEqual(validateBookingGuest(validGuest), {})
})

test('rejects missing required customer fields and invalid email', () => {
  const errors = validateBookingGuest({
    ...validGuest,
    name: ' ',
    nameKanaOrRoman: '',
    telephone: '',
    email: 'invalid-address',
  })
  assert.equal(hasBookingGuestErrors(errors), true)
  assert.ok(errors.name)
  assert.ok(errors.nameKanaOrRoman)
  assert.ok(errors.telephone)
  assert.ok(errors.email)
})

test('accepts international telephone formats without Japan-only validation', () => {
  assert.equal(
    validateBookingGuest({
      ...validGuest,
      telephone: '+82-10-1234-5678',
    }).telephone,
    undefined,
  )
})

test('rejects check-in times outside front desk hours', () => {
  assert.deepEqual(
    validateBookingGuest({ ...validGuest, expectedCheckInTime: '15:00' }),
    {},
  )
  assert.deepEqual(
    validateBookingGuest({ ...validGuest, expectedCheckInTime: '22:00' }),
    {},
  )
  assert.ok(
    validateBookingGuest({ ...validGuest, expectedCheckInTime: '14:30' })
      .expectedCheckInTime,
  )
  assert.ok(
    validateBookingGuest({ ...validGuest, expectedCheckInTime: '22:30' })
      .expectedCheckInTime,
  )
})

test('requires both consents and blocks duplicate submit while loading', () => {
  assert.equal(
    canSubmitPublicBooking({
      privacyConsent: true,
      policyConsent: true,
      isSubmitting: false,
    }),
    true,
  )
  assert.equal(
    canSubmitPublicBooking({
      privacyConsent: false,
      policyConsent: true,
      isSubmitting: false,
    }),
    false,
  )
  assert.equal(
    canSubmitPublicBooking({
      privacyConsent: true,
      policyConsent: true,
      isSubmitting: true,
    }),
    false,
  )
})

test('charges dinner only for adults and snapshots the configured stay length', () => {
  assert.equal(
    calculateMealSurcharge({
      mealPlan: 'breakfast',
      adultGuestCount: 3,
      nights: 3,
    }),
    0,
  )
  assert.equal(
    calculateMealSurcharge({
      mealPlan: 'breakfast_dinner',
      adultGuestCount: 1,
      nights: 1,
    }),
    2000,
  )
  assert.equal(
    calculateMealSurcharge({
      mealPlan: 'breakfast_dinner',
      adultGuestCount: 2,
      nights: 2,
    }),
    8000,
  )
  assert.equal(
    calculateMealSurcharge({
      mealPlan: 'breakfast_dinner',
      adultGuestCount: 3,
      nights: 3,
    }),
    18000,
  )
})

test('mixed-room migration keeps old RPCs and adds atomic server-side meal pricing', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/202608210007_mixed_room_meal_plans.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(sql, /add column meal_plan text not null default 'breakfast'/)
  assert.match(sql, /add column meal_surcharge_yen integer not null default 0/)
  assert.match(
    sql,
    /create or replace function public\.search_public_mixed_booking/,
  )
  assert.match(
    sql,
    /create or replace function public\.create_public_mixed_reservation/,
  )
  assert.match(sql, /v_adults \* \(p_check_out - p_check_in\) \* 2000/)
  assert.match(
    sql,
    /select distinct \(item\.value->>'room_type_id'\)::uuid[\s\S]+order by 1/,
  )
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /p_expected_total_yen/)
  assert.match(sql, /PRICE_CHANGED/)
  assert.match(sql, /to anon, authenticated/)
  assert.doesNotMatch(sql, /drop function public\.create_public_reservation/)
})

test('public booking migration enforces idempotency and anonymous RPC-only writes', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/202608200006_public_reservation_booking.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(sql, /booking_request_id uuid/)
  assert.match(sql, /unique \(booking_request_id\)/)
  assert.match(sql, /pg_advisory_xact_lock/)
  assert.match(sql, /BOOKING_NO_LONGER_AVAILABLE/)
  assert.match(sql, /PRICE_CHANGED/)
  assert.match(sql, /reservation_room_nights/)
  assert.match(sql, /'pay_at_hotel', 'pending'/)
  assert.match(sql, /grant execute[\s\S]+to anon, authenticated/)
  assert.doesNotMatch(sql, /grant insert[\s\S]+to anon/)
})

test('operational-hours migration changes defaults and public RPC validation without rewriting reservations', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/202608210004_check_in_time_1500.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(sql, /check_in_time set default time '15:00'/)
  assert.match(sql, /front_desk_open set default time '15:00'/)
  assert.match(sql, /check_in_time = time '15:00'/)
  assert.match(sql, /front_desk_open = time '15:00'/)
  assert.match(sql, /p_expected_check_in_time < time ''15:00''/)
  assert.doesNotMatch(sql, /update public\.reservations/)
})

test('hotel contact migration updates settings without touching guest data', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/202608210005_update_hotel_contact.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(sql, /telephone = '0299-94-2662'/)
  assert.match(sql, /fax = '0299-94-2663'/)
  assert.doesNotMatch(sql, /public\.guests/)
  assert.doesNotMatch(sql, /public\.reservations/)
})
