import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

const baseMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608210009_public_reservation_cancellation.sql',
    import.meta.url,
  ),
  'utf8',
)
const completionMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608250003_public_cancellation_completion.sql',
    import.meta.url,
  ),
  'utf8',
)
const correctionMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608250004_correct_cancellation_policy_ranges.sql',
    import.meta.url,
  ),
  'utf8',
)
const seed = readFileSync(
  new URL('../supabase/seed/seed.sql', import.meta.url),
  'utf8',
)
const bookingMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608210007_mixed_room_meal_plans.sql',
    import.meta.url,
  ),
  'utf8',
)
const schemaMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608190001_initial_schema.sql',
    import.meta.url,
  ),
  'utf8',
)
const notificationMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608250001_reservation_created_email_notifications.sql',
    import.meta.url,
  ),
  'utf8',
)
const adminReservationMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608200002_admin_reservations.sql',
    import.meta.url,
  ),
  'utf8',
)
const page = readFileSync(
  new URL('../src/pages/public/ReservationLookupPage.tsx', import.meta.url),
  'utf8',
)
const api = readFileSync(
  new URL(
    '../src/features/public-reservation/public-reservation-api.ts',
    import.meta.url,
  ),
  'utf8',
)
const labels = readFileSync(
  new URL('../src/features/booking/public-labels.ts', import.meta.url),
  'utf8',
)
const adminDetail = readFileSync(
  new URL('../src/pages/admin/ReservationDetailPage.tsx', import.meta.url),
  'utf8',
)
const translations = readFileSync(
  new URL('../src/i18n/public-translations.ts', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')

const policies = [
  { code: 'free_7_plus', rule: '8日以上前', min: 8, max: null, fee: 0 },
  { code: 'days_6_to_4', rule: '7～4日前', min: 4, max: 7, fee: 30 },
  { code: 'days_3_to_2', rule: '3～2日前', min: 2, max: 3, fee: 50 },
  { code: 'previous_day', rule: '前日', min: 1, max: 1, fee: 100 },
  { code: 'same_day', rule: '当日', min: 0, max: 0, fee: 100 },
]

function policyFor(daysBefore) {
  const normalizedDays = Math.max(daysBefore, 0)
  return policies.find(
    (policy) =>
      normalizedDays >= policy.min &&
      (policy.max === null || normalizedDays <= policy.max),
  )
}

function onlineCancellationFor(daysBefore) {
  const policy = policyFor(daysBefore)
  return daysBefore >= 8 && policy?.fee === 0
}

function calculateCancellation(daysBefore, totalAmountYen = 10_000) {
  const policy = policyFor(daysBefore)
  assert.ok(policy, `policy missing for ${daysBefore} days before check-in`)
  return {
    daysBefore,
    policyCode: policy.code,
    appliedRule: policy.rule,
    feePercent: policy.fee,
    feeYen: Math.round((totalAmountYen * policy.fee) / 100),
    onlineCancellable: onlineCancellationFor(daysBefore),
  }
}

const inventoryBlockingStatuses = new Set([
  'pending',
  'confirmed',
  'checked_in',
])

function availableQuantity(sellableQuantity, reservations) {
  const bookedRooms = reservations
    .filter((reservation) => inventoryBlockingStatuses.has(reservation.status))
    .reduce((total, reservation) => total + reservation.roomQuantity, 0)
  return Math.max(sellableQuantity - bookedRooms, 0)
}

function cancelFixture(fixture, channel = 'public') {
  if (fixture.status === 'cancelled')
    return { code: 'ALREADY_CANCELLED', releasedBlocks: 0 }
  if (!['pending', 'confirmed'].includes(fixture.status))
    return { code: 'RESERVATION_NOT_CANCELLABLE', releasedBlocks: 0 }

  fixture.status = 'cancelled'
  fixture.cancelledAt = '2026-08-25T00:00:00.000Z'
  fixture.cancellation = calculateCancellation(fixture.daysBefore)
  let releasedBlocks = 0
  for (const block of fixture.inventoryBlocks) {
    if (block.status === 'held' || block.status === 'active') {
      block.status = 'released'
      releasedBlocks += 1
    }
  }
  if (channel === 'public') {
    fixture.notifications.add('reservation_cancelled:customer')
    fixture.notifications.add('reservation_cancelled:hotel')
  }
  return { code: 'RESERVATION_CANCELLED', releasedBlocks }
}

function reservationFixture(roomQuantity, daysBefore = 8) {
  return {
    status: 'confirmed',
    roomQuantity,
    daysBefore,
    cancelledAt: null,
    cancellation: null,
    inventoryBlocks: Array.from({ length: roomQuantity }, () => ({
      status: 'active',
    })),
    notifications: new Set(),
  }
}

test('covers the current cancellation policy boundaries', () => {
  assert.equal(policyFor(8)?.fee, 0)
  assert.equal(policyFor(7)?.fee, 30)
  assert.equal(policyFor(4)?.fee, 30)
  assert.equal(policyFor(3)?.fee, 50)
  assert.equal(policyFor(2)?.fee, 50)
  assert.equal(policyFor(1)?.fee, 100)
  assert.equal(policyFor(0)?.fee, 100)
  assert.equal(policyFor(-1)?.fee, 100)
})

test('matches the approved online cancellation and fee matrix', () => {
  for (const [daysBefore, online, fee] of [
    [8, true, 0],
    [7, false, 30],
    [6, false, 30],
    [5, false, 30],
    [4, false, 30],
    [3, false, 50],
    [2, false, 50],
    [1, false, 100],
    [0, false, 100],
  ]) {
    assert.equal(onlineCancellationFor(daysBefore), online)
    assert.equal(policyFor(daysBefore)?.fee, fee)
  }
  assert.match(seed, /'no_show',[\s\S]*?\n\s*null,\n\s*null,[\s\S]*?\n\s*100,/)
})

test('calculates boundary fees, amounts, day differences, and applied rules', () => {
  const expected = [
    [8, 'free_7_plus', '8日以上前', 0, 0],
    [7, 'days_6_to_4', '7～4日前', 30, 3_000],
    [4, 'days_6_to_4', '7～4日前', 30, 3_000],
    [3, 'days_3_to_2', '3～2日前', 50, 5_000],
    [2, 'days_3_to_2', '3～2日前', 50, 5_000],
    [1, 'previous_day', '前日', 100, 10_000],
    [0, 'same_day', '当日', 100, 10_000],
  ]

  for (const [daysBefore, policyCode, rule, feePercent, feeYen] of expected) {
    assert.deepEqual(calculateCancellation(daysBefore), {
      daysBefore,
      policyCode,
      appliedRule: rule,
      feePercent,
      feeYen,
      onlineCancellable: daysBefore === 8,
    })
  }
})

test('keeps fee calculation separate from the 8-day online cancellation gate', () => {
  for (const [daysBefore, feePercent, onlineCancellable] of [
    [8, 0, true],
    [7, 30, false],
    [4, 30, false],
    [3, 50, false],
    [2, 50, false],
    [1, 100, false],
    [0, 100, false],
  ]) {
    const result = calculateCancellation(daysBefore)
    assert.equal(result.feePercent, feePercent)
    assert.equal(result.onlineCancellable, onlineCancellable)
  }
})

test('applies 100 percent to no-show without using the online cancellation gate', () => {
  const totalAmountYen = 10_000
  const noShow = { feePercent: 100, feeYen: totalAmountYen }
  assert.deepEqual(noShow, { feePercent: 100, feeYen: 10_000 })
  assert.match(seed, /'no_show',[\s\S]*?\n\s*null,\n\s*null,[\s\S]*?\n\s*100,/)
  assert.match(
    baseMigration,
    /if p_status = 'no_show'[\s\S]*cancellation_fee_rate = 100,[\s\S]*cancellation_fee_yen = coalesce\(reservation\.total_amount_yen, 0\)/,
  )
})

test('restores exactly 1, 2, or 4 booked rooms to sellable inventory', () => {
  for (const roomQuantity of [1, 2, 4]) {
    const reservation = reservationFixture(roomQuantity)
    const reservations = [reservation]
    assert.equal(availableQuantity(5, reservations), 5 - roomQuantity)

    const cancelled = cancelFixture(reservation)
    assert.equal(cancelled.code, 'RESERVATION_CANCELLED')
    assert.equal(cancelled.releasedBlocks, roomQuantity)
    assert.equal(availableQuantity(5, reservations), 5)
    assert.equal(
      reservation.inventoryBlocks.filter((block) => block.status === 'released')
        .length,
      roomQuantity,
    )
  }
})

test('makes a repeated public cancellation inventory- and email-idempotent', () => {
  const reservation = reservationFixture(1)
  const reservations = [reservation]
  assert.equal(availableQuantity(5, reservations), 4)

  const first = cancelFixture(reservation)
  assert.equal(first.code, 'RESERVATION_CANCELLED')
  assert.equal(availableQuantity(5, reservations), 5)
  assert.equal(reservation.notifications.size, 2)

  const second = cancelFixture(reservation)
  assert.equal(second.code, 'ALREADY_CANCELLED')
  assert.equal(second.releasedBlocks, 0)
  assert.equal(availableQuantity(5, reservations), 5)
  assert.equal(reservation.notifications.size, 2)
})

test('customer and admin cancellations share fee, state, and inventory effects', () => {
  const customer = reservationFixture(2, 4)
  const admin = reservationFixture(2, 4)

  assert.equal(cancelFixture(customer, 'public').code, 'RESERVATION_CANCELLED')
  assert.equal(cancelFixture(admin, 'admin').code, 'RESERVATION_CANCELLED')
  assert.equal(customer.status, admin.status)
  assert.deepEqual(customer.cancellation, admin.cancellation)
  assert.equal(availableQuantity(5, [customer]), 5)
  assert.equal(availableQuantity(5, [admin]), 5)
  assert.equal(customer.notifications.size, 2)
  assert.equal(admin.notifications.size, 0)
})

test('uses active DB policies and the Asia/Tokyo hotel date', () => {
  assert.match(baseMigration, /from public\.cancellation_policies as policy/)
  assert.match(baseMigration, /policy\.is_active = true/)
  assert.match(baseMigration, /now\(\) at time zone 'Asia\/Tokyo'/)
  assert.match(completionMigration, /min_days_before = 8/)
  assert.match(
    correctionMigration,
    /set min_days_before = 4,[\s\S]*max_days_before = 7/,
  )
  assert.match(
    correctionMigration,
    /set min_days_before = 2,[\s\S]*max_days_before = 3/,
  )
  assert.match(seed, /'days_6_to_4',[\s\S]*?\n\s*4,\n\s*7,/)
  assert.match(seed, /'days_3_to_2',[\s\S]*?\n\s*2,\n\s*3,/)
})

test('requires reservation number plus matching email or normalized phone', () => {
  assert.match(
    completionMigration,
    /length\(btrim\(coalesce\(p_reservation_number/,
  )
  assert.match(completionMigration, /length\(v_contact\) < 3/)
  assert.match(
    completionMigration,
    /lower\(btrim\(v_guest\.email\)\) = lower\(v_contact\)/,
  )
  assert.match(
    completionMigration,
    /regexp_replace\(v_guest\.telephone, '\[\^0-9\]', '', 'g'\) = v_contact_phone/,
  )
  assert.match(completionMigration, /'code', 'RESERVATION_NOT_FOUND'/)
})

test('lookup exposes full safe detail and server-side online cancellation decision', () => {
  assert.match(completionMigration, /'guestKana'/)
  assert.match(completionMigration, /'guestNote'/)
  assert.match(completionMigration, /'stayNights'/)
  assert.match(completionMigration, /'roomCount'/)
  assert.match(
    completionMigration,
    /v_online_cancel_min_days constant integer := 8/,
  )
  assert.match(completionMigration, /'onlineCancellationReason'/)
  assert.match(completionMigration, /'CONTACT_HOTEL'/)
  assert.match(
    correctionMigration,
    /from public\.calculate_reservation_cancellation/,
  )
  assert.doesNotMatch(correctionMigration, /Some dates intentionally/)
  assert.match(correctionMigration, /'daysBefore', v_quote\.days_before/)
  assert.match(api, /feePercent: requireNumber\(value\.feePercent\)/)
})

test('public cancellation locks, enforces 8-day limit, and releases every room block', () => {
  assert.match(
    completionMigration,
    /create or replace function public\.cancel_public_reservation[\s\S]*for update/,
  )
  assert.match(completionMigration, /v_days < v_online_cancel_min_days/)
  assert.match(completionMigration, /ONLINE_CANCELLATION_WINDOW_CLOSED/)
  const cancelFunction = completionMigration.match(
    /create or replace function public\.cancel_public_reservation[\s\S]*?(?=create or replace function public\.claim_public_cancellation_notifications)/,
  )?.[0]
  assert.ok(cancelFunction)
  assert.ok(
    cancelFunction.indexOf('if v_days < v_online_cancel_min_days') <
      cancelFunction.indexOf('from public.calculate_reservation_cancellation'),
  )
  assert.match(
    completionMigration,
    /cancellation_fee_rate = v_quote\.fee_percent/,
  )
  assert.match(completionMigration, /cancellation_fee_yen = v_quote\.fee_yen/)
  assert.match(
    completionMigration,
    /where block\.reservation_room_id in \([\s\S]*where room\.reservation_id = v_reservation\.id[\s\S]*block\.status in \('held', 'active'\)/,
  )
  assert.match(completionMigration, /'automaticRefundProcessed', false/)
})

test('production SQL counts one reservation_rooms row per room and restores by status', () => {
  assert.match(
    bookingMigration,
    /from jsonb_array_elements\(p_rooms\)[\s\S]*insert into public\.reservation_rooms/,
  )
  assert.match(
    bookingMigration,
    /select count\(\*\)::integer[\s\S]*from public\.reservation_rooms as reserved_room[\s\S]*reservation\.status in \('pending', 'confirmed', 'checked_in'\)/,
  )
  assert.match(schemaMigration, /sellable_quantity integer not null/)
  assert.match(
    completionMigration,
    /where block\.reservation_room_id in \([\s\S]*where room\.reservation_id = v_reservation\.id/,
  )
})

test('production SQL prevents duplicate state, inventory, and notification changes', () => {
  const cancelFunction = completionMigration.match(
    /create or replace function public\.cancel_public_reservation[\s\S]*?(?=create or replace function public\.claim_public_cancellation_notifications)/,
  )?.[0]
  assert.ok(cancelFunction)
  const alreadyCancelledAt = cancelFunction.indexOf(
    "if v_reservation.status = 'cancelled'",
  )
  const reservationUpdateAt = cancelFunction.indexOf(
    'update public.reservations as reservation',
  )
  const inventoryReleaseAt = cancelFunction.indexOf(
    'update public.inventory_blocks as block',
  )
  const notificationInsertAt = cancelFunction.indexOf(
    'insert into public.notification_deliveries',
  )
  assert.ok(alreadyCancelledAt >= 0)
  assert.ok(alreadyCancelledAt < reservationUpdateAt)
  assert.ok(alreadyCancelledAt < inventoryReleaseAt)
  assert.ok(alreadyCancelledAt < notificationInsertAt)
  assert.match(
    notificationMigration,
    /unique \(reservation_id, notification_type, recipient_kind\)/,
  )
  assert.match(
    cancelFunction,
    /on conflict \(reservation_id, notification_type, recipient_kind\) do nothing/,
  )
})

test('admin and public cancellation RPCs use the same quote and release rules', () => {
  const publicCancel = completionMigration.match(
    /create or replace function public\.cancel_public_reservation[\s\S]*?(?=create or replace function public\.claim_public_cancellation_notifications)/,
  )?.[0]
  const adminCancel = baseMigration.match(
    /create or replace function public\.cancel_admin_reservation[\s\S]*?(?=-- General status transitions)/,
  )?.[0]
  assert.ok(publicCancel)
  assert.ok(adminCancel)
  for (const cancellationFunction of [publicCancel, adminCancel]) {
    assert.match(
      cancellationFunction,
      /public\.calculate_reservation_cancellation/,
    )
    assert.match(cancellationFunction, /set status = 'cancelled'/)
    assert.match(
      cancellationFunction,
      /cancellation_fee_rate = v_quote\.fee_percent/,
    )
    assert.match(
      cancellationFunction,
      /cancellation_fee_yen = v_quote\.fee_yen/,
    )
    assert.match(cancellationFunction, /set status = 'released'/)
  }
  assert.doesNotMatch(adminCancel, /notification_deliveries/)
})

test('persists cancellation state in existing schema fields and outbox records', () => {
  assert.match(adminReservationMigration, /add column cancelled_at timestamptz/)
  assert.match(
    adminReservationMigration,
    /add column cancellation_fee_rate integer/,
  )
  assert.match(
    adminReservationMigration,
    /add column cancellation_fee_yen integer/,
  )
  assert.match(completionMigration, /status = 'cancelled'/)
  assert.match(completionMigration, /cancelled_at = v_cancelled_at/)
  assert.match(
    completionMigration,
    /cancellation_fee_rate = v_quote\.fee_percent/,
  )
  assert.match(completionMigration, /cancellation_fee_yen = v_quote\.fee_yen/)
  assert.match(
    completionMigration,
    /'releasedInventoryBlocks', v_released_blocks/,
  )
  assert.match(
    notificationMigration,
    /create table public\.notification_deliveries/,
  )
})

test('cancellation closes only unpaid payments and preserves paid refund workflow', () => {
  assert.match(
    completionMigration,
    /payment\.status in \('pending', 'awaiting_payment'\)/,
  )
  assert.match(
    completionMigration,
    /when v_payment\.status = 'paid'[\s\S]*greatest\(v_payment\.amount_yen - v_quote\.fee_yen, 0\)/,
  )
  assert.doesNotMatch(completionMigration, /set status = 'refunded'/)
})

test('cancellation outbox is transactional and idempotent', () => {
  assert.match(completionMigration, /'reservation_cancelled', 'customer'/)
  assert.match(completionMigration, /'reservation_cancelled', 'hotel'/)
  assert.match(
    completionMigration,
    /on conflict \(reservation_id, notification_type, recipient_kind\) do nothing/,
  )
  assert.match(completionMigration, /for update of delivery skip locked/)
  assert.match(completionMigration, /to service_role/)
})

test('customer route and UI expose bilingual detail and status-only cancellation completion', () => {
  assert.match(app, /path: '\/reservation', element: <ReservationLookupPage/)
  assert.match(page, /reservation\.guestKana/)
  assert.match(page, /reservation\.guestNote/)
  assert.match(page, /reservation\.stayNights/)
  assert.match(page, /reservation\.onlineCancellationReason/)
  assert.match(page, /getLocalizedReservationStatusLabel/)
  assert.doesNotMatch(page, /CancellationCompletion/)
  assert.doesNotMatch(page, /cancellation-complete-title/)
  assert.match(labels, /cancelled: 'キャンセル済み'/)
  assert.match(labels, /cancelled: '취소 완료'/)
  assert.doesNotMatch(
    `${page}\n${labels}\n${translations}`,
    /客室は再び販売可能|객실은 다시 판매 가능/,
  )
  assert.match(page, /hotelTelephoneHref/)
})

test('email is invoked only after cancellation RPC and failure stays non-fatal', () => {
  const rpcAt = api.indexOf("supabase.rpc('cancel_public_reservation'")
  const parseResultAt = api.indexOf('const result: PublicCancellationResult')
  const returnAt = api.indexOf('return result', parseResultAt)
  assert.ok(rpcAt >= 0)
  assert.ok(parseResultAt > rpcAt)
  assert.ok(returnAt > parseResultAt)
  assert.match(api, /export async function requestCancellationNotifications/)
  assert.match(api, /return await supabase\.functions\.invoke/)
  assert.match(api, /reservation_number: reservationNumber/)
  assert.match(api, /contact,/)
  assert.doesNotMatch(api, /void requestCancellationNotifications/)
  assert.doesNotMatch(api, /setTimeout/)
  assert.doesNotMatch(api, /\.then\(/)

  const cancelPageAt = page.indexOf(
    'const cancelResult = await cancelPublicReservation',
  )
  const afterRpcAt = page.indexOf(
    "console.info('[cancellation-email] after-cancel-rpc')",
    cancelPageAt,
  )
  const preparingAt = page.indexOf(
    "console.info('[cancellation-email] preparing')",
    afterRpcAt,
  )
  const invokeAt = page.indexOf(
    'await requestCancellationNotifications',
    preparingAt,
  )
  const invokeReturnedAt = page.indexOf(
    "console.info('[cancellation-email] invoke-returned'",
    invokeAt,
  )
  const refreshPageAt = page.indexOf(
    'await lookupPublicReservation',
    invokeReturnedAt,
  )
  const updatePageAt = page.indexOf('setReservation(refreshed)', refreshPageAt)
  assert.ok(cancelPageAt >= 0)
  assert.ok(afterRpcAt > cancelPageAt)
  assert.ok(preparingAt > afterRpcAt)
  assert.ok(invokeAt > preparingAt)
  assert.ok(invokeReturnedAt > invokeAt)
  assert.ok(refreshPageAt > invokeReturnedAt)
  assert.ok(updatePageAt > refreshPageAt)
  assert.match(page, /\[cancellation-email\] identifiers-missing/)
  assert.match(page, /\[cancellation-email\] failed/)
  assert.match(page, /\[cancellation-email\] success/)
  assert.doesNotMatch(page, /void requestCancellationNotifications/)
  assert.doesNotMatch(
    page,
    /console\.(?:info|error)\([^\n]*(?:reservationNumber|contact)/,
  )
})

test('cancellation email and admin displays use the recorded cancellation fee', () => {
  assert.match(
    completionMigration,
    /'cancellationFeePercent', coalesce\(reservation\.cancellation_fee_rate, 0\)/,
  )
  assert.match(
    completionMigration,
    /'cancellationFeeYen', coalesce\(reservation\.cancellation_fee_yen, 0\)/,
  )
  assert.match(labels, /宿泊日の7日前～4日前：宿泊料金の30％/)
  assert.match(labels, /宿泊日の3日前～2日前：宿泊料金の50％/)
})

test('admin cancellation still shares policy calculation and generic status cannot cancel', () => {
  const adminCancel = baseMigration.match(
    /create or replace function public\.cancel_admin_reservation[\s\S]*?(?=-- General status transitions)/,
  )?.[0]
  assert.ok(adminCancel)
  assert.match(adminCancel, /public\.calculate_reservation_cancellation/)
  assert.match(adminCancel, /public\.is_admin\(\)/)
  assert.match(baseMigration, /if p_status = 'cancelled' then/)
  assert.match(baseMigration, /USE_RESERVATION_CANCELLATION_RPC/)
  assert.match(
    adminDetail,
    /キャンセル料を取得できませんでした。ページを再読み込みしてください。/,
  )
})
