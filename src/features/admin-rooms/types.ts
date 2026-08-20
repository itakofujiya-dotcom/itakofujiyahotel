export type RoomSalesStatus =
  'active' | 'inactive' | 'admin_only' | 'maintenance'

export type RoomStyle = 'western' | 'japanese'

export type AdminRoomType = {
  id: string
  code: string
  name_ja: string
}

export type AdminRoom = {
  id: string
  room_number: string
  floor: number
  room_style: RoomStyle
  standard_capacity: number
  max_capacity: number
  sales_status: RoomSalesStatus
  operations_note: string | null
  room_type: AdminRoomType | null
}

export type RoomFilters = {
  floor: number | 'all'
  style: RoomStyle | 'all'
  status: RoomSalesStatus | 'all'
}
