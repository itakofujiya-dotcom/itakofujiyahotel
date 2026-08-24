import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202608210009_public_reservation_cancellation.sql',
    import.meta.url,
  ),
  'utf8',
)
const page = readFileSync(
  new URL('../src/pages/public/ReservationLookupPage.tsx', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')

const policies = [
  { min: 7, max: null, fee: 0 },
  { min: 4, max: 6, fee: 30 },
  { min: 2, max: 3, fee: 50 },
  { min: 1, max: 1, fee: 100 },
  { min: 0, max: 0, fee: 100 },
]

function policyFor(daysBefore) {
  const normalizedDays = Math.max(daysBefore, 0)
  return policies.find(
    (policy) =>
      normalizedDays >= policy.min &&
      (policy.max === null || normalizedDays <= policy.max),
  )
}

test('covers all cancellation policy boundaries', () => {
  assert.equal(policyFor(7)?.fee, 0)
  assert.equal(policyFor(6)?.fee, 30)
  assert.equal(policyFor(4)?.fee, 30)
  assert.equal(policyFor(3)?.fee, 50)
  assert.equal(policyFor(2)?.fee, 50)
  assert.equal(policyFor(1)?.fee, 100)
  assert.equal(policyFor(0)?.fee, 100)
  assert.equal(policyFor(-1)?.fee, 100)
})

test('uses active cancellation policies and the Asia/Tokyo hotel date', () => {
  assert.match(migration, /from public\.cancellation_policies as policy/)
  assert.match(migration, /policy\.is_active = true/)
  assert.match(migration, /policy\.is_no_show = false/)
  assert.match(migration, /now\(\) at time zone 'Asia\/Tokyo'/)
  assert.match(migration, /policy\.min_days_before/)
  assert.match(migration, /policy\.max_days_before/)
})

test('requires reservation number plus matching email or normalized phone', () => {
  assert.match(migration, /length\(btrim\(coalesce\(p_reservation_number/)
  assert.match(migration, /length\(v_contact\) < 3/)
  assert.match(
    migration,
    /lower\(btrim\(v_guest\.email\)\) = lower\(v_contact\)/,
  )
  assert.match(
    migration,
    /regexp_replace\(v_guest\.telephone, '\[\^0-9\]', '', 'g'\) = v_contact_phone/,
  )
  assert.match(migration, /'code', 'RESERVATION_NOT_FOUND'/)
})

test('public cancellation locks, validates, records fees, and releases every room block', () => {
  assert.match(
    migration,
    /create or replace function public\.cancel_public_reservation[\s\S]*for update/,
  )
  assert.match(
    migration,
    /v_reservation\.status not in \('pending', 'confirmed'\)/,
  )
  assert.match(migration, /cancellation_fee_rate = v_quote\.fee_percent/)
  assert.match(migration, /cancellation_fee_yen = v_quote\.fee_yen/)
  assert.match(
    migration,
    /where block\.reservation_room_id in \([\s\S]*where room\.reservation_id = v_reservation\.id[\s\S]*block\.status in \('held', 'active'\)/,
  )
  assert.match(migration, /'automaticRefundProcessed', false/)
})

test('admin cancellation shares the calculator and generic status changes cannot cancel', () => {
  const adminCancel = migration.match(
    /create or replace function public\.cancel_admin_reservation[\s\S]*?(?=-- General status transitions)/,
  )?.[0]
  assert.ok(adminCancel)
  assert.match(adminCancel, /public\.calculate_reservation_cancellation/)
  assert.match(adminCancel, /public\.is_admin\(\)/)
  assert.match(migration, /if p_status = 'cancelled' then/)
  assert.match(migration, /USE_RESERVATION_CANCELLATION_RPC/)
  assert.doesNotMatch(
    migration,
    /v_current = 'pending' and p_status in \('confirmed', 'cancelled'\)/,
  )
})

test('customer lookup route and confirmation UI expose required safe workflow', () => {
  assert.match(app, /path: '\/reservation', element: <ReservationLookupPage/)
  assert.match(page, /予約番号だけでは照会できません/)
  assert.match(page, /メールアドレスまたは電話番号/)
  assert.match(page, /予約をキャンセルする/)
  assert.match(page, /この操作は取り消せません/)
  assert.match(page, /自動返金は行われません/)
})

test('paid payments calculate a refund target without changing payment status', () => {
  assert.match(
    migration,
    /when v_payment\.status = 'paid'[\s\S]*greatest\(v_payment\.amount_yen - v_quote\.fee_yen, 0\)/,
  )
  assert.doesNotMatch(migration, /update public\.payments/)
})
