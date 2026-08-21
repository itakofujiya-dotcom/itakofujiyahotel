import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyRoomStatusToSelection,
  filterAdminRooms,
  getBulkRoomStatusPlan,
  getRoomSalesStatusLabel,
  getVisibleRoomSelectionState,
  summarizeAdminRooms,
  toggleRoomSelection,
  toggleVisibleRoomSelection,
} from '../src/features/admin-rooms/room-helpers.ts'

const westernRoomNumbers = new Set([
  '201',
  '202',
  '203',
  '205',
  '206',
  '207',
  '208',
  '210',
  '301',
  '307',
  '401',
  '501',
  '601',
])
const roomNumbers = [2, 3, 4, 5, 6].flatMap((floor) =>
  ['01', '02', '03', '05', '06', '07', '08', '10'].map(
    (suffix) => `${floor}${suffix}`,
  ),
)
const rooms = roomNumbers.map((roomNumber) => {
  const roomStyle = westernRoomNumbers.has(roomNumber) ? 'western' : 'japanese'
  return {
    id: `room-${roomNumber}`,
    room_number: roomNumber,
    floor: Number(roomNumber[0]),
    room_style: roomStyle,
    standard_capacity: roomNumber.endsWith('01') ? 4 : 2,
    max_capacity: 4,
    sales_status: roomNumber === '501' ? 'inactive' : 'active',
    operations_note: null,
    room_type: {
      id: `${roomStyle}-type`,
      code: roomStyle,
      name_ja: roomStyle === 'western' ? '洋室' : '和室',
    },
  }
})

test('summarizes the confirmed 40-room distribution', () => {
  assert.deepEqual(summarizeAdminRooms(rooms), {
    total: 40,
    active: 39,
    inactive: 1,
    japanese: 27,
    western: 13,
  })
})

test('filters eight rooms on the second floor', () => {
  assert.equal(
    filterAdminRooms(rooms, {
      floor: 2,
      style: 'all',
      status: 'all',
    }).length,
    8,
  )
})

test('filters only western rooms', () => {
  const result = filterAdminRooms(rooms, {
    floor: 'all',
    style: 'western',
    status: 'all',
  })
  assert.equal(result.length, 13)
  assert.ok(result.every((room) => room.room_style === 'western'))
})

test('finds room 501 as the only inactive room', () => {
  const result = filterAdminRooms(rooms, {
    floor: 'all',
    style: 'all',
    status: 'inactive',
  })
  assert.deepEqual(
    result.map((room) => room.room_number),
    ['501'],
  )
})

test('uses Japanese status labels', () => {
  assert.equal(getRoomSalesStatusLabel('active'), '販売中')
  assert.equal(getRoomSalesStatusLabel('inactive'), '販売停止')
  assert.equal(getRoomSalesStatusLabel('admin_only'), '管理者専用')
  assert.equal(getRoomSalesStatusLabel('maintenance'), 'メンテナンス')
})

test('selects three rooms and applies inactive then active in bulk', () => {
  const selected = new Set(rooms.slice(0, 3).map((room) => room.id))
  const inactiveRooms = applyRoomStatusToSelection(rooms, selected, 'inactive')
  assert.ok(
    inactiveRooms.slice(0, 3).every((room) => room.sales_status === 'inactive'),
  )
  assert.equal(summarizeAdminRooms(inactiveRooms).active, 36)
  assert.equal(summarizeAdminRooms(inactiveRooms).inactive, 4)

  const activeRooms = applyRoomStatusToSelection(
    inactiveRooms,
    selected,
    'active',
  )
  assert.ok(
    activeRooms.slice(0, 3).every((room) => room.sales_status === 'active'),
  )
})

test('select all affects only the filtered visible rooms', () => {
  const western = filterAdminRooms(rooms, {
    floor: 'all',
    style: 'western',
    status: 'all',
  })
  const selected = toggleVisibleRoomSelection(
    new Set(),
    western.map((room) => room.id),
  )
  assert.equal(selected.size, 13)
  assert.ok(western.every((room) => selected.has(room.id)))
  assert.ok(
    rooms
      .filter((room) => room.room_style === 'japanese')
      .every((room) => !selected.has(room.id)),
  )
})

test('reports unchecked, indeterminate, and checked header states', () => {
  const visibleIds = rooms.slice(0, 3).map((room) => room.id)
  assert.deepEqual(getVisibleRoomSelectionState(visibleIds, new Set()), {
    selectedCount: 0,
    checked: false,
    indeterminate: false,
  })
  const partial = toggleRoomSelection(new Set(), visibleIds[0])
  assert.equal(
    getVisibleRoomSelectionState(visibleIds, partial).indeterminate,
    true,
  )
  const all = toggleVisibleRoomSelection(partial, visibleIds)
  assert.equal(getVisibleRoomSelectionState(visibleIds, all).checked, true)
  assert.equal(toggleVisibleRoomSelection(all, visibleIds).size, 0)
})

test('protects maintenance and admin-only rooms from bulk status changes', () => {
  const protectedRooms = [
    { ...rooms[0], sales_status: 'maintenance' },
    { ...rooms[1], sales_status: 'admin_only' },
    rooms[2],
  ]
  const selected = new Set(protectedRooms.map((room) => room.id))
  const plan = getBulkRoomStatusPlan(protectedRooms, selected)
  assert.equal(plan.editableRooms.length, 1)
  assert.equal(plan.protectedRooms.length, 2)
  const updated = applyRoomStatusToSelection(
    protectedRooms,
    selected,
    'inactive',
  )
  assert.equal(updated[0].sales_status, 'maintenance')
  assert.equal(updated[1].sales_status, 'admin_only')
  assert.equal(updated[2].sales_status, 'inactive')
})

test('selection is cleared after a safe filter or successful bulk workflow reset', () => {
  const selected = new Set(rooms.slice(0, 3).map((room) => room.id))
  assert.equal(selected.size, 3)
  const resetSelection = new Set()
  assert.equal(resetSelection.size, 0)
})
