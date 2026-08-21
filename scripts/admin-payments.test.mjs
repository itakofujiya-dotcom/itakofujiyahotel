import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import {
  formatJapanDateTime,
  getAllowedPaymentActions,
  getCheckInPaymentBlockMessage,
  getPaymentActionTarget,
  getPaymentWarning,
  getRestorePaymentStatus,
  paymentMethodLabels,
  paymentStatusLabels,
} from '../src/features/admin-reservations/payment-helpers.ts'

const payAtHotel = {
  id: 'payment-1',
  method: 'pay_at_hotel',
  status: 'pending',
  amount_yen: 19000,
  paid_at: null,
  external_reference: null,
}

const bankTransfer = {
  ...payAtHotel,
  id: 'payment-2',
  method: 'bank_transfer',
  status: 'awaiting_payment',
}

test('maps payment methods and every existing status to Japanese', () => {
  assert.equal(paymentMethodLabels.pay_at_hotel, '現地払い')
  assert.equal(paymentMethodLabels.bank_transfer, '銀行振込')
  assert.deepEqual(paymentStatusLabels, {
    pending: '未払い',
    awaiting_payment: '入金待ち',
    paid: '支払い済み',
    refunded: '返金済み',
    cancelled: '支払い取消',
  })
})

test('marks pay-at-hotel and bank-transfer payments as paid', () => {
  assert.deepEqual(getAllowedPaymentActions(payAtHotel), ['mark_paid'])
  assert.equal(getPaymentActionTarget(payAtHotel, 'mark_paid'), 'paid')
  assert.equal(getPaymentActionTarget(bankTransfer, 'mark_paid'), 'paid')
})

test('restores paid payments to a method-specific unpaid state', () => {
  assert.equal(getRestorePaymentStatus('pay_at_hotel'), 'pending')
  assert.equal(getRestorePaymentStatus('bank_transfer'), 'awaiting_payment')
  assert.equal(
    getPaymentActionTarget({ ...payAtHotel, status: 'paid' }, 'restore_unpaid'),
    'pending',
  )
  assert.equal(
    getPaymentActionTarget(
      { ...bankTransfer, status: 'paid' },
      'restore_unpaid',
    ),
    'awaiting_payment',
  )
})

test('allows paid to refunded and keeps terminal states closed', () => {
  assert.deepEqual(getAllowedPaymentActions({ status: 'paid' }), [
    'restore_unpaid',
    'mark_refunded',
  ])
  assert.equal(
    getPaymentActionTarget({ ...payAtHotel, status: 'paid' }, 'mark_refunded'),
    'refunded',
  )
  assert.deepEqual(getAllowedPaymentActions({ status: 'refunded' }), [])
  assert.deepEqual(getAllowedPaymentActions({ status: 'cancelled' }), [])
  assert.equal(
    getPaymentActionTarget({ ...payAtHotel, status: 'refunded' }, 'mark_paid'),
    null,
  )
})

test('warns for checked-in unpaid and cancelled paid reservations', () => {
  assert.deepEqual(getPaymentWarning('checked_in', payAtHotel), {
    title: '未払いです',
    description: 'チェックアウト前に支払い状況を確認してください。',
  })
  assert.equal(getPaymentWarning('checked_in', { status: 'paid' }), null)
  assert.equal(
    getPaymentWarning('cancelled', { status: 'paid' })?.title,
    '返金対応が必要です',
  )
  assert.equal(getPaymentWarning('no_show', payAtHotel), null)
})

test('blocks check-in only for refunded and cancelled payments', () => {
  assert.equal(
    getCheckInPaymentBlockMessage({ status: 'refunded' }),
    '返金済みのためチェックインできません。',
  )
  assert.equal(
    getCheckInPaymentBlockMessage({ status: 'cancelled' }),
    '支払い取消のためチェックインできません。',
  )
  for (const status of ['pending', 'awaiting_payment', 'paid'])
    assert.equal(getCheckInPaymentBlockMessage({ status }), null)
})

test('warns but allows confirmed unpaid and awaiting-payment reservations', () => {
  assert.deepEqual(getPaymentWarning('confirmed', { status: 'pending' }), {
    title: '未払いです',
    description: '支払い状況を確認してください。チェックイン操作は可能です。',
  })
  assert.equal(
    getPaymentWarning('confirmed', { status: 'awaiting_payment' })?.title,
    '入金待ちです',
  )
  assert.equal(getPaymentWarning('confirmed', { status: 'paid' }), null)
})

test('formats paid_at in Asia/Tokyo', () => {
  assert.equal(formatJapanDateTime(null), '—')
  assert.match(
    formatJapanDateTime('2026-08-21T17:10:00Z'),
    /2026\/08\/22 02:10/,
  )
})

test('corrective admin payment RPC locks rows and keeps safe transitions', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202608210002_fix_admin_payment_paid_at_ambiguity.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(migration, /if not public\.is_admin\(\)/)
  assert.match(migration, /for update/)
  assert.match(migration, /v_payment\.status <> p_expected_status/)
  assert.match(migration, /PAYMENT_STATUS_CHANGED/)
  assert.match(migration, /p_status = 'paid'/)
  assert.match(migration, /p_status in \(v_restore_status, 'refunded'\)/)
  assert.match(migration, /when p_status = 'paid' then now\(\)/)
  assert.match(
    migration,
    /when p_status in \('pending', 'awaiting_payment'\) then null/,
  )
  assert.match(migration, /update public\.payments as p/)
  assert.match(migration, /else p\.paid_at/)
  assert.match(migration, /select p\.id, p\.status, p\.paid_at/)
  assert.doesNotMatch(migration, /else paid_at/)
  assert.doesNotMatch(migration, /amount_yen/)
  assert.doesNotMatch(migration, /update public\.reservations/)
})

test('existing RLS grants payment management only through authenticated admin policy', () => {
  const schema = readFileSync(
    new URL(
      '../supabase/migrations/202608190001_initial_schema.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(schema, /alter table public\.payments enable row level security/)
  assert.match(schema, /create policy "admin manage payments"/)
  assert.match(schema, /using \(public\.is_admin\(\)\)/)
  assert.match(
    schema,
    /grant select, insert, update, delete\s+on public\.payments\s+to authenticated/,
  )
  assert.doesNotMatch(schema, /on public\.payments\s+to anon/)
})
