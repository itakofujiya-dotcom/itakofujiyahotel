import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import {
  buildCustomerCancellationConfirmation,
  buildHotelCancellationNotification,
} from '../supabase/functions/send-cancellation-email/templates.ts'

const snapshot = {
  deliveryId: '00000000-0000-4000-8000-000000000010',
  recipientKind: 'customer',
  notificationType: 'reservation_cancelled',
  reservationId: '00000000-0000-4000-8000-000000000011',
  reservationNumber: 'IFH-20260910-001',
  locale: 'ja',
  checkIn: '2026-09-10',
  checkOut: '2026-09-12',
  stayNights: 2,
  roomCount: 2,
  totalAmountYen: 68000,
  guestNote: '<script>alert("x")</script> 静かな部屋',
  cancelledAt: '2026-08-25T04:00:00.000Z',
  cancellationFeePercent: 0,
  cancellationFeeYen: 0,
  refundTargetYen: 68000,
  guest: {
    name: '<山田 太郎>',
    kana: 'ヤマダ タロウ',
    email: 'guest@example.com',
    telephone: '090-1234-5678',
  },
  payment: { method: 'bank_transfer', status: 'paid', amountYen: 68000 },
  rooms: [
    {
      roomTypeNameJa: '和室',
      roomTypeNameKo: '다다미방',
      adults: 2,
      paidChildren: 1,
      freePreschoolChildren: 0,
      mealPlan: 'breakfast',
    },
    {
      roomTypeNameJa: '洋室',
      roomTypeNameKo: '침대방',
      adults: 2,
      paidChildren: 0,
      freePreschoolChildren: 1,
      mealPlan: 'breakfast_dinner',
    },
  ],
  hotel: {
    nameJa: '潮来富士屋ホテル',
    nameKo: '이타코 후지야 호텔',
    email: 'hotel@example.com',
    telephone: '0299-94-2662',
    fax: '0299-94-2663',
  },
}

test('builds Japanese customer cancellation confirmation and refund guidance', () => {
  const message = buildCustomerCancellationConfirmation(
    snapshot,
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.equal(message.to, 'guest@example.com')
  assert.match(message.subject, /ご予約のキャンセルを承りました/)
  assert.match(message.text, /IFH-20260910-001/)
  assert.match(message.text, /キャンセル料: 0円/)
  assert.match(message.text, /返金予定額: 68,000円/)
  assert.match(message.text, /1週間以内/)
  assert.match(message.text, /口座情報/)
  assert.match(message.text, /振込手数料/)
})

test('builds Korean customer cancellation confirmation without Japanese UI copy', () => {
  const message = buildCustomerCancellationConfirmation(
    { ...snapshot, locale: 'ko' },
    'sender@example.com',
    '이타코 후지야 호텔',
  )
  assert.match(message.subject, /예약 취소가 완료되었습니다/)
  assert.match(message.text, /다다미방/)
  assert.match(message.text, /침대방/)
  assert.match(message.text, /취소 수수료: 0엔/)
  assert.match(message.text, /환불 예정 금액: 68,000엔/)
  assert.match(message.text, /송금수수료/)
  assert.doesNotMatch(message.text, /キャンセル料/)
})

test('renders the cancellation fee recorded by the cancellation calculation', () => {
  const message = buildCustomerCancellationConfirmation(
    {
      ...snapshot,
      cancellationFeePercent: 30,
      cancellationFeeYen: 20400,
      refundTargetYen: 47600,
    },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.match(message.text, /キャンセル料率: 30%/)
  assert.match(message.text, /キャンセル料: 20,400円/)
  assert.match(message.text, /返金予定額: 47,600円/)
})

test('hotel cancellation notification includes contacts, rooms, money, and request', () => {
  const message = buildHotelCancellationNotification(
    { ...snapshot, recipientKind: 'hotel' },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.equal(message.to, 'hotel@example.com')
  assert.match(message.subject, /【予約キャンセル】/)
  assert.match(message.text, /090-1234-5678/)
  assert.match(message.text, /guest@example.com/)
  assert.match(message.text, /和室/)
  assert.match(message.text, /洋室/)
  assert.match(message.text, /返金予定額/)
  assert.match(message.text, /静かな部屋/)
})

test('cancellation templates escape customer-controlled HTML', () => {
  const customer = buildCustomerCancellationConfirmation(
    snapshot,
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  const hotel = buildHotelCancellationNotification(
    { ...snapshot, recipientKind: 'hotel' },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.doesNotMatch(customer.html, /<山田 太郎>/)
  assert.match(customer.html, /&lt;山田 太郎&gt;/)
  assert.doesNotMatch(hotel.html, /<script>/)
  assert.match(hotel.html, /&lt;script&gt;/)
})

test('unpaid cancellation does not promise a refund', () => {
  const message = buildCustomerCancellationConfirmation(
    {
      ...snapshot,
      refundTargetYen: 0,
      payment: {
        method: 'pay_at_hotel',
        status: 'cancelled',
        amountYen: 68000,
      },
    },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.match(message.text, /返金手続きはありません/)
})

test('cancellation function handles CORS before DB or Gmail work', async () => {
  const source = await readFile(
    new URL(
      '../supabase/functions/send-cancellation-email/index.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const optionsAt = source.indexOf("request.method === 'OPTIONS'")
  const clientAt = source.indexOf('createCancellationEmailClient()')
  const gmailAt = source.indexOf('createGmailMailer()')
  assert.ok(optionsAt >= 0)
  assert.ok(clientAt > optionsAt)
  assert.ok(gmailAt > optionsAt)
  assert.match(source, /status: 204/)
  assert.match(source, /'Access-Control-Allow-Origin': '\*'/)
  assert.match(source, /'Access-Control-Allow-Methods': 'POST, OPTIONS'/)
})
