import process from 'node:process'
import console from 'node:console'
import { setTimeout } from 'node:timers'
// Runs ONLY against a disposable local PostgreSQL cluster. Never uses .env.local.
// npm install --prefix /tmp/hotel-inventory-db embedded-postgres@18.4.0-beta.17 pg@8.23.0
// INVENTORY_TEST_MODULE_ROOT=/tmp/hotel-inventory-db node scripts/atomic-inventory.integration.mjs
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
const require = createRequire(
  `${process.env.INVENTORY_TEST_MODULE_ROOT || process.cwd()}/package.json`,
)
const { Client } = require('pg')
const config = {
  host: '127.0.0.1',
  port: 55440,
  user: 'postgres',
  password: 'local-test-only',
  database: 'postgres',
}
const { default: EmbeddedPostgres } = await import(
  require.resolve('embedded-postgres')
)
const testDirectory = await mkdtemp(join(tmpdir(), 'hotel-inventory-test-'))
const server = new EmbeddedPostgres({
  databaseDir: join(testDirectory, 'data'),
  port: config.port,
  user: config.user,
  password: config.password,
  persistent: false,
  initdbFlags: ['--locale=C', '--encoding=UTF8'],
  onLog: () => {},
  onError: () => {},
})
await server.initialise()
await server.start()
const admin = new Client(config)
await admin.connect()
const name = `inventory_test_${Date.now()}`
await admin.query(`create database ${name}`)
const db = new Client({ ...config, database: name })
const other = new Client({ ...config, database: name })
await db.connect()
await other.connect()
try {
  await db
    .query(
      `create role anon; create role authenticated; create role service_role;`,
    )
    .catch((e) => {
      if (e.code !== '42710') throw e
    })
  await db.query(
    `create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select null::uuid$$; create function auth.role() returns text language sql as $$select 'service_role'::text$$;`,
  )
  let inventoryMigration
  for (const file of (await readdir('supabase/migrations')).sort()) {
    if (file === '202609070001_atomic_booking_inventory.sql') {
      inventoryMigration = await readFile(`supabase/migrations/${file}`, 'utf8')
      continue
    }
    let sql = await readFile(`supabase/migrations/${file}`, 'utf8')
    // Hosted scheduling extensions are unrelated to inventory. Load worker SQL,
    // but omit only the pg_cron/pg_net installation and scheduler registration.
    if (file === '202608250006_bank_transfer_auto_cancellation.sql')
      sql = sql.split('create extension if not exists pg_cron')[0]
    if (file === '202608260001_limit_expiration_worker_notifications.sql')
      continue
    await db.query('begin')
    try {
      await db.query(sql)
      await db.query('commit')
    } catch (e) {
      await db.query('rollback')
      throw new Error(`${file}: ${e.message}`, { cause: e })
    }
  }
  await db.query(await readFile('supabase/seed/seed.sql', 'utf8'))
  const type = (
    await db.query("select id from room_types where code='japanese'")
  ).rows[0].id
  const western = (
    await db.query("select id from room_types where code='western'")
  ).rows[0].id
  const dates = (
    await db.query(
      "select ((now() at time zone 'Asia/Tokyo')::date+10)::text as d, ((now() at time zone 'Asia/Tokyo')::date+11)::text as d2, ((now() at time zone 'Asia/Tokyo')::date+12)::text as out",
    )
  ).rows[0]
  const rooms = (n = 1, t = type) =>
    Array.from({ length: n }, () => ({
      room_type_id: t,
      adult_guest_count: 1,
      paid_child_count: 0,
      free_preschool_count: 0,
      meal_plan: 'breakfast',
    }))
  const stock = async (a, b = a, t = type) => {
    for (const [day, n] of [
      [dates.d, a],
      [dates.d2, b],
    ])
      await db.query(
        'insert into room_type_inventory(room_type_id,stay_date,sellable_quantity) values($1,$2,$3) on conflict(room_type_id,stay_date) do update set sellable_quantity=excluded.sellable_quantity',
        [t, day, n],
      )
  }
  const quote = async (rs = rooms()) =>
    (
      await db.query('select search_public_mixed_booking($1,$2,$3) q', [
        dates.d,
        dates.out,
        JSON.stringify(rs),
      ])
    ).rows[0].q
  await stock(4)
  const price = (await quote()).totalAmountYen
  const book = async (
    client = db,
    rs = rooms(),
    id = randomUUID(),
    total = price * rs.length,
  ) =>
    (
      await client.query(
        "select create_public_mixed_reservation($1,$2,$3,$4,'Test Guest','TEST GUEST','09012345678','test@example.com','15:00','',$5,'ko') r",
        [id, dates.d, dates.out, JSON.stringify(rs), total],
      )
    ).rows[0].r
  const count = async () =>
    Number((await db.query('select count(*) n from reservations')).rows[0].n)
  const availability = async (t = type) =>
    (
      await db.query(
        "select d::date::text as stay_day,a.* from generate_series($1::date,$2::date-1,interval '1 day') d cross join lateral calculate_room_type_availability($3,d::date) a order by d",
        [dates.d, dates.out, t],
      )
    ).rows
  const clear = async () => {
    await db.query('delete from payments')
    await db.query('delete from reservations')
    await stock(4)
    await stock(4, 4, western)
  }
  const rejected = async (n = 1) => {
    const before = await count()
    const result = await book(db, rooms(n))
    assert.equal(result.ok, false, JSON.stringify(result))
    assert.ok(
      ['BOOKING_NO_LONGER_AVAILABLE', 'INSUFFICIENT_INVENTORY'].includes(
        result.code,
      ),
    )
    assert.equal(await count(), before)
  }
  await db.query(
    'create or replace function public.is_admin() returns boolean language sql as $$select true$$',
  )
  await stock(0)
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [0, 0],
  )
  await db.query('select create_admin_reservation($1,$2,$3)', [
    {
      name: 'Test Guest',
      name_kana_or_roman: 'TEST GUEST',
      email: 'admin-test@example.com',
      telephone: '09012345678',
    },
    { check_in: dates.d, check_out: dates.out, booking_source: 'admin' },
    JSON.stringify(rooms()),
  ])
  assert.equal(await count(), 1)
  console.log(
    'REPRODUCED BEFORE FIX: admin RPC creates a confirmed reservation while both dates show zero',
  )
  await db.query('begin')
  await db.query(inventoryMigration)
  await db.query('commit')
  assert.equal(await count(), 1, 'migration preserves existing reservations')
  await clear()
  await stock(0)
  await rejected()
  console.log('PASS A: zero inventory')
  const legacy = (
    await db.query(
      "select create_public_reservation($1,$2,$3,1,0,0,1,$4,'Test Guest','TEST GUEST','09012345678','test@example.com','15:00','',$5) r",
      [randomUUID(), dates.d, dates.out, type, price],
    )
  ).rows[0].r
  assert.equal(legacy.code, 'BOOKING_NO_LONGER_AVAILABLE')
  assert.equal(await count(), 0)
  const displayed = (
    await db.query(
      'select available_quantity from get_admin_inventory_availability($1,$2) where room_type_id=$3 order by stay_date',
      [dates.d, dates.d2, type],
    )
  ).rows
  assert.deepEqual(
    displayed.map((r) => r.available_quantity),
    [0, 0],
  )
  const search = (
    await db.query(
      'select available_quantity,is_available from search_available_room_types($1,$2,1,0,0,1) where room_type_id=$3',
      [dates.d, dates.out, type],
    )
  ).rows[0]
  assert.equal(search.available_quantity, 0)
  assert.equal(search.is_available, false)
  console.log('PASS: legacy booking and both search/display RPCs agree on zero')

  await stock(1)
  await db.query('begin')
  const first = await book()
  assert.equal(first.ok, true, JSON.stringify(first))
  let completed = false
  const second = book(other).then((r) => {
    completed = true
    return r
  })
  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(
    completed,
    false,
    'second transaction must wait for first commit',
  )
  await db.query('commit')
  assert.equal((await second).ok, false)
  assert.equal(await count(), 1)
  console.log(
    'PASS B: two connections, exactly one success, loser waits for commit',
  )
  await clear()
  await stock(2)
  await rejected(3)
  console.log('PASS C: aggregate three rooms exceeds two')
  await stock(2, 0)
  await rejected()
  console.log('PASS D: second night sold out, no partial reservation')
  await stock(3)
  const key = randomUUID()
  const success = await book(db, rooms(2), key)
  assert.equal(success.ok, true, JSON.stringify(success))
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [1, 1],
  )
  assert.deepEqual(
    (
      await db.query(
        'select remaining from booking_inventory_balance where room_type_id=$1 order by stay_date',
        [type],
      )
    ).rows.map((a) => a.remaining),
    [1, 1],
  )
  const again = await book(db, rooms(2), key)
  assert.equal(again.idempotent, true)
  assert.equal(await count(), 1)
  console.log(
    'PASS E: two rooms deducted on every night; idempotent retry does not deduct twice',
  )
  // Same DB status transition used by cancellation / automatic expiry policies.
  assert.equal(
    (
      await db.query(
        "select cancel_public_reservation($1,'test@example.com') r",
        [success.reservationNumber],
      )
    ).rows[0].r.ok,
    true,
  )
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [3, 3],
  )
  assert.equal(
    (
      await db.query(
        "select cancel_public_reservation($1,'test@example.com') r",
        [success.reservationNumber],
      )
    ).rows[0].r.code,
    'ALREADY_CANCELLED',
  )
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [3, 3],
  )
  console.log('PASS F: cancellation restores all nights exactly once')
  await clear()
  await stock(0)
  await rejected()
  console.log('PASS G: administrator stops date sales after old quote')
  await clear()
  await db.query('update room_types set is_sellable=false where id=$1', [type])
  assert.equal((await book()).ok, false)
  await db.query('update room_types set is_sellable=true where id=$1', [type])
  await db.query(
    "insert into inventory_blocks(room_id,check_in,check_out,reason) select id,$1,$2,'maintenance' from rooms where room_type_id=$3",
    [dates.d, dates.out, type],
  )
  await rejected()
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [0, 0],
  )
  await db.query('delete from inventory_blocks')
  console.log('PASS: product sale stop and physical-room date blocks')
  await stock(1)
  await stock(0, 0, western)
  const mixed = await book(db, [...rooms(), ...rooms(1, western)])
  assert.equal(mixed.ok, false)
  assert.equal(await count(), 0)
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [1, 1],
  )
  console.log('PASS: mixed type failure rolls back every room')
  // Bypass customer quote: admin RPC must still hit the DB constraint and roll back guest too.
  await db.query(
    'create or replace function public.is_admin() returns boolean language sql as $$select true$$',
  )
  await stock(0)
  const guestsBefore = Number(
    (await db.query('select count(*) n from guests')).rows[0].n,
  )
  await assert.rejects(
    db.query('select create_admin_reservation($1,$2,$3)', [
      {
        name: 'Test Guest',
        name_kana_or_roman: 'TEST GUEST',
        email: 'admin-test@example.com',
        telephone: '09012345678',
      },
      { check_in: dates.d, check_out: dates.out, booking_source: 'admin' },
      JSON.stringify(rooms()),
    ]),
    /INSUFFICIENT_INVENTORY/,
  )
  assert.equal(await count(), 0)
  assert.equal(
    Number((await db.query('select count(*) n from guests')).rows[0].n),
    guestsBefore,
  )
  console.log(
    'PASS: administrator bypass blocked; guest and reservation rolled back',
  )
  await stock(1)
  await stock(0, 0, western)
  await assert.rejects(
    db.query('select create_admin_reservation($1,$2,$3)', [
      {
        name: 'Test Guest',
        name_kana_or_roman: 'TEST GUEST',
        email: 'admin-test@example.com',
        telephone: '09012345678',
      },
      { check_in: dates.d, check_out: dates.out, booking_source: 'admin' },
      JSON.stringify([...rooms(), ...rooms(1, western)]),
    ]),
    /INSUFFICIENT_INVENTORY/,
  )
  assert.equal(await count(), 0)
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [1, 1],
  )
  assert.deepEqual(
    (
      await db.query(
        'select remaining from booking_inventory_balance where room_type_id=$1 order by stay_date',
        [type],
      )
    ).rows.map((a) => a.remaining),
    [1, 1],
  )
  console.log(
    'PASS: second room failure rolls back first room deduction and all reservation data',
  )
  await db.query('begin')
  await stock(0)
  let saleStopCompleted = false
  const stale = book(other).then((r) => {
    saleStopCompleted = true
    return r
  })
  await new Promise((resolve) => setTimeout(resolve, 150))
  assert.equal(saleStopCompleted, false)
  await db.query('commit')
  assert.equal((await stale).code, 'BOOKING_NO_LONGER_AVAILABLE')
  assert.equal(await count(), 0)
  console.log(
    'PASS: concurrent administrator sale stop blocks stale customer quote',
  )
  await stock(1)
  const adminCancel = await book()
  assert.equal(adminCancel.ok, true)
  await db.query('select cancel_admin_reservation($1)', [
    adminCancel.reservationId,
  ])
  assert.deepEqual(
    (await availability()).map((a) => a.available_quantity),
    [1, 1],
  )
  console.log('PASS: administrator cancellation restores all nights')
  await assert.rejects(
    db.query('update booking_inventory_balance set remaining=-1'),
    /check constraint/,
  )
  console.log('PASS: negative balance CHECK constraint')
} finally {
  await other.end()
  await db.end()
  await admin.query(`drop database ${name} with (force)`)
  await admin.end()
  await server.stop()
  await rm(testDirectory, { recursive: true, force: true })
}
