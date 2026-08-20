import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildInventorySaveRows,
  calculateRoomTypeCapacities,
  clearInventoryDateSelection,
  getExistingInventoryKeys,
  getInventoryMonthRange,
  getInventorySelectionDrafts,
  getInventorySummaries,
  getSelectableInventoryWeekendDates,
  toggleInventoryDateSelection,
  validateInventoryDrafts,
} from '../src/features/admin-inventory/inventory-helpers.ts'

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
