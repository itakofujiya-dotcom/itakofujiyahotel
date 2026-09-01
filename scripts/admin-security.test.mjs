import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const projectRoot = path.resolve(import.meta.dirname, '..')

async function read(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8')
}

async function readMigrations() {
  const directory = path.join(projectRoot, 'supabase/migrations')
  const files = (await readdir(directory)).filter((file) =>
    file.endsWith('.sql'),
  )
  return Promise.all(files.map((file) => read(`supabase/migrations/${file}`)))
}

test('keeps every operational admin route below the protected route', async () => {
  const app = await read('src/app/App.tsx')
  const protectedRouteIndex = app.indexOf('element: <AdminProtectedRoute />')
  const adminLayoutIndex = app.indexOf("path: '/admin',", protectedRouteIndex)

  assert.notEqual(protectedRouteIndex, -1)
  assert.ok(adminLayoutIndex > protectedRouteIndex)

  for (const pathName of [
    'reservations',
    'reservations/new',
    'reservations/:id',
    'customers',
    'customers/:id',
    'rooms',
    'inventory',
    'rates',
    'sales',
    'settings',
  ]) {
    assert.ok(
      app.indexOf(`path: '${pathName}'`, adminLayoutIndex) > adminLayoutIndex,
    )
  }
})

test('does not expose administrator signup from the browser application', async () => {
  const sourceDirectory = path.join(projectRoot, 'src')
  const files = []

  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) await collect(entryPath)
      else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(entryPath)
    }
  }

  await collect(sourceDirectory)
  const source = (
    await Promise.all(files.map((file) => readFile(file, 'utf8')))
  ).join('\n')
  assert.doesNotMatch(source, /\.auth\.signUp\s*\(/)
})

test('persists, refreshes, and recovers auth sessions without browser secrets', async () => {
  const client = await read('src/lib/supabase/client.ts')
  const runtimeConfig = await read('src/lib/supabase/runtime-config.ts')

  assert.match(client, /persistSession:\s*true/)
  assert.match(client, /autoRefreshToken:\s*true/)
  assert.match(client, /detectSessionInUrl:\s*true/)
  assert.doesNotMatch(runtimeConfig, /service[_-]?role/i)
  assert.doesNotMatch(runtimeConfig, /database[_-]?password/i)
  assert.doesNotMatch(runtimeConfig, /gmail/i)
})

test('requires an active admin profile and database RLS for sensitive tables', async () => {
  const migrations = (await readMigrations()).join('\n')
  const initialSchema = await read(
    'supabase/migrations/202608190001_initial_schema.sql',
  )

  assert.match(initialSchema, /create or replace function public\.is_admin\(\)/)
  assert.match(initialSchema, /and is_active = true/)
  assert.match(
    initialSchema,
    /revoke all\s+on function public\.is_admin\(\)\s+from public/,
  )
  assert.match(
    initialSchema,
    /create policy "admin read own profile"[\s\S]*user_id = auth\.uid\(\)/,
  )

  for (const table of [
    'admin_profiles',
    'cancellation_policies',
    'customers',
    'guests',
    'hotel_settings',
    'inventory_blocks',
    'payments',
    'rate_overrides',
    'rate_rule_dates',
    'rate_rules',
    'reservation_room_nights',
    'reservation_rooms',
    'reservations',
    'room_rates',
    'room_type_inventory',
    'room_types',
    'rooms',
  ]) {
    assert.match(
      migrations,
      new RegExp(`alter table public\\.${table} enable row level security`),
    )
  }
})

test('checks administrator status inside privileged reservation RPCs', async () => {
  const guardedMigrations = [
    'supabase/migrations/202608210002_fix_admin_payment_paid_at_ambiguity.sql',
    'supabase/migrations/202608210003_block_terminal_payment_check_in.sql',
    'supabase/migrations/202608210007_mixed_room_meal_plans.sql',
    'supabase/migrations/202608210009_public_reservation_cancellation.sql',
    'supabase/migrations/202608200002_admin_reservations.sql',
    'supabase/migrations/202608250005_admin_inventory_availability.sql',
  ]

  for (const migration of guardedMigrations) {
    assert.match(await read(migration), /if not public\.is_admin\(\)/)
  }
})

test('implements password recovery without exposing account existence', async () => {
  const forgotPassword = await read('src/pages/admin/ForgotPasswordPage.tsx')
  const resetPassword = await read('src/pages/admin/ResetPasswordPage.tsx')

  assert.match(forgotPassword, /resetPasswordForEmail/)
  assert.match(forgotPassword, /登録されているメールアドレスの場合/)
  assert.match(resetPassword, /if \(!isAdmin\)/)
  assert.match(resetPassword, /updateUser\(\{ password \}\)/)
  assert.match(resetPassword, /await logout\(\)/)
})
