import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isWeekend,
  startOfMonth,
} from 'date-fns'
import type {
  InventoryRoomTypeCode,
  InventoryRoomTypeSummary,
  InventoryQuantity,
  InventorySaveInput,
  RoomTypeCapacity,
  RoomTypeAvailability,
  RoomTypeInventory,
} from './types'

export function isInventoryRoomTypeCode(
  code: string,
): code is InventoryRoomTypeCode {
  return code === 'japanese' || code === 'western'
}

export function calculateRoomTypeCapacities(
  roomTypes: {
    id: string
    code: string
    name_ja: string
    display_order: number
  }[],
  rooms: { room_type_id: string; sales_status: string }[],
): RoomTypeCapacity[] {
  return roomTypes
    .filter((roomType) => isInventoryRoomTypeCode(roomType.code))
    .map((roomType) => {
      const typeRooms = rooms.filter(
        (room) => room.room_type_id === roomType.id,
      )
      return {
        roomTypeId: roomType.id,
        code: roomType.code as InventoryRoomTypeCode,
        nameJa: roomType.name_ja,
        displayOrder: roomType.display_order,
        totalRooms: typeRooms.length,
        activeRooms: typeRooms.filter((room) => room.sales_status === 'active')
          .length,
      }
    })
}

export function getInventoryMonthRange(month: Date) {
  return {
    startDate: format(startOfMonth(month), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(month), 'yyyy-MM-dd'),
  }
}

export function getInventorySummaries(
  capacities: RoomTypeCapacity[],
  inventory: RoomTypeInventory[],
  stayDate: string,
): InventoryRoomTypeSummary[] {
  const inventoryByRoomType = new Map(
    inventory
      .filter((row) => row.stay_date === stayDate)
      .map((row) => [row.room_type_id, row]),
  )

  return capacities.map((capacity) => {
    const saved = inventoryByRoomType.get(capacity.roomTypeId)
    return {
      ...capacity,
      sellableQuantity: saved?.sellable_quantity ?? capacity.activeRooms,
      isDefault: !saved,
      inventoryId: saved?.id ?? null,
    }
  })
}

export function getInventoryCalendarSummaries(
  capacities: RoomTypeCapacity[],
  inventory: RoomTypeInventory[],
  availability: RoomTypeAvailability[],
  stayDate: string,
): InventoryRoomTypeSummary[] {
  const settings = getInventorySummaries(capacities, inventory, stayDate)
  const availableByRoomType = new Map(
    availability
      .filter((row) => row.stay_date === stayDate)
      .map((row) => [row.room_type_id, row.available_quantity]),
  )

  return settings.map((summary) => ({
    ...summary,
    sellableQuantity: availableByRoomType.get(summary.roomTypeId) ?? 0,
  }))
}

export function validateInventoryDrafts(
  summaries: InventoryRoomTypeSummary[],
  drafts: Readonly<Record<string, string>>,
): { roomTypeId: string; quantity: number }[] | null {
  const result: { roomTypeId: string; quantity: number }[] = []
  for (const summary of summaries) {
    const raw = drafts[summary.roomTypeId]?.trim() ?? ''
    if (!/^\d+$/.test(raw)) return null
    const quantity = Number(raw)
    if (!Number.isSafeInteger(quantity) || quantity > summary.activeRooms)
      return null
    result.push({ roomTypeId: summary.roomTypeId, quantity })
  }
  return result
}

export function getInventoryByDate(
  inventory: RoomTypeInventory[],
): ReadonlyMap<string, RoomTypeInventory[]> {
  const result = new Map<string, RoomTypeInventory[]>()
  for (const row of inventory) {
    const current = result.get(row.stay_date) ?? []
    current.push(row)
    result.set(row.stay_date, current)
  }
  return result
}

export function getInventorySelectionDrafts(
  capacities: RoomTypeCapacity[],
  inventory: RoomTypeInventory[],
  selectedDates: Iterable<string>,
): Record<string, string> {
  const dates = [...selectedDates]
  if (dates.length === 0) return {}

  return Object.fromEntries(
    capacities.map((capacity) => {
      const quantities = new Set(
        dates.map((stayDate) => {
          const saved = inventory.find(
            (row) =>
              row.stay_date === stayDate &&
              row.room_type_id === capacity.roomTypeId,
          )
          return saved?.sellable_quantity ?? capacity.activeRooms
        }),
      )
      return [
        capacity.roomTypeId,
        quantities.size === 1 ? String([...quantities][0]) : '',
      ]
    }),
  )
}

export function buildInventorySaveRows(
  dates: Iterable<string>,
  quantities: InventoryQuantity[],
): InventorySaveInput[] {
  return [...new Set(dates)].flatMap((stayDate) =>
    quantities.map((quantity) => ({
      room_type_id: quantity.roomTypeId,
      stay_date: stayDate,
      sellable_quantity: quantity.quantity,
    })),
  )
}

export function getExistingInventoryKeys(
  inventory: RoomTypeInventory[],
  selectedDates: ReadonlySet<string>,
  roomTypeIds: ReadonlySet<string>,
): string[] {
  return inventory
    .filter(
      (row) =>
        selectedDates.has(row.stay_date) && roomTypeIds.has(row.room_type_id),
    )
    .map((row) => `${row.room_type_id}:${row.stay_date}`)
}

export function toggleInventoryDateSelection(
  selectedDates: ReadonlySet<string>,
  stayDate: string,
): Set<string> {
  const next = new Set(selectedDates)
  if (next.has(stayDate)) next.delete(stayDate)
  else next.add(stayDate)
  return next
}

export function clearInventoryDateSelection(): Set<string> {
  return new Set()
}

export function getSelectableInventoryWeekendDates(
  month: Date,
  today: Date,
  bookingEnd: Date,
): string[] {
  return eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  })
    .filter(
      (day) =>
        isWeekend(day) && !isBefore(day, today) && !isBefore(bookingEnd, day),
    )
    .map((day) => format(day, 'yyyy-MM-dd'))
}
