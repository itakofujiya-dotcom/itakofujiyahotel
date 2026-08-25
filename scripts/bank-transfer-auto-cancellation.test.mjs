import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import {
  buildCustomerCancellationConfirmation,
  buildHotelCancellationNotification,
} from '../supabase/functions/send-cancellation-email/templates.ts'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202608250006_bank_transfer_auto_cancellation.sql',
    import.meta.url,
  ),
  'utf8',
)
const workerNotificationMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608260001_limit_expiration_worker_notifications.sql',
    import.meta.url,
  ),
  'utf8',
)
const worker = readFileSync(
  new URL(
    '../supabase/functions/send-cancellation-email/index.ts',
    import.meta.url,
  ),
  'utf8',
)

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function fixture({
  method = 'bank_transfer',
  paymentStatus = 'awaiting_payment',
  reservationStatus = 'confirmed',
  ageDays = 8,
  roomQuantity = 1,
  assignedRooms = roomQuantity,
} = {}) {
  const now = Date.parse('2026-09-10T03:00:00.000Z') // 12:00 JST
  return {
    now,
    reservation: {
      status: reservationStatus,
      createdAt: now - ageDays * DAY,
      cancelledAt: null,
      adminNote: null,
      roomQuantity,
    },
    payment: {
      method,
      status: paymentStatus,
      paidAt: paymentStatus === 'paid' ? now - HOUR : null,
    },
    inventoryBlocks: Array.from({ length: assignedRooms }, () => 'active'),
    notifications: new Set(),
  }
}

function dueAt(item) {
  return item.reservation.createdAt + 7 * DAY
}

function availableQuantity(sellableQuantity, items) {
  return (
    sellableQuantity -
    items
      .filter((item) =>
        ['pending', 'confirmed', 'checked_in'].includes(item.reservation.status),
      )
      .reduce((sum, item) => sum + item.reservation.roomQuantity, 0)
  )
}

function processExpiration(item) {
  const eligible =
    item.payment.method === 'bank_transfer' &&
    ['pending', 'awaiting_payment'].includes(item.payment.status) &&
    item.payment.paidAt === null &&
    dueAt(item) <= item.now &&
    ['pending', 'confirmed'].includes(item.reservation.status)
  if (!eligible) return { processed: 0, released: 0, enqueued: 0 }

  item.reservation.status = 'cancelled'
  item.reservation.cancelledAt = item.now
  item.reservation.adminNote = '入金期限切れによる自動キャンセル'
  item.payment.status = 'cancelled'
  let released = 0
  item.inventoryBlocks = item.inventoryBlocks.map((status) => {
    if (status !== 'active' && status !== 'held') return status
    released += 1
    return 'released'
  })
  const before = item.notifications.size
  item.notifications.add('reservation_cancelled:customer')
  item.notifications.add('reservation_cancelled:hotel')
  return {
    processed: 1,
    released,
    enqueued: item.notifications.size - before,
  }
}

test('stores the deadline as reservation creation instant plus seven days', () => {
  const item = fixture({ ageDays: 0 })
  assert.equal(dueAt(item) - item.reservation.createdAt, 7 * DAY)
  assert.match(
    migration,
    /reservation\.created_at \+ interval '7 days'/,
  )
  assert.match(migration, /payment_due_at timestamptz/)

  const createdAt = Date.parse('2026-08-25T01:30:00.000Z') // 10:30 JST
  assert.equal(
    new Date(createdAt + 7 * DAY).toISOString(),
    '2026-09-01T01:30:00.000Z',
  )
})

test('CASE A: keeps an unpaid bank transfer before its deadline', () => {
  const item = fixture({ ageDays: 6 })
  assert.deepEqual(processExpiration(item), {
    processed: 0,
    released: 0,
    enqueued: 0,
  })
  assert.equal(item.reservation.status, 'confirmed')
})

test('CASE B: cancels an unpaid bank transfer at or after its deadline', () => {
  const item = fixture({ ageDays: 7 })
  assert.equal(processExpiration(item).processed, 1)
  assert.equal(item.reservation.status, 'cancelled')
  assert.equal(item.payment.status, 'cancelled')
})

test('CASE C: protects a paid bank transfer after its deadline', () => {
  const item = fixture({ ageDays: 8, paymentStatus: 'paid' })
  assert.equal(processExpiration(item).processed, 0)
  assert.equal(item.reservation.status, 'confirmed')
})

test('CASE D: keeps pay-at-hotel reservations regardless of age', () => {
  const item = fixture({ ageDays: 30, method: 'pay_at_hotel' })
  assert.equal(processExpiration(item).processed, 0)
  assert.equal(item.reservation.status, 'confirmed')
})

test('checked-in, checked-out, no-show, and cancelled reservations are excluded', () => {
  for (const status of ['checked_in', 'checked_out', 'no_show', 'cancelled']) {
    const item = fixture({ ageDays: 30, reservationStatus: status })
    assert.equal(processExpiration(item).processed, 0)
    assert.equal(item.reservation.status, status)
  }
})

test('CASE E: repeated cron runs are idempotent', () => {
  const item = fixture({ ageDays: 8 })
  assert.deepEqual(processExpiration(item), {
    processed: 1,
    released: 1,
    enqueued: 2,
  })
  assert.deepEqual(processExpiration(item), {
    processed: 0,
    released: 0,
    enqueued: 0,
  })
  assert.equal(item.notifications.size, 2)
  assert.equal(item.inventoryBlocks[0], 'released')
})

test('CASE F: cancelling a two-room reservation restores 10 to 12', () => {
  const item = fixture({ ageDays: 8, roomQuantity: 2 })
  assert.equal(availableQuantity(12, [item]), 10)
  assert.equal(processExpiration(item).released, 2)
  assert.equal(availableQuantity(12, [item]), 12)
})

test('CASE G: unassigned rooms cancel and restore sellable availability', () => {
  const item = fixture({ ageDays: 8, roomQuantity: 2, assignedRooms: 0 })
  assert.equal(availableQuantity(12, [item]), 10)
  assert.deepEqual(processExpiration(item), {
    processed: 1,
    released: 0,
    enqueued: 2,
  })
  assert.equal(availableQuantity(12, [item]), 12)
})

test('SQL rechecks paid/status/deadline under row locks and uses unique outbox', () => {
  assert.match(migration, /for update of reservation skip locked/i)
  assert.match(migration, /where payment\.id = v_candidate\.payment_id\s+for update/i)
  assert.match(migration, /v_payment\.paid_at is not null/i)
  assert.match(migration, /v_reservation\.status not in \('pending', 'confirmed'\)/i)
  assert.match(
    migration,
    /on conflict \(reservation_id, notification_type, recipient_kind\) do nothing/i,
  )
  assert.match(migration, /block\.status in \('held', 'active'\)/i)
})

test('hourly worker uses the existing cancellation email path', () => {
  assert.match(migration, /'5 \* \* \* \*'/)
  assert.match(migration, /functions\/v1\/send-cancellation-email/)
  assert.match(worker, /processExpiredBankTransferReservations\(client\)/)
  assert.ok(
    worker.indexOf('processExpiredBankTransferReservations(client)') <
      worker.indexOf('claimPendingAutoCancellationDeliveries(client)'),
  )
})

test('scheduled worker claims only payment-expiration cancellation emails', () => {
  assert.match(
    workerNotificationMigration,
    /claim_pending_auto_cancellation_notifications/,
  )
  assert.match(
    workerNotificationMigration,
    /入金期限切れによる自動キャンセル/,
  )
  assert.match(workerNotificationMigration, /delivery\.status = 'pending'/)
  assert.match(worker, /claimPendingAutoCancellationDeliveries\(client\)/)
  assert.doesNotMatch(worker, /claimPendingCancellationDeliveries\(client\)/)
})

const emailSnapshot = {
  deliveryId: '00000000-0000-4000-8000-000000000001',
  recipientKind: 'customer',
  notificationType: 'reservation_cancelled',
  reservationId: '00000000-0000-4000-8000-000000000002',
  reservationNumber: 'IFH-TEST-001',
  locale: 'ja',
  checkIn: '2026-09-20',
  checkOut: '2026-09-21',
  stayNights: 1,
  roomCount: 2,
  totalAmountYen: 20_000,
  guestNote: null,
  cancelledAt: '2026-09-10T03:00:00.000Z',
  cancellationReason: 'bank_transfer_payment_expired',
  cancellationFeePercent: 30,
  cancellationFeeYen: 6_000,
  refundTargetYen: 0,
  guest: {
    name: 'テスト 太郎',
    kana: 'テスト タロウ',
    email: 'guest@example.com',
    telephone: '000-0000-0000',
  },
  payment: {
    method: 'bank_transfer',
    status: 'cancelled',
    amountYen: 20_000,
  },
  rooms: [
    {
      roomTypeNameJa: '洋室',
      roomTypeNameKo: '양실',
      adults: 2,
      paidChildren: 0,
      freePreschoolChildren: 0,
      mealPlan: 'breakfast',
    },
  ],
  hotel: {
    nameJa: '潮来富士屋ホテル',
    nameKo: '이타코 후지야 호텔',
    email: 'hotel@example.com',
    telephone: '000-0000-0000',
    fax: null,
  },
}

test('automatic cancellation emails state the unpaid-deadline reason', () => {
  const customer = buildCustomerCancellationConfirmation(
    emailSnapshot,
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.match(
    customer.text,
    /お支払い期限までにご入金を確認できなかったため、ご予約は自動的にキャンセルされました。/,
  )

  const hotel = buildHotelCancellationNotification(
    { ...emailSnapshot, recipientKind: 'hotel' },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.match(hotel.text, /入金期限切れによる自動キャンセル/)
})

test('Korean automatic cancellation email uses the matching reason', () => {
  const customer = buildCustomerCancellationConfirmation(
    { ...emailSnapshot, locale: 'ko' },
    'sender@example.com',
    '이타코 후지야 호텔',
  )
  assert.match(
    customer.text,
    /입금 기한까지 입금을 확인할 수 없어 예약이 자동으로 취소되었습니다\./,
  )
})
