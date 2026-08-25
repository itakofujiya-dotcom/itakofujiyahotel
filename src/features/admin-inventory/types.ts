export type InventoryRoomTypeCode = 'japanese' | 'western'

export type RoomTypeCapacity = {
  roomTypeId: string
  code: InventoryRoomTypeCode
  nameJa: string
  displayOrder: number
  totalRooms: number
  activeRooms: number
}

export type RoomTypeInventory = {
  id: string
  room_type_id: string
  stay_date: string
  sellable_quantity: number
  created_at: string
  updated_at: string
}

export type RoomTypeAvailability = {
  stay_date: string
  room_type_id: string
  base_sellable_quantity: number
  booked_quantity: number
  available_quantity: number
}

export type InventoryRoomTypeSummary = RoomTypeCapacity & {
  sellableQuantity: number
  isDefault: boolean
  inventoryId: string | null
}

export type InventorySaveInput = {
  room_type_id: string
  stay_date: string
  sellable_quantity: number
}

export type InventoryQuantity = {
  roomTypeId: string
  quantity: number
}

export type InventoryInitialData = {
  capacities: RoomTypeCapacity[]
  maxBookingDays: number
}
