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

const validGuest = {
  name: '山田 太郎',
  nameKanaOrRoman: 'ヤマダ タロウ',
  telephone: '+81-90-1234-5678',
  email: 'guest@example.com',
  expectedCheckInTime: '15:00',
  guestNote: '',
}

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
