import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import {
  calculateSalesMetrics,
  formatSalesRoomSummary,
  formatSalesYen,
  getSalesDateRange,
  validateSalesDateRange,
} from '../src/features/admin-sales/sales-helpers.ts'
import { translateAdminText } from '../src/i18n/admin-translations.ts'

const migration = readFileSync(
  new URL(
    '../supabase/migrations/202608210010_admin_sales_reporting.sql',
    import.meta.url,
  ),
  'utf8',
)
const kanaMigration = readFileSync(
  new URL(
    '../supabase/migrations/202608210012_customer_kana_master_and_sales.sql',
    import.meta.url,
  ),
  'utf8',
)

const range = { startDate: '2026-08-01', endDate: '2026-08-31' }

test('builds quick periods from the Asia/Tokyo calendar date', () => {
  const now = new Date('2026-08-23T15:30:00Z')
  assert.deepEqual(getSalesDateRange('today', now), {
    startDate: '2026-08-24',
    endDate: '2026-08-24',
  })
  assert.deepEqual(getSalesDateRange('week', now), {
    startDate: '2026-08-24',
    endDate: '2026-08-30',
  })
  assert.deepEqual(getSalesDateRange('month', now), range)
  assert.deepEqual(getSalesDateRange('last_month', now), {
    startDate: '2026-07-01',
    endDate: '2026-07-31',
  })
})

test('validates custom periods without browser-timezone parsing', () => {
  assert.equal(validateSalesDateRange(range), null)
  assert.equal(
    validateSalesDateRange({ startDate: '2026-08-31', endDate: '2026-08-01' }),
    '開始日は終了日以前の日付にしてください。',
  )
  assert.equal(
    validateSalesDateRange({ startDate: '', endDate: '2026-08-01' }),
    '開始日と終了日を入力してください。',
  )
})

test('separates recognized revenue, cash collection, cancellation fees, and refunds', () => {
  const base = {
    reservationStatus: 'confirmed',
    checkOut: '2026-08-20',
    cancellationDate: null,
    reservationAmountYen: 20_000,
    cancellationFeeYen: 0,
    paymentMethod: 'pay_at_hotel',
    paymentStatus: 'paid',
    paymentAmountYen: 20_000,
    paymentDate: '2026-08-10',
  }
  const summary = calculateSalesMetrics(
    [
      { ...base, reservationStatus: 'pending', paymentStatus: 'pending' },
      base,
      {
        ...base,
        reservationStatus: 'checked_in',
        reservationAmountYen: 15_000,
        paymentMethod: 'bank_transfer',
        paymentStatus: 'awaiting_payment',
        paymentAmountYen: 15_000,
        paymentDate: null,
      },
      {
        ...base,
        reservationStatus: 'checked_out',
        reservationAmountYen: 30_000,
        paymentMethod: 'bank_transfer',
        paymentAmountYen: 30_000,
      },
      {
        ...base,
        reservationStatus: 'cancelled',
        cancellationDate: '2026-08-15',
        reservationAmountYen: 40_000,
        cancellationFeeYen: 12_000,
        paymentAmountYen: 40_000,
      },
      {
        ...base,
        reservationStatus: 'no_show',
        cancellationDate: '2026-08-18',
        reservationAmountYen: 50_000,
        cancellationFeeYen: 50_000,
        paymentAmountYen: 50_000,
      },
      {
        ...base,
        reservationStatus: 'checked_out',
        reservationAmountYen: 7_000,
        paymentStatus: 'refunded',
        paymentAmountYen: 7_000,
      },
    ],
    range,
  )

  assert.equal(summary.reservationRevenueYen, 92_000)
  assert.equal(summary.collectedYen, 50_000)
  assert.equal(summary.reservationCount, 5)
  assert.equal(summary.completedStayCount, 2)
  assert.equal(summary.cancellationFeeYen, 62_000)
  assert.equal(summary.refundTargetYen, 28_000)
  assert.deepEqual(summary.paymentMethods, [
    {
      method: 'pay_at_hotel',
      reservationRevenueYen: 47_000,
      collectedYen: 20_000,
      reservationCount: 3,
    },
    {
      method: 'bank_transfer',
      reservationRevenueYen: 45_000,
      collectedYen: 30_000,
      reservationCount: 2,
    },
    {
      method: 'card',
      reservationRevenueYen: 0,
      collectedYen: 0,
      reservationCount: 0,
    },
  ])
})

test('formats yen and mixed room summaries for both Admin locales', () => {
  assert.equal(formatSalesYen(1_280_000), '¥1,280,000')
  const rooms = [
    { roomTypeNameJa: '和室', roomCount: 1 },
    { roomTypeNameJa: '洋室', roomCount: 1 },
  ]
  assert.equal(
    formatSalesRoomSummary(rooms, (value) => value),
    '和室 1室 / 洋室 1室',
  )
  assert.equal(
    formatSalesRoomSummary(rooms, (value) => translateAdminText(value, 'ko')),
    '다다미방 1실 / 침대방 1실',
  )
})

test('sales RPCs are Admin-only, Tokyo-based, paginated, and read-only', () => {
  assert.match(
    migration,
    /create or replace function public\.get_admin_sales_summary/,
  )
  assert.match(
    migration,
    /create or replace function public\.get_admin_sales_details/,
  )
  assert.match(migration, /if not public\.is_admin\(\)/g)
  assert.match(migration, /at time zone 'Asia\/Tokyo'/)
  assert.match(migration, /payment_status = 'paid'/)
  assert.match(
    migration,
    /reservation_status not in \('cancelled', 'no_show'\)/,
  )
  assert.match(migration, /reservation_status in \('cancelled', 'no_show'\)/)
  assert.match(migration, /limit v_page_size/)
  assert.match(migration, /offset \(v_page - 1\) \* v_page_size/)
  assert.match(
    migration,
    /revoke all on function public\.get_admin_sales_summary/,
  )
  assert.match(migration, /to authenticated/)
  assert.doesNotMatch(
    migration,
    /\b(insert into|update public|delete from|alter table|create table)\b/i,
  )
})

test('adds the Admin route, navigation, i18n, and print-only report layout', () => {
  const app = readFileSync(
    new URL('../src/app/App.tsx', import.meta.url),
    'utf8',
  )
  const navigation = readFileSync(
    new URL('../src/data/navigation.ts', import.meta.url),
    'utf8',
  )
  const page = readFileSync(
    new URL('../src/pages/admin/SalesAdminPage.tsx', import.meta.url),
    'utf8',
  )
  const css = readFileSync(
    new URL('../src/styles/global.css', import.meta.url),
    'utf8',
  )
  const layout = readFileSync(
    new URL('../src/layouts/AdminLayout.tsx', import.meta.url),
    'utf8',
  )
  assert.match(app, /path: 'sales'.*SalesAdminPage/)
  assert.match(navigation, /売上管理.*\/admin\/sales/)
  assert.equal(translateAdminText('予約売上', 'ko'), '예약 매출')
  assert.equal(translateAdminText('入金合計', 'ko'), '실수납액')
  assert.equal(translateAdminText('支払方法別', 'ko'), '결제수단별')
  assert.match(page, /window\.print\(\)/)
  assert.match(page, /pageSize: 5000/)
  assert.match(css, /@page sales-report[\s\S]*size: A4 landscape/)
  assert.match(css, /\.sales-controls,[\s\S]*display: none !important/)
  assert.match(css, /\.sales-print-only[\s\S]*display: block !important/)
  assert.match(layout, /grid-cols-\[250px_minmax\(0,1fr\)\]/)
  assert.match(layout, /<main className="min-w-0 max-w-full/)
  assert.doesNotMatch(page, /min-w-\[1500px\]/)
  assert.doesNotMatch(page, /overflow-x-auto/)
  assert.match(page, /sales-table w-full table-fixed/)
  assert.match(page, /sales-card-list[\s\S]*2xl:hidden/)
  assert.match(page, /sales-table-wrapper[\s\S]*2xl:block/)
  assert.match(page, /<GuestNameWithKana/)
  assert.match(page, /nameKanaOrRoman=\{detail\.guestNameKanaOrRoman\}/)
  assert.match(
    kanaMigration,
    /create or replace function public\.get_admin_sales_details_with_kana/,
  )
  assert.match(kanaMigration, /guest\.name_kana_or_roman/)
  assert.match(kanaMigration, /if not public\.is_admin\(\)/)
  assert.match(css, /\.sales-table-wrapper[\s\S]*display: block !important/)
  assert.match(css, /\.sales-card-list[\s\S]*display: none !important/)
  assert.doesNotMatch(css, /overflow-x:\s*hidden/)
})
