import assert from 'node:assert/strict'
import test from 'node:test'
import {
  filterAdminRooms,
  getRoomSalesStatusLabel,
  summarizeAdminRooms,
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
