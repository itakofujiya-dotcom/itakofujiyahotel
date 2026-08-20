import { supabase } from '../../lib/supabase/client'
import {
  buildInventorySaveRows,
  calculateRoomTypeCapacities,
} from './inventory-helpers'
import type {
  InventoryInitialData,
  InventoryQuantity,
  InventorySaveInput,
  RoomTypeCapacity,
  RoomTypeInventory,
} from './types'

export async function fetchInventoryInitialData(): Promise<InventoryInitialData> {
  const [roomTypesResult, roomsResult, settingsResult] = await Promise.all([
    supabase
      .from('room_types')
      .select('id, code, name_ja, display_order')
      .order('display_order', { ascending: true }),
    supabase.from('rooms').select('room_type_id, sales_status'),
    supabase
      .from('hotel_settings')
      .select('max_booking_days')
      .limit(1)
      .single(),
  ])

  if (roomTypesResult.error || roomsResult.error || settingsResult.error) {
    logInventoryError(
      'load capacities and settings',
      roomTypesResult.error ?? roomsResult.error ?? settingsResult.error!,
    )
    throw new Error('INVENTORY_INITIAL_FETCH_FAILED')
  }

  const capacities: RoomTypeCapacity[] = calculateRoomTypeCapacities(
    roomTypesResult.data,
    roomsResult.data,
  )

  return {
    capacities,
    maxBookingDays: settingsResult.data.max_booking_days,
  }
}

export async function fetchInventoryForMonth(
  startDate: string,
  endDate: string,
): Promise<RoomTypeInventory[]> {
  const { data, error } = await supabase
    .from('room_type_inventory')
    .select('*')
    .gte('stay_date', startDate)
    .lte('stay_date', endDate)
    .order('stay_date', { ascending: true })

  if (error) {
    logInventoryError('load monthly inventory', error)
    throw new Error('INVENTORY_MONTH_FETCH_FAILED')
  }
  return data
}

export async function fetchInventoryForDate(
  stayDate: string,
): Promise<RoomTypeInventory[]> {
  const { data, error } = await supabase
    .from('room_type_inventory')
    .select('*')
    .eq('stay_date', stayDate)

  if (error) {
    logInventoryError('load inventory date', error)
    throw new Error('INVENTORY_DATE_FETCH_FAILED')
  }
  return data
}

export async function saveInventoryForDate(
  rows: InventorySaveInput[],
): Promise<void> {
  const { data, error } = await supabase
    .from('room_type_inventory')
    .upsert(rows, { onConflict: 'room_type_id,stay_date' })
    .select('id, room_type_id, stay_date, sellable_quantity')

  if (error) {
    logInventoryError('save inventory date', error)
    throw new Error('INVENTORY_SAVE_FAILED')
  }

  const expected = new Map(
    rows.map((row) => [`${row.room_type_id}:${row.stay_date}`, row]),
  )
  if (
    data.length !== expected.size ||
    data.some((row) => {
      const input = expected.get(`${row.room_type_id}:${row.stay_date}`)
      return !input || input.sellable_quantity !== row.sellable_quantity
    })
  ) {
    throw new Error('INVENTORY_SAVE_INCOMPLETE')
  }
}

export async function saveInventoryForDates({
  dates,
  quantities,
}: {
  dates: string[]
  quantities: InventoryQuantity[]
}): Promise<void> {
  const rows = buildInventorySaveRows(dates, quantities)
  if (rows.length === 0) return
  await saveInventoryForDate(rows)
}

export async function resetInventoryForDate(
  stayDate: string,
  expectedRoomTypeIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(expectedRoomTypeIds)]
  if (uniqueIds.length === 0) return

  const { data, error } = await supabase
    .from('room_type_inventory')
    .delete()
    .eq('stay_date', stayDate)
    .in('room_type_id', uniqueIds)
    .select('id, room_type_id')

  if (error) {
    logInventoryError('reset inventory date', error)
    throw new Error('INVENTORY_RESET_FAILED')
  }

  const deletedIds = new Set(data.map((row) => row.room_type_id))
  if (
    deletedIds.size !== uniqueIds.length ||
    uniqueIds.some((roomTypeId) => !deletedIds.has(roomTypeId))
  ) {
    throw new Error('INVENTORY_RESET_INCOMPLETE')
  }
}

export async function resetInventoryForDates({
  dates,
  roomTypeIds,
  expectedKeys,
}: {
  dates: string[]
  roomTypeIds: string[]
  expectedKeys: string[]
}): Promise<void> {
  const uniqueDates = [...new Set(dates)]
  const uniqueRoomTypeIds = [...new Set(roomTypeIds)]
  const uniqueExpectedKeys = [...new Set(expectedKeys)]
  if (uniqueExpectedKeys.length === 0) return

  const { data, error } = await supabase
    .from('room_type_inventory')
    .delete()
    .in('stay_date', uniqueDates)
    .in('room_type_id', uniqueRoomTypeIds)
    .select('id, room_type_id, stay_date')

  if (error) {
    logInventoryError('reset inventory dates', error)
    throw new Error('INVENTORY_BULK_RESET_FAILED')
  }

  const deletedKeys = new Set(
    data.map((row) => `${row.room_type_id}:${row.stay_date}`),
  )
  if (
    deletedKeys.size !== uniqueExpectedKeys.length ||
    uniqueExpectedKeys.some((key) => !deletedKeys.has(key))
  ) {
    throw new Error('INVENTORY_BULK_RESET_INCOMPLETE')
  }
}

function logInventoryError(
  operation: string,
  error: { code: string; message: string },
) {
  console.error(`[Admin inventory] Failed to ${operation}.`, {
    code: error.code,
    message: error.message,
  })
}
