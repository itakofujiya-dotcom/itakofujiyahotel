import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import {
  calculateCustomerStats,
  getCustomerVisitLabel,
  normalizeCustomerPhone,
} from '../src/features/admin-customers/customer-helpers.ts'

test('normalizes formatted telephone numbers to the same customer key', () => {
  assert.equal(normalizeCustomerPhone('090-1234-5678'), '09012345678')
  assert.equal(normalizeCustomerPhone('09012345678'), '09012345678')
  assert.equal(normalizeCustomerPhone('+81 90 1234 5678'), '819012345678')
})

test('calculates visits only from checked-out stays', () => {
  const stats = calculateCustomerStats([
    {
      check_in: '2026-06-01',
      check_out: '2026-06-03',
      status: 'checked_out',
    },
    {
      check_in: '2026-07-01',
      check_out: '2026-07-04',
      status: 'cancelled',
    },
    {
      check_in: '2026-08-01',
      check_out: '2026-08-04',
      status: 'checked_out',
    },
    {
      check_in: '2026-09-01',
      check_out: '2026-09-02',
      status: 'confirmed',
    },
  ])
  assert.deepEqual(stats, {
    totalReservations: 4,
    completedStays: 2,
    firstVisit: '2026-06-01',
    recentVisit: '2026-08-01',
    totalNights: 5,
    averageVisitIntervalDays: 61,
  })
})

test('uses simple visit labels based on completed stays', () => {
  assert.equal(getCustomerVisitLabel(0), '宿泊履歴なし')
  assert.equal(getCustomerVisitLabel(1), '訪問 1回')
  assert.equal(getCustomerVisitLabel(5), '再訪 5回')
})

test('customer migration backfills reservations and protects customer data', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202608210006_customer_management.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(migration, /create table public\.customers/)
  assert.match(migration, /normalized_phone text generated always/)
  assert.match(migration, /unique \(normalized_name, normalized_phone\)/)
  assert.match(migration, /add column customer_id uuid/)
  assert.doesNotMatch(migration, /alter column customer_id set not null/)
  assert.match(migration, /set_reservation_customer_before_write/)
  assert.match(migration, /after update of name, telephone, email/)
  assert.match(migration, /insert into public\.customers[\s\S]*public\.guests/)
  assert.match(
    migration,
    /alter table public\.customers enable row level security/,
  )
  assert.match(migration, /create policy "admin manage customers"/)
  assert.match(migration, /revoke all on public\.customers from anon/)
  assert.doesNotMatch(migration, /grant [^;]+ on public\.customers to anon/)
})

test('customer list RPC checks admin access, normalizes phone search, and paginates', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202608210006_customer_management.sql',
      import.meta.url,
    ),
    'utf8',
  )
  assert.match(
    migration,
    /create or replace function public\.get_admin_customers/,
  )
  assert.match(migration, /if not public\.is_admin\(\)/)
  assert.match(
    migration,
    /v_phone_search text := public\.normalize_customer_phone/,
  )
  assert.match(migration, /r\.status = 'checked_out'/)
  assert.match(migration, /count\(\*\) over\(\) as total_count/)
  assert.match(migration, /limit v_page_size/)
  assert.match(migration, /offset \(v_page - 1\) \* v_page_size/)
})

test('admin routes and navigation include customer management', () => {
  const app = readFileSync(
    new URL('../src/app/App.tsx', import.meta.url),
    'utf8',
  )
  const navigation = readFileSync(
    new URL('../src/data/navigation.ts', import.meta.url),
    'utf8',
  )
  assert.match(app, /path: 'customers'/)
  assert.match(app, /path: 'customers\/:id'/)
  assert.match(navigation, /顧客管理.*\/admin\/customers/)
})

test('customer master stores, backfills, syncs, and searches kana', () => {
  const migration = readFileSync(
    new URL(
      '../supabase/migrations/202608210012_customer_kana_master_and_sales.sql',
      import.meta.url,
    ),
    'utf8',
  )
  const api = readFileSync(
    new URL(
      '../src/features/admin-customers/admin-customers-api.ts',
      import.meta.url,
    ),
    'utf8',
  )
  const listPage = readFileSync(
    new URL('../src/pages/admin/CustomersAdminPage.tsx', import.meta.url),
    'utf8',
  )
  const detailPage = readFileSync(
    new URL('../src/pages/admin/CustomerDetailPage.tsx', import.meta.url),
    'utf8',
  )

  assert.match(
    migration,
    /alter table public\.customers[\s\S]*name_kana_or_roman text/,
  )
  assert.match(migration, /latest_customer_kana/)
  assert.match(migration, /order by r\.customer_id, r\.created_at desc/)
  assert.match(migration, /after update of name, name_kana_or_roman/)
  assert.match(migration, /guests_name_kana_or_roman_required/)
  assert.match(migration, /not valid/)
  assert.match(migration, /normalize\([^,]+, NFKC\)/)
  assert.match(migration, /if not public\.is_admin\(\)/)
  assert.match(api, /customer\.name_kana_or_roman/)
  assert.match(
    api,
    /select\('id, name, name_kana_or_roman, phone, email, memo'\)/,
  )
  assert.doesNotMatch(api, /guests!reservations_primary_guest_id_fkey/)
  assert.match(listPage, /<GuestNameWithKana/)
  assert.match(detailPage, /<GuestNameWithKana/)
  assert.match(detailPage, /formatGuestNameWithKana/)
})
