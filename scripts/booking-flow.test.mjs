import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import {
  canSubmitPublicBooking,
  hasBookingGuestErrors,
  validateBookingGuest,
} from '../src/features/booking/guest-validation.ts'

const validGuest = {
  name: '山田 太郎',
  nameKanaOrRoman: 'ヤマダ タロウ',
  telephone: '+81-90-1234-5678',
  email: 'guest@example.com',
  expectedCheckInTime: '16:00',
  guestNote: '',
}

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
  assert.ok(
    validateBookingGuest({ ...validGuest, expectedCheckInTime: '15:00' })
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
