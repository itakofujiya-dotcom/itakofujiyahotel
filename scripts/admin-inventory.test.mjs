import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { URL } from 'node:url'
import {
  buildInventorySaveRows,
  calculateRoomTypeCapacities,
  clearInventoryDateSelection,
  getExistingInventoryKeys,
  getInventoryCalendarSummaries,
  getInventoryMonthRange,
  getInventorySelectionDrafts,
  getInventorySummaries,
  getSelectableInventoryWeekendDates,
  toggleInventoryDateSelection,
  validateInventoryDrafts,
} from '../src/features/admin-inventory/inventory-helpers.ts'

const api = await readFile(
  new URL(
    '../src/features/admin-inventory/admin-inventory-api.ts',
    import.meta.url,
  ),
  'utf8',
)
const calendar = await readFile(
  new URL(
    '../src/features/admin-inventory/InventoryCalendar.tsx',
    import.meta.url,
  ),
  'utf8',
)
const availabilityMigration = await readFile(
  new URL(
    '../supabase/migrations/202608250005_admin_inventory_availability.sql',
    import.meta.url,
  ),
  'utf8',
)

const roomTypes = [
  { id: 'ja', code: 'japanese', name_ja: '和室', display_order: 1 },
  { id: 'we', code: 'western', name_ja: '洋室', display_order: 2 },
]
const rooms = [
  ...Array.from({ length: 27 }, () => ({
    room_type_id: 'ja',
    sales_status: 'active',
  })),
  ...Array.from({ length: 12 }, () => ({
    room_type_id: 'we',
    sales_status: 'active',
  })),
  { room_type_id: 'we', sales_status: 'inactive' },
]
const capacities = calculateRoomTypeCapacities(roomTypes, rooms)

test('calculates registered and active capacities separately', () => {
  assert.deepEqual(
    capacities.map(({ code, totalRooms, activeRooms }) => ({
      code,
      totalRooms,
      activeRooms,
    })),
    [
      { code: 'japanese', totalRooms: 27, activeRooms: 27 },
      { code: 'western', totalRooms: 13, activeRooms: 12 },
    ],
  )
})

test('uses active room capacity when a date has no saved inventory row', () => {
  const summaries = getInventorySummaries(capacities, [], '2026-08-25')
  assert.deepEqual(
    summaries.map(({ sellableQuantity, isDefault }) => ({
      sellableQuantity,
      isDefault,
    })),
    [
      { sellableQuantity: 27, isDefault: true },
      { sellableQuantity: 12, isDefault: true },
    ],
  )
})

test('uses saved quantities and distinguishes them from defaults', () => {
  const summaries = getInventorySummaries(
    capacities,
    [
      {
        id: 'inventory-ja',
        room_type_id: 'ja',
        stay_date: '2026-08-25',
        sellable_quantity: 10,
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z',
      },
      {
        id: 'inventory-we',
        room_type_id: 'we',
        stay_date: '2026-08-25',
        sellable_quantity: 4,
        created_at: '2026-08-20T00:00:00Z',
        updated_at: '2026-08-20T00:00:00Z',
      },
    ],
    '2026-08-25',
  )
  assert.equal(summaries[0].sellableQuantity, 10)
  assert.equal(summaries[1].sellableQuantity, 4)
  assert.equal(
    summaries.every((summary) => !summary.isDefault),
    true,
  )
})

function westernAvailability(stayDate, available, booked = 0, base = 12) {
  return {
    stay_date: stayDate,
    room_type_id: 'we',
    base_sellable_quantity: base,
    booked_quantity: booked,
    available_quantity: available,
  }
}

function westernCalendarQuantity(stayDate, availability, inventory = []) {
  return getInventoryCalendarSummaries(
    capacities,
    inventory,
    availability,
    stayDate,
  ).find((summary) => summary.roomTypeId === 'we')
}

test('shows 12, 10, 12 around a one-night two-room booking', () => {
  const availability = [
    westernAvailability('2026-09-04', 12),
    westernAvailability('2026-09-05', 10, 2),
    westernAvailability('2026-09-06', 12),
  ]
  assert.equal(
    westernCalendarQuantity('2026-09-04', availability)?.sellableQuantity,
    12,
  )
  assert.equal(
    westernCalendarQuantity('2026-09-05', availability)?.sellableQuantity,
    10,
  )
  assert.equal(
    westernCalendarQuantity('2026-09-06', availability)?.sellableQuantity,
    12,
  )
})

test('subtracts both occupied nights and excludes the checkout date', () => {
  const availability = [
    westernAvailability('2026-09-05', 10, 2),
    westernAvailability('2026-09-06', 10, 2),
    westernAvailability('2026-09-07', 12),
  ]
  assert.deepEqual(
    ['2026-09-05', '2026-09-06', '2026-09-07'].map(
      (date) => westernCalendarQuantity(date, availability)?.sellableQuantity,
    ),
    [10, 10, 12],
  )
})

test('reflects cancellation and multiple active reservations by status-derived availability', () => {
  assert.equal(
    westernCalendarQuantity('2026-09-05', [
      westernAvailability('2026-09-05', 10, 2),
    ])?.sellableQuantity,
    10,
  )
  assert.equal(
    westernCalendarQuantity('2026-09-05', [
      westernAvailability('2026-09-05', 12, 0),
    ])?.sellableQuantity,
    12,
  )
  assert.equal(
    westernCalendarQuantity('2026-09-05', [
      westernAvailability('2026-09-05', 7, 5),
    ])?.sellableQuantity,
    7,
  )
  assert.equal(
    westernCalendarQuantity('2026-09-05', [
      westernAvailability('2026-09-05', 9, 3),
    ])?.sellableQuantity,
    9,
  )
})

test('applies a date override before subtracting reservations and preserves star semantics', () => {
  const inventory = [
    {
      id: 'override-we',
      room_type_id: 'we',
      stay_date: '2026-09-05',
      sellable_quantity: 8,
      created_at: '',
      updated_at: '',
    },
  ]
  const summary = westernCalendarQuantity(
    '2026-09-05',
    [westernAvailability('2026-09-05', 6, 2, 8)],
    inventory,
  )
  assert.equal(summary?.sellableQuantity, 6)
  assert.equal(summary?.isDefault, false)

  const defaultSummary = westernCalendarQuantity('2026-09-05', [
    westernAvailability('2026-09-05', 10, 2),
  ])
  assert.equal(defaultSummary?.sellableQuantity, 10)
  assert.equal(defaultSummary?.isDefault, true)
})

test('uses reservation_rooms regardless of physical room assignment', () => {
  assert.match(availabilityMigration, /from public\.reservation_rooms/)
  assert.doesNotMatch(
    availabilityMigration.match(
      /booked as \([\s\S]*?\n {2}\)\n {2}select/,
    )?.[0] ?? '',
    /room_id is not null/,
  )
  assert.match(
    availabilityMigration,
    /reservation\.status in \('pending', 'confirmed', 'checked_in'\)/,
  )
  assert.match(
    availabilityMigration,
    /reservation\.check_in <= p_stay_date[\s\S]*p_stay_date < reservation\.check_out/,
  )
})

test('uses one canonical server calculation for customer search and Admin calendar', () => {
  const references = availabilityMigration.match(
    /public\.calculate_room_type_availability/g,
  )
  assert.ok(references && references.length >= 4)
  assert.match(
    availabilityMigration,
    /create or replace function public\.search_available_room_types/,
  )
  assert.match(
    availabilityMigration,
    /create or replace function public\.get_admin_inventory_availability/,
  )
  assert.match(api, /supabase\.rpc\([\s\S]*'get_admin_inventory_availability'/)
  assert.doesNotMatch(api, /from\('reservations'\)/)
  assert.match(calendar, /getInventoryCalendarSummaries/)
})

test('accepts zero and rejects quantities above active capacity', () => {
  const summaries = getInventorySummaries(capacities, [], '2026-08-25')
  assert.deepEqual(validateInventoryDrafts(summaries, { ja: '10', we: '0' }), [
    { roomTypeId: 'ja', quantity: 10 },
    { roomTypeId: 'we', quantity: 0 },
  ])
  assert.equal(validateInventoryDrafts(summaries, { ja: '28', we: '4' }), null)
  assert.equal(
    validateInventoryDrafts(summaries, { ja: '10.5', we: '4' }),
    null,
  )
})

test('creates an inclusive local-date month query range', () => {
  assert.deepEqual(getInventoryMonthRange(new Date(2026, 7, 20)), {
    startDate: '2026-08-01',
    endDate: '2026-08-31',
  })
})

test('toggles four independent selected dates', () => {
  let selected = new Set()
  for (const date of ['2026-08-22', '2026-08-23', '2026-08-29', '2026-08-30'])
    selected = toggleInventoryDateSelection(selected, date)
  assert.equal(selected.size, 4)
  selected = toggleInventoryDateSelection(selected, '2026-08-23')
  assert.equal(selected.has('2026-08-23'), false)
})

test('builds one bulk upsert payload for four dates and two room types', () => {
  const rows = buildInventorySaveRows(
    ['2026-08-22', '2026-08-23', '2026-08-29', '2026-08-30'],
    [
      { roomTypeId: 'ja', quantity: 10 },
      { roomTypeId: 'we', quantity: 4 },
    ],
  )
  assert.equal(rows.length, 8)
  assert.equal(
    rows.every((row) =>
      row.room_type_id === 'ja'
        ? row.sellable_quantity === 10
        : row.sellable_quantity === 4,
    ),
    true,
  )
})

test('leaves mixed multi-date values blank instead of choosing a representative', () => {
  const inventory = [
    {
      id: 'a',
      room_type_id: 'ja',
      stay_date: '2026-08-22',
      sellable_quantity: 10,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      room_type_id: 'ja',
      stay_date: '2026-08-23',
      sellable_quantity: 8,
      created_at: '',
      updated_at: '',
    },
  ]
  const drafts = getInventorySelectionDrafts(
    capacities,
    inventory,
    new Set(['2026-08-22', '2026-08-23']),
  )
  assert.equal(drafts.ja, '')
  assert.equal(drafts.we, '12')
})

test('bulk reset expects only rows that actually exist', () => {
  const inventory = [
    {
      id: 'a',
      room_type_id: 'ja',
      stay_date: '2026-08-22',
      sellable_quantity: 10,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'b',
      room_type_id: 'we',
      stay_date: '2026-08-23',
      sellable_quantity: 4,
      created_at: '',
      updated_at: '',
    },
  ]
  assert.deepEqual(
    getExistingInventoryKeys(
      inventory,
      new Set(['2026-08-22', '2026-08-23', '2026-08-24']),
      new Set(['ja', 'we']),
    ),
    ['ja:2026-08-22', 'we:2026-08-23'],
  )
})

test('selects actual weekend dates inside the booking window', () => {
  assert.deepEqual(
    getSelectableInventoryWeekendDates(
      new Date(2026, 7, 1),
      new Date(2026, 7, 20),
      new Date(2026, 7, 30),
    ),
    ['2026-08-22', '2026-08-23', '2026-08-29', '2026-08-30'],
  )
})

test('clears the selection when the displayed month changes', () => {
  assert.equal(clearInventoryDateSelection().size, 0)
})
