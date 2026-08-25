import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import { isEmailAddress } from '../supabase/functions/_shared/email-safety.ts'
import {
  GmailApiProvider,
  MailProviderError,
} from '../supabase/functions/_shared/mail-provider.ts'
import { buildReservationCreatedEmail } from '../supabase/functions/_shared/reservation-created-template.ts'

const baseSnapshot = {
  deliveryId: '00000000-0000-4000-8000-000000000001',
  recipientKind: 'customer',
  notificationType: 'reservation_created',
  reservationId: '00000000-0000-4000-8000-000000000002',
  reservationNumber: 'IFH-20260825-001',
  locale: 'ja',
  checkIn: '2026-08-28',
  checkOut: '2026-08-30',
  stayNights: 2,
  roomCount: 2,
  totalAmountYen: 68000,
  guestNote: '<script>alert("x")</script> 静かな部屋',
  createdAt: '2026-08-25T03:00:00.000Z',
  guest: {
    name: '<山田 太郎>',
    kana: 'ヤマダ タロウ',
    email: 'guest@example.com',
    telephone: '090-1234-5678',
  },
  payment: { method: 'pay_at_hotel', status: 'pending', amountYen: 68000 },
  rooms: [
    {
      roomTypeCode: 'japanese',
      roomTypeNameJa: '和室',
      roomTypeNameKo: '다다미방',
      adults: 2,
      paidChildren: 1,
      freePreschoolChildren: 0,
      mealPlan: 'breakfast',
      baseRoomAmountYen: 32000,
      mealSurchargeYen: 0,
      subtotalYen: 32000,
    },
    {
      roomTypeCode: 'western',
      roomTypeNameJa: '洋室',
      roomTypeNameKo: '침대방',
      adults: 2,
      paidChildren: 0,
      freePreschoolChildren: 1,
      mealPlan: 'breakfast_dinner',
      baseRoomAmountYen: 28000,
      mealSurchargeYen: 8000,
      subtotalYen: 36000,
    },
  ],
  cancellationPolicies: [
    {
      code: 'free',
      minDaysBefore: 7,
      maxDaysBefore: null,
      feePercent: 0,
      isNoShow: false,
      descriptionJa: '7日前まで',
      descriptionKo: '7일 전까지',
    },
    {
      code: 'no_show',
      minDaysBefore: null,
      maxDaysBefore: null,
      feePercent: 100,
      isNoShow: true,
      descriptionJa: '無連絡不泊',
      descriptionKo: '노쇼',
    },
  ],
  hotel: {
    nameJa: '潮来富士屋ホテル',
    nameKo: '이타코 후지야 호텔',
    nameEn: 'ITAKO FUJIYA HOTEL',
    email: 'hotel@example.com',
    telephone: '0299-94-2662',
    bankTransferInstructionsJa: '常陽銀行\n普通 1234567',
    bankTransferInstructionsKo: '조요은행\n보통 1234567',
  },
}

test('builds a Japanese customer confirmation for mixed multiple rooms', () => {
  const message = buildReservationCreatedEmail(
    baseSnapshot,
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.equal(message.to, 'guest@example.com')
  assert.match(message.subject, /ご予約ありがとうございます/)
  assert.match(message.subject, /IFH-20260825-001/)
  assert.match(message.html, /和室/)
  assert.match(message.html, /洋室/)
  assert.match(message.html, /朝食＋夕食/)
  assert.match(message.html, /食事追加料金/)
  assert.match(message.text, /予約総額: 68,000円/)
})

test('builds Korean copy and localized room, meal, payment labels', () => {
  const message = buildReservationCreatedEmail(
    { ...baseSnapshot, locale: 'ko' },
    'sender@example.com',
    '이타코 후지야 호텔',
  )
  assert.match(message.subject, /예약이 완료되었습니다/)
  assert.match(message.html, /다다미방/)
  assert.match(message.html, /침대방/)
  assert.match(message.html, /조식 \+ 석식/)
  assert.match(message.text, /예약 총액: 68,000엔/)
  assert.doesNotMatch(message.text, /予約総額/)
})

test('includes configured bank-transfer guidance without hardcoded account data', () => {
  const message = buildReservationCreatedEmail(
    {
      ...baseSnapshot,
      locale: 'ko',
      payment: {
        method: 'bank_transfer',
        status: 'awaiting_payment',
        amountYen: 68000,
      },
    },
    'sender@example.com',
    '이타코 후지야 호텔',
  )
  assert.match(message.html, /계좌이체 안내/)
  assert.match(message.html, /조요은행/)
  assert.match(message.text, /입금 대기/)
})

test('hotel notification contains guest contacts, requests, payment and rooms', () => {
  const message = buildReservationCreatedEmail(
    { ...baseSnapshot, recipientKind: 'hotel' },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.equal(message.to, 'hotel@example.com')
  assert.match(message.subject, /【新規予約】/)
  assert.match(message.text, /090-1234-5678/)
  assert.match(message.text, /guest@example.com/)
  assert.match(message.text, /静かな部屋/)
  assert.match(message.text, /予約作成日時/)
})

test('escapes customer-controlled HTML in customer and hotel templates', () => {
  const customer = buildReservationCreatedEmail(
    baseSnapshot,
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  const hotel = buildReservationCreatedEmail(
    { ...baseSnapshot, recipientKind: 'hotel' },
    'sender@example.com',
    '潮来富士屋ホテル',
  )
  assert.doesNotMatch(customer.html, /<山田 太郎>/)
  assert.match(customer.html, /&lt;山田 太郎&gt;/)
  assert.doesNotMatch(hotel.html, /<script>/)
  assert.match(hotel.html, /&lt;script&gt;/)
})

test('rejects a missing or malformed recipient before provider delivery', () => {
  assert.equal(isEmailAddress(''), false)
  assert.equal(isEmailAddress('not-an-email'), false)
  assert.equal(isEmailAddress('guest@example.com'), true)
})

test('Gmail provider uses OAuth and Gmail messages.send', async () => {
  const calls = []
  const provider = new GmailApiProvider(
    { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' },
    async (url, init) => {
      calls.push({ url: String(url), init })
      if (String(url).includes('oauth2.googleapis.com'))
        return globalThis.Response.json({
          access_token: 'access',
          expires_in: 3600,
        })
      return globalThis.Response.json({ id: 'gmail-message-id' })
    },
  )
  const result = await provider.send(
    buildReservationCreatedEmail(
      baseSnapshot,
      'sender@example.com',
      '潮来富士屋ホテル',
    ),
  )
  assert.deepEqual(result, {
    provider: 'gmail_api',
    messageId: 'gmail-message-id',
  })
  assert.equal(calls.length, 2)
  assert.match(calls[0].url, /oauth2\.googleapis\.com\/token/)
  assert.match(calls[1].url, /gmail\/v1\/users\/me\/messages\/send/)
  assert.match(String(calls[1].init.headers.authorization), /^Bearer /)
  assert.ok(JSON.parse(calls[1].init.body).raw)
})

test('provider failures remain explicit and test mode sends no real email', async () => {
  const provider = new GmailApiProvider(
    { clientId: 'client', clientSecret: 'secret', refreshToken: 'refresh' },
    async (url) =>
      String(url).includes('oauth2.googleapis.com')
        ? globalThis.Response.json({ access_token: 'access', expires_in: 3600 })
        : new globalThis.Response('{}', { status: 503 }),
  )
  await assert.rejects(
    () =>
      provider.send(
        buildReservationCreatedEmail(
          baseSnapshot,
          'sender@example.com',
          '潮来富士屋ホテル',
        ),
      ),
    (error) =>
      error instanceof MailProviderError && error.code === 'GMAIL_SEND_503',
  )
})

test('migration uses a transactional outbox with idempotent delivery keys', async () => {
  const sql = await readFile(
    new URL(
      '../supabase/migrations/202608250001_reservation_created_email_notifications.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(
    sql,
    /unique \(reservation_id, notification_type, recipient_kind\)/,
  )
  assert.match(sql, /after insert on public\.reservations/)
  assert.match(
    sql,
    /on conflict \(reservation_id, notification_type, recipient_kind\) do nothing/,
  )
  assert.match(sql, /where delivery\.status = 'pending'/)
  assert.match(sql, /for update skip locked/)
  assert.match(sql, /booking_request_id = p_booking_request_id/)
  assert.match(sql, /to service_role/)
  assert.match(
    sql,
    /revoke all on table public\.notification_deliveries from anon, authenticated/,
  )
})

test('booking completion keeps email failure outside the reservation RPC', async () => {
  const api = await readFile(
    new URL('../src/features/booking/booking-api.ts', import.meta.url),
    'utf8',
  )
  const page = await readFile(
    new URL('../src/pages/public/BookingConfirmPage.tsx', import.meta.url),
    'utf8',
  )
  assert.match(api, /The transactional outbox remains pending/)
  assert.match(api, /return 'queued'/)
  assert.match(page, /if \(result\.ok\)/)
  assert.match(page, /requestReservationCreatedNotifications/)
  assert.match(page, /completeBooking\(result\)/)
})
